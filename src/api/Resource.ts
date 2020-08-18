import { ManifestFile } from "./ManifestFile";
import { Repository } from "./Repository";
import { dirname } from "path";

export class Resource {
  static fromManifestFile(repository: Repository, manifestFile: ManifestFile) {
    return new Resource(repository, manifestFile);
  }

  static getNameFromManifestPath(path: string): string | undefined {
    return path
      .split("/")
      .filter((x) => x !== ".")
      .slice(-2, -1)[0];
  }

  /** Returns true if `a` is a dependency of `b` */
  static isDependencyOf(a: Resource, b: Resource) {
    return b.dependencies.some((dep) => a.provides(dep));
  }

  private constructor(
    public readonly repository: Repository,
    private readonly manifestFile: ManifestFile
  ) {}

  public get name(): string {
    return (
      Resource.getNameFromManifestPath(this.manifestFile.path) ??
      this.repository.name
    );
  }

  public get path(): string {
    return dirname(this.manifestFile.path);
  }

  public get author(): string | undefined {
    return this.manifestFile.properties.author;
  }

  public get providedDependencies(): string[] {
    const { name: overrideName, provide } = this.manifestFile.properties;

    const provided = new Set([this.name]);
    if (overrideName?.match(/^[a-z0-9-_]+$/i)) {
      provided.add(overrideName);
    }
    if (provide) {
      provided.add(provide);
    }
    return [...provided];
  }

  public provides(name: string): boolean {
    return this.providedDependencies.includes(name);
  }

  public get dependencies(): string[] {
    const {
      dependency,
      dependencies = [],
      client_script,
      client_scripts = [],
      shared_script,
      shared_scripts = [],
      server_script,
      server_scripts = [],
    } = this.manifestFile.properties;

    const namedDependencies = [dependency, ...dependencies].filter(
      Boolean
    ) as string[];

    const inferredDependencies = [
      client_script,
      ...client_scripts,
      shared_script,
      ...shared_scripts,
      server_script,
      ...server_scripts,
    ]
      .filter((x): x is string => !!x?.startsWith("@"))
      .map((x) => x.slice(1).split("/")[0]);

    return [...new Set([...namedDependencies, ...inferredDependencies])];
  }

  public isDependencyOf(resource: Resource): boolean {
    return Resource.isDependencyOf(this, resource);
  }

  public dependsOn(resource: Resource): boolean {
    return Resource.isDependencyOf(resource, this);
  }
}
