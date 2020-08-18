import { Octokit } from "@octokit/rest";
import Listr from "listr";
import { parse as parseUrl } from "url";
import {
  ConfigFile,
  getConfig,
  Resource,
  saveConfigFile,
} from "../lib/configFile";
import { AnyManifestFile, parseManifestFile } from "../lib/manifest";

export interface SubscribeToRepositoryArgs {
  repo: string;
  config: string;
}

const gh = new Octokit({ auth: process.env.GITHUB_AUTH_TOKEN });

export function getRepoIdentifier(url: string) {
  const { protocol, hostname, pathname } = parseUrl(url);

  if (
    pathname &&
    ((!protocol && !hostname) ||
      (protocol?.match(/^https?:$/) && hostname === "github.com"))
  ) {
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length === 2) {
      const [owner, repo] = parts;
      return { owner, repo };
    }
  }
  throw new Error(`Invalid repository URL "${url}"`);
}

export async function subscribeToRepository({
  repo: url,
  config: configPath,
}: SubscribeToRepositoryArgs) {
  const { owner, repo: name } = getRepoIdentifier(url);
  return new Listr<{
    owner: string;
    name: string;
    configPath: string;
    config?: ConfigFile;
    alreadySubscribed?: boolean;
    repository?: any;
    branch?: any;
    manifestFiles: Record<string, AnyManifestFile>;
  }>([
    {
      title: "Read config file",
      task: async (ctx) => {
        ctx.config = await getConfig(ctx.configPath);
      },
    },
    {
      title: "Check if already subscribed",
      task: (ctx) => {
        ctx.alreadySubscribed = ctx.config!.repositories.some(
          (r) => r.name === name && r.org === owner
        );
      },
    },
    {
      title: `Fetch repository metadata`,
      task: async (ctx) => {
        const { data: repository } = await gh.repos.get({ owner, repo: name });

        if (repository.archived) {
          console.warn(`Repository ${owner}/${name} is archived`);
        }

        ctx.repository = repository;
      },
      skip: (ctx) => ctx.alreadySubscribed,
    },
    {
      title: "Fetch git tree for default branch",
      task: async (ctx) => {
        const { data: branch } = await gh.git.getTree({
          owner: ctx.owner,
          repo: ctx.name,
          tree_sha: ctx.repository.default_branch,
          recursive: "true",
        });
        if (branch.truncated) {
          console.warn(
            "GitHub API has truncated the tree result, some resources may be missed"
          );
        }
        ctx.branch = branch;
      },
      skip: (ctx) => ctx.alreadySubscribed,
    },
    {
      title: "Read manifest files",
      task: async (ctx) => {
        const manifestFiles = ctx.branch.tree.filter(
          ({ type, path }: any) =>
            (type === "blob" && path.endsWith("fxmanifest.lua")) ||
            path.endsWith("__resource.lua")
        );

        if (!manifestFiles.length) {
          throw new Error(
            "Repository does not contain any fxmanifest.lua or __resource.lua files"
          );
        }

        return new Listr<any>(
          manifestFiles.map((file: any) => ({
            title: `Analyze ${file.path}`,
            task: async () =>
              new Listr([
                {
                  title: "Fetch file content",
                  task: async () => {
                    const { data: manifest } = await gh.git.getBlob({
                      owner: ctx.owner,
                      repo: ctx.name,
                      file_sha: file.sha,
                    });

                    const content = Buffer.from(
                      manifest.content,
                      "base64"
                    ).toString("utf8");

                    const resources = parseManifestFile(
                      content
                    ) as AnyManifestFile;
                    ctx.manifestFiles[file.path] = resources;
                  },
                },
              ]),
          })),
          { concurrent: true }
        );
      },
      skip: (ctx) => ctx.alreadySubscribed,
    },
    {
      title: "Update config file",
      task: async (ctx) => {
        const entries = Object.entries(ctx.manifestFiles!);
        const newConfig: ConfigFile = {
          ...ctx.config!,
          repositories: [
            ...ctx.config!.repositories,
            { org: owner, name: name, sha: ctx.branch!.sha },
          ],
          resources: [
            ...ctx.config!.resources,
            ...entries.map(([path]) => {
              const resourcePathParts = path.split("/").slice(0, -1);
              const resourceNamespace = resourcePathParts
                .filter((x) => x.match(/^\[.+\]$/))
                .map((x) => x.slice(1, -1));
              const resourcePath = resourcePathParts.join("/");

              const mod: Resource = {
                repository: `${owner}/${name}`,
                namespace: [name, ...resourceNamespace],
              };

              if (resourcePath) {
                mod.path = resourcePath;
              }
              return mod;
            }),
          ],
        };

        await saveConfigFile(configPath, newConfig);
      },
      skip: (ctx) => ctx.alreadySubscribed,
    },
  ]).run({ configPath, owner, name, manifestFiles: {} });
}
