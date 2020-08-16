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
    const {
      name: overrideName,
      dependency,
      dependencies,
      provide,
      client_script,
      client_scripts,
      shared_script,
      shared_scripts,
      server_script,
      server_scripts,
    } = content;

    // Some dependencies are found in the `*_script(s)` declarations
    const legacyDeps = [
      client_script,
      client_scripts,
      shared_script,
      shared_scripts,
      server_script,
      server_scripts,
    ]
      .flat()
      .filter((script) => script?.startsWith("@"))
      .map((script) => script!.slice(1).split("/")[0]);

    // Others are found in the `dependency` and `dependencies`
    const localDeps = dependency ? [dependency] : dependencies ?? [];

    const deps = [...new Set([...legacyDeps, ...localDeps])];

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
      requires: deps,
      provides,
    };
  });

export const resolveDependencyGraphFromManifests = (
  manifests: Record<string, AnyManifestFile>
): ResourceGraph =>
  ResourceGraph.from(resolveDependenciesFromManifests(manifests));
