import { promises as fs } from "fs";
import { getConfig } from "./getConfig";
import { Octokit } from "@octokit/rest";
import decompress from "decompress";
import { resolve } from "path";
import { resolvePtr } from "dns";

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
    console.log("Nothing to sync");
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
      await decompress(Buffer.from(tarball), resolve(cachePath, repo.sha));
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
  const requiredLinks = config.modules.map((mod) => {
    const [owner, repoName] = mod.repository.split("/");
    const repository = config.repositories.find(
      (repo) => repo.org === owner && repo.name === repoName
    )!;
    const target = mod.namespace
      ? [
          ...(Array.isArray(mod.namespace)
            ? mod.namespace
            : [mod.namespace]
          ).map((x) => `[${x}]`),
          mod.path?.split("/").slice(-1)[0] ?? repoName,
        ]
      : [mod.path?.split("/").slice(-1)[0] ?? repoName];
    return {
      from: mod.path
        ? resolve(cachePath, repository.sha, mod.path)
        : resolve(cachePath, repository.sha),
      to: resolve(targetPath, ...target),
    };
  });
  console.table(requiredLinks);
}

export async function sync(args: SyncModulesArgs) {
  await syncRepositories(args);
  await syncModules(args);
}
