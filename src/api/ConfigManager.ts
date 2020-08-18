import { promises as fs } from "fs";
import produce, { Draft } from "immer";
import { Produced } from "immer/dist/internal";
import { safeDump as stringifyYaml, safeLoad as parseYaml } from "js-yaml";
import { RepositoryDefinition } from "./Repository";

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
  repositories: RepositoryDefinition[];
  // The resources that should be installed
  resources: Resource[];
}

export class ConfigManager {
  static validateConfig(config: Partial<ConfigFile>) {
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
      if (typeof repo.hash !== "string" || !repo.hash)
        throw new Error(`Repository #${index + 1}'s hash must be a string`);
      if (typeof repo.ref !== "string" || !repo.ref)
        throw new Error(`Repository #${index + 1}'s ref must be a string`);
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

  private cachedConfig?: ConfigFile;
  constructor(private path: string) {}

  private async read(): Promise<Partial<ConfigFile>> {
    return parseYaml(await fs.readFile(this.path, "utf8")) as Partial<
      ConfigFile
    >;
  }

  public async get(): Promise<ConfigFile> {
    if (!this.cachedConfig) {
      let config: Partial<ConfigFile>;
      try {
        config = await this.read();
      } catch (error) {
        if (error.code === "ENOENT") {
          config = {};
        } else {
          throw error;
        }
      }

      const fullConfig: ConfigFile = {
        version: 1,
        repositories: [],
        resources: [],
        ...config,
      };

      ConfigManager.validateConfig(fullConfig);
      this.cachedConfig = fullConfig;
    }
    return this.cachedConfig;
  }

  public async save(updatedConfig: ConfigFile) {
    ConfigManager.validateConfig(updatedConfig);
    this.cachedConfig = updatedConfig;
    await fs.writeFile(this.path, stringifyYaml(updatedConfig), "utf8");
  }

  public async update(
    updateCallback: (currentConfig: Draft<ConfigFile>) => ConfigFile | void
  ) {
    const currentConfig = await this.get();
    const updatedConfig = produce(updateCallback, currentConfig)(currentConfig);
    await this.save(updatedConfig);
  }
}
