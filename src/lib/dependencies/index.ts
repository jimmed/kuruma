import { AnyManifestFile } from "../manifest";
import { ResourceGraph } from "./ResourceGraph";

export interface Dependency {
  /** The name of the resource */
  resource: string;
  /** The names of the required resource */
  requires: string[];
  /** The name of the resource that this dependency provides */
  provides?: string;
}

export const resolveDependenciesFromManifests = (
  manifests: Record<string, AnyManifestFile>
): Dependency[] =>
  Object.entries(manifests).map(([name, { content }]) => {
    const { name: overrideName, dependency, dependencies, provide } = content;
    const localDeps = dependency ? [dependency] : dependencies ?? [];
    const provides =
      provide ?? (overrideName?.match(/^[a-z0-9-_]+$/i) ? overrideName : name);
    if (name !== provides) {
      console.warn(
        `Resource "${name}" overrides its name as "${provides}" using the "${
          provide ? "provide" : "name"
        }" property in its manifest file`
      );
    }
    return {
      resource: name,
      requires: localDeps,
      provides,
    };
  });

export const resolveDependencyGraphFromManifests = (
  manifests: Record<string, AnyManifestFile>
): ResourceGraph =>
  ResourceGraph.from(resolveDependenciesFromManifests(manifests));
