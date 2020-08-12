import { promises as fs } from "fs";
import { getConfig } from "./getConfig";
import { Octokit } from "@octokit/rest";
import decompress from "decompress";
import { resolve } from "path";

export interface SyncRepositoriesArgs {
  config: string;
  cache: string;
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
