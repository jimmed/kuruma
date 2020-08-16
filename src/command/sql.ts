import { promises as fs } from "fs";
import { groupBy } from "lodash";
import { basename, join, resolve } from "path";
import { getConfig } from "../lib/configFile";
import { resolveDependencyGraphFromManifests } from "../lib/dependencies";
import { getManifestsFromConfig } from "../lib/manifest";
import { SyncRepositoriesArgs } from "./sync";

export interface OutputSqlArgs extends SyncRepositoriesArgs {
  locale: string;
  transaction: boolean;
}

export const outputSql = async (args: OutputSqlArgs) => {
  const config = await getConfig(args.config);
  const manifests = await getManifestsFromConfig(config, args.cache);
  const { loadOrder } = resolveDependencyGraphFromManifests(manifests);

  if (!loadOrder.size) {
    console.warn("No resources found");
    return;
  }

  if (args.transaction) {
    console.log("START TRANSACTION; -- migration");
  }

  for (const resource of loadOrder) {
    const cachePath = resolve(args.cache, resource.cachePath);
    const sqlFiles = await findSqlFiles(cachePath, args.locale);

    if (sqlFiles.length) {
      console.log("\n-- RESOURCE\n--", resource.name, "\n--", cachePath);
      if (args.transaction) {
        console.log("START TRANSACTION; -- resource");
      }

      for (const sqlFile of sqlFiles) {
        const sqlPath = resolve(cachePath, sqlFile);
        console.log("\n-- FILE\n--", sqlFile);
        const sqlText = await fs.readFile(sqlPath, "utf8");
        if (args.transaction) {
          console.log("START TRANSACTION; -- file");
        }
        console.log(sqlText);
        if (args.transaction) {
          console.log("COMMIT; -- file");
        }
      }

      if (args.transaction) {
        console.log("COMMIT; -- resource");
      }
    }
  }

  if (args.transaction) {
    console.log("COMMIT; -- migration");
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
