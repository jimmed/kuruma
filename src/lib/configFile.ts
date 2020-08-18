import { promises as fs } from "fs";
import { safeDump as stringifyYaml, safeLoad as parseYaml } from "js-yaml";
import { flow, matches, split, tap } from "lodash/fp";

export interface Repository {
  owner: string;
  name: string;
  sha: string;
}

export interface Resource {
  /** The id of the repository to install from */
  repository: string;
  /**
   * The file path inside the repository to install from (default `/`).
   * This should point to the folder where `__resource.lua` is located.
   */
  path?: string;
  /** An optional `[namespace]` to prepend to the target installation path */
  namespace?: string | string[];
  /** Whether the resource should be installed (default = false) */
  enabled?: boolean;
}

export interface ConfigFile {
  _exists?: boolean;
  version: 1;
  // The subscribed repositories
  repositories: Repository[];
  // The resources that should be installed
  resources: Resource[];
}

export async function readConfigFile(
  path: string
): Promise<Partial<ConfigFile>> {
  return parseYaml(await fs.readFile(path, "utf8")) as Partial<ConfigFile>;
}

export async function getConfig(path: string): Promise<ConfigFile> {
  let config: Partial<ConfigFile>;
  let exists = false;
  try {
    config = await readConfigFile(path);
    exists = true;
  } catch (error) {
    if (error.code === "ENOENT") {
      config = {};
    } else {
      throw error;
    }
  }
  const fullConfig: ConfigFile = {
    _exists: exists,
    version: 1,
    repositories: [],
    resources: [],
    ...config,
  };
  validateConfig(fullConfig);
  return fullConfig;
}

export function validateConfig(config: Partial<ConfigFile>) {
  if (typeof config !== "object") throw new Error(`Config is not an object`);
  if (config.version !== 1) throw new Error(`Version must be 1`);

  if (config.repositories && !Array.isArray(config.repositories)) {
    throw new Error(`Repositories must be an array`);
  }
  config.repositories?.forEach((repo, index) => {
    if (typeof repo !== "object")
      throw new Error(`Repository #${index + 1} must be an object`);
    if (typeof repo.owner !== "string" || !repo.owner)
      throw new Error(`Repository #${index + 1}'s owner must be a string`);
    if (typeof repo.name !== "string" || !repo.name)
      throw new Error(`Repository #${index + 1}'s name must be a string`);
    if (typeof repo.sha !== "string" || !repo.sha)
      throw new Error(`Repository #${index + 1}'s version must be a string`);
  });

  if (config.resources && !Array.isArray(config.resources)) {
    throw new Error(`Resources must be an array`);
  }
  config.resources?.forEach((resource, index) => {
    if (typeof resource !== "object")
      throw new Error(`Resource ${index + 1} must be an object`);
    if (typeof resource.repository !== "string" || !resource.repository)
      throw new Error(`Resource #${index + 1}'s repository must be a string`);
    if (resource.path && typeof resource.path !== "string")
      throw new Error(
        `Resource #${index + 1}'s path must be a string if specified`
      );
    if (
      resource.namespace &&
      typeof resource.namespace !== "string" &&
      !(
        Array.isArray(resource.namespace) &&
        resource.namespace.every(
          (x) => typeof x === "string" && !x.startsWith("[")
        )
      )
    ) {
      console.warn(resource);
      throw new Error(
        `Resource #${
          index + 1
        }'s .namespace must be a string or array or strings if specified`
      );
    }
  });
}

export async function saveConfigFile(
  path: string,
  { _exists, ...config }: ConfigFile
): Promise<void> {
  validateConfig(config);
  await fs.writeFile(path, stringifyYaml(config), "utf8");
}

export const splitRepositoryName: (
  identifier: string
) => [string, string] = flow(
  split("/"),
  tap((parts) => {
    if (parts.length !== 2)
      throw new Error(`Invalid repository identifier: ${parts.join("/")}`);
  })
);

export const getRepositoryFromConfig = (
  config: ConfigFile,
  identifier: string
) => {
  const [org, name] = splitRepositoryName(identifier);
  const repository = config.repositories.find(matches({ org, name }));
  if (!repository) {
    throw new Error(
      `Repository ${identifier} is not subscribed in config file`
    );
  }
  return repository;
};
