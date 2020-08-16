import { promises as fs } from "fs";
import { groupBy } from "lodash";
import { basename, join, resolve } from "path";
import { getConfig } from "../lib/configFile";
import { resolveDependencyGraphFromManifests } from "../lib/dependencies";
import { getManifestsFromConfig } from "../lib/manifest";
import { SyncRepositoriesArgs } from "./sync";

export interface OutputSqlArgs extends SyncRepositoriesArgs {
  locale: string;
}

export const outputSql = async (args: OutputSqlArgs) => {
  const config = await getConfig(args.config);
  const manifests = await getManifestsFromConfig(config, args.cache);
  const dependencyGraph = resolveDependencyGraphFromManifests(manifests);

  for (const resource of dependencyGraph.loadOrder) {
    const cachePath = resolve(args.cache, resource.cachePath);
    const sqlFiles = await findSqlFiles(cachePath, args.locale);
    if (sqlFiles.length) {
      console.log("\n-- RESOURCE\n--", resource.name, "\n--", cachePath);

      for (const sqlFile of sqlFiles) {
        const sqlPath = resolve(cachePath, sqlFile);
        console.log("\n-- FILE\n--", sqlFile, "\n");
        const sqlText = await fs.readFile(sqlPath, "utf8");
        console.log(sqlText);
      }
    }
  }
};

export async function findSqlFiles(cachePath: string, targetLocale = "en") {
  const files = await findFilesRecursively(cachePath, /\.sql$/);
  const otherLocaleFiles = new Set();
  files.forEach((file) => {
    const base = basename(file, ".sql");
    const matches = base.match(/^([a-z]{2})[-_]/i);
    if (!matches) return;
    const [, locale] = matches;
    if (locale !== targetLocale) {
      console.warn(
        "Ignoring file",
        `${base}.sql`,
        "because locale",
        `"${locale}" is not "${targetLocale}"`
      );
      otherLocaleFiles.add(file);
    }
  });
  // Keep if it's not in a conflicting file set or it's our target locale
  return files.filter((file) => !otherLocaleFiles.has(file));
}

export async function findFilesRecursively(
  path: string,
  match?: RegExp
): Promise<string[]> {
  const allItems = await fs.readdir(path, { withFileTypes: true });
  const { files = [], directories = [] } = groupBy(allItems, (x) =>
    x.isFile() ? "files" : x.isDirectory() ? "directories" : ""
  );
  const matchingFiles = match
    ? files.filter((file) => file.name.match(match))
    : files;
  const filesFromSubdirectories = await Promise.all(
    directories.map((dir) => findFilesRecursively(join(path, dir.name), match))
  );

  return [
    ...matchingFiles.map((file) => join(path, file.name)),
    ...filesFromSubdirectories.flat(),
  ];
}
