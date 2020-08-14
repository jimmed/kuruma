import { Octokit } from "@octokit/rest";
import decompress from "decompress";
import { promises as fs } from "fs";
import { dirname, relative, resolve } from "path";
import { getConfig } from "./lib/configFile";
import { ncp } from "ncp";
import { promisify } from "util";

const copyDirectory = promisify(ncp);

export interface SyncRepositoriesArgs {
  config: string;
  cache: string;
}

export interface SyncModulesArgs extends SyncRepositoriesArgs {
  target: string;
}

export async function syncRepositories({
  config: configPath,
  cache: cachePath,
}: SyncRepositoriesArgs) {
  await fs.mkdir(cachePath, { recursive: true });
  const config = await getConfig(configPath);
  const requiredHashes = config.repositories.map((x) => x.sha);
  const currentHashes = (await fs.readdir(cachePath, { withFileTypes: true }))
    .filter((x) => x.isDirectory())
    .map((x) => x.name);

  const toRemove = currentHashes.filter(
    (hash) => !requiredHashes.includes(hash)
  );
  if (toRemove.length) {
    console.log("To remove:");
    toRemove.forEach((hash) => console.log(` - ${hash}`));
  }

  const toAdd = config.repositories.filter(
    (x) => !currentHashes.includes(x.sha)
  );
  if (toAdd.length) {
    console.log("To download:");
    toAdd.forEach((repo) =>
      console.log(` - ${repo.org}/${repo.name} (${repo.sha})`)
    );
  }

  if (!toAdd.length && !toRemove.length) {
    console.log("No repositories to sync");
  }

  const gh = new Octokit({ auth: process.env.GITHUB_AUTH_TOKEN });
  await Promise.all(
    toAdd.map(async (repo) => {
      const { data: tarball } = await gh.repos.downloadArchive({
        owner: repo.org,
        repo: repo.name,
        ref: repo.sha,
        archive_format: "tarball",
      });
      await decompress(Buffer.from(tarball), resolve(cachePath, repo.sha), {
        strip: 1,
      });
      console.info(`Downloaded ${repo.org}/${repo.name} (${repo.sha})`);
    })
  );

  await Promise.all(
    toRemove.map(async (hash) => {
      await fs.rmdir(resolve(cachePath, hash), { recursive: true });
      console.log(`Purged ${hash} from cache`);
    })
  );

  if (!requiredHashes.length) {
    await fs.rmdir(cachePath);
  }
}

export async function syncModules({
  config: configPath,
  cache: cachePath,
  target: targetPath,
}: SyncModulesArgs) {
  const config = await getConfig(configPath);
  const targetModules = await Promise.all(
    config.modules.map(async (mod) => {
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
      const repository = config.repositories.find(
        (repo) => repo.org === owner && repo.name === repoName
      );
      if (!repository) {
        throw new Error(
          `Module ${target.join("/")} depends on the ${
            mod.repository
          } repository, but it is not subscribed.`
        );
      }
      const fromPath = mod.path
        ? resolve(cachePath, repository.sha, mod.path)
        : resolve(cachePath, repository.sha);
      const toPath = resolve(targetPath, ...target);
      let shouldCreate = false;
      try {
        const stat = await fs.stat(toPath);
        if (!stat.isDirectory()) {
          console.log({ toPath, stat });
          throw new Error(`${toPath} already exists, but is not a directory`);
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

  const toAdd = targetModules.filter((link) => link.shouldCreate);
  if (!toAdd.length) {
    console.info("No modules to sync");
    return;
  }

  await Promise.all(
    toAdd.map(async (x) => {
      await fs.mkdir(dirname(x.to), { recursive: true });
      await copyDirectory(x.from, x.to, { stopOnErr: true });
    })
  );
  console.log("Linked modules:");
  toAdd.forEach((x) =>
    console.log(
      ` - ${relative(process.cwd(), x.to)} -> ${relative(
        process.cwd(),
        x.from
      )}`
    )
  );
}

export async function sync(args: SyncModulesArgs) {
  await syncRepositories(args);
  await syncModules(args);
}
