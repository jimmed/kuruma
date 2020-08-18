import { Octokit } from "@octokit/rest";
import decompress from "decompress";
import { promises as fs } from "fs";
import Listr from "listr";
import { ncp } from "ncp";
import { dirname, relative, resolve } from "path";
import { promisify } from "util";
import { ConfigFile, getConfig, Repository } from "../lib/configFile";

const copyDirectory = promisify(ncp);

export interface SyncRepositoriesArgs {
  config: string;
  cache: string;
}

export interface SyncResourcesArgs extends SyncRepositoriesArgs {
  target: string;
}

const gh = new Octokit({ auth: process.env.GITHUB_AUTH_TOKEN });

export interface SyncContext {
  configPath: string;
  cachePath: string;
  targetPath?: string;
  config?: ConfigFile;
  reposToAdd?: Repository[];
  reposToRemove?: string[];
  resourcesToAdd?: {
    from: string;
    to: string;
    shouldCreate: boolean;
  }[];
  resourcesToRemove?: string[];
}

export function syncRepositories() {
  return new Listr<SyncContext>([
    {
      title: "Compare config to cache contents",
      task: async (ctx) => {
        const requiredHashes = ctx.config!.repositories.map((x) => x.sha);
        const currentHashes = (
          await fs.readdir(ctx.cachePath, { withFileTypes: true })
        )
          .filter((x) => x.isDirectory())
          .map((x) => x.name);

        ctx.reposToRemove = currentHashes.filter(
          (hash) => !requiredHashes.includes(hash)
        );
        ctx.reposToAdd = ctx.config!.repositories.filter(
          (x) => !currentHashes.includes(x.sha)
        );
      },
    },
    {
      title: "Fetch missing repositories",
      skip: (ctx) => !ctx.reposToAdd?.length,
      task: (ctx) => {
        return new Listr(
          ctx.reposToAdd!.map((repo) => ({
            title: `${repo.org}/${repo.name} (${repo.sha.slice(0, 7)})`,
            task: async () => {
              const { data: tarball } = await gh.repos.downloadArchive({
                owner: repo.org,
                repo: repo.name,
                ref: repo.sha,
                archive_format: "tarball",
              });
              await decompress(
                Buffer.from(tarball),
                resolve(ctx.cachePath, repo.sha),
                { strip: 1 }
              );
            },
          })),
          { concurrent: true }
        );
      },
    },
    {
      title: "Remove unused repositories from cache",
      skip: (ctx) => !ctx.reposToRemove?.length,
      task: (ctx) =>
        new Listr(
          ctx.reposToRemove!.map((sha) => ({
            title: sha,
            task: () =>
              fs.rmdir(resolve(ctx.cachePath, sha), { recursive: true }),
          })),
          { concurrent: true }
        ),
    },
  ]);
}

export async function syncResources() {
  return new Listr<SyncContext>([
    {
      title: "Compare config to target resources",
      task: async (ctx) => {
        const targetResources = await Promise.all(
          ctx.config!.resources.map(async (mod) => {
            const [owner, repoName] = mod.repository.split("/");
            const target = mod.namespace
              ? [
                  ...(Array.isArray(mod.namespace)
                    ? mod.namespace
                    : [mod.namespace]
                  ).map((x) => `[${x}]`),
                  mod.path?.split("/").slice(-1)[0] ?? repoName,
                ]
              : [mod.path?.split("/").slice(-1)[0] ?? repoName];
            const repository = ctx.config!.repositories.find(
              (repo) => repo.org === owner && repo.name === repoName
            );
            if (!repository) {
              throw new Error(
                `Resource ${target.join("/")} depends on the ${
                  mod.repository
                } repository, but it is not subscribed.`
              );
            }
            const fromPath = mod.path
              ? resolve(ctx.cachePath, repository.sha, mod.path)
              : resolve(ctx.cachePath, repository.sha);
            const toPath = resolve(ctx.targetPath!, ...target);
            let shouldCreate = false;
            try {
              const stat = await fs.stat(toPath);
              if (!stat.isDirectory()) {
                console.log({ toPath, stat });
                throw new Error(
                  `${toPath} already exists, but is not a directory`
                );
              }
            } catch (error) {
              if (error.code !== "ENOENT") {
                console.error({ fromPath, toPath });
                throw error;
              } else {
                shouldCreate = true;
              }
            }
            return {
              from: fromPath,
              to: toPath,
              shouldCreate,
            };
          })
        );

        ctx.resourcesToAdd = targetResources.filter(
          (link) => link.shouldCreate
        );
      },
    },
    {
      title: "Copy resources to target directory",
      skip: (ctx) => !ctx.resourcesToAdd?.length,
      task: (ctx) =>
        new Listr(
          ctx.resourcesToAdd?.map((dirToCopy) => ({
            title: `Copy ${relative(ctx.targetPath!, dirToCopy.to)}`,
            task: async () => {
              await fs.mkdir(dirname(dirToCopy.to), { recursive: true });
              await copyDirectory(dirToCopy.from, dirToCopy.to, {
                stopOnErr: true,
              });
            },
          }))
        ),
    },
  ]);
}

export async function sync(args: SyncResourcesArgs) {
  return new Listr<SyncContext>([
    {
      title: "Read config file",
      task: async (ctx) => {
        ctx.config = await getConfig(ctx.configPath);
      },
    },
    {
      title: "Ensure cache directory exists",
      task: async (ctx) => fs.mkdir(ctx.cachePath, { recursive: true }),
    },
    {
      title: "Sync repositories",
      task: syncRepositories,
    },
    {
      title: "Sync resources",
      task: syncResources,
    },
  ]).run({
    configPath: args.config,
    cachePath: args.cache,
    targetPath: args.target,
  });
}
