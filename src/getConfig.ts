import { promises as fs } from "fs";
import { safeLoad as parseYaml, safeDump as stringifyYaml } from "js-yaml";

export interface Repository {
  org: string;
  name: string;
  sha: string;
}

export interface Module {
  /** The id of the repository to install from */
  repository: string;
  /**
   * The file path inside the repository to install from (default `/`).
   * This should point to the folder where `__resource.lua` is located.
   */
  path?: string;
  /** An optional `[namespace]` to prepend to the target installation path */
  namespace?: string | string[];
}

export interface ConfigFile {
  _exists: boolean;
  version: 1;
  // The subscribed repositories
  repositories: Repository[];
  // The modules that should be installed
  modules: Module[];
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
    modules: [],
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
    if (typeof repo.org !== "string" || !repo.org)
      throw new Error(`Repository #${index + 1}'s org must be a string`);
    if (typeof repo.name !== "string" || !repo.name)
      throw new Error(`Repository #${index + 1}'s name must be a string`);
    if (typeof repo.sha !== "string" || !repo.sha)
      throw new Error(`Repository #${index + 1}'s version must be a string`);
  });

  if (config.modules && !Array.isArray(config.modules)) {
    throw new Error(`Modules must be an array`);
  }
  config.modules?.forEach((module, index) => {
    if (typeof module !== "object")
      throw new Error(`Module ${index + 1} must be an object`);
    if (typeof module.repository !== "string" || !module.repository)
      throw new Error(`Module #${index + 1}'s repository must be a string`);
    if (module.path && typeof module.path !== "string")
      throw new Error(
        `Module #${index + 1}'s path must be a string if specified`
      );
    if (module.namespace && typeof module.namespace !== "string")
      throw new Error(
        `Module #${index + 1}'s .namespace must be a string if specified`
      );
  });
}

export async function saveConfigFile(
  path: string,
  { _exists, ...config }: ConfigFile
): Promise<void> {
  validateConfig(config);
  await fs.writeFile(path, stringifyYaml(config), "utf8");
}
