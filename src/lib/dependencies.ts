import { AnyManifestFile } from "./manifest";

export interface Dependency {
  module: string;
  requires: string[];
  provides?: string;
}

export const resolveDependenciesFromManifests = (
  manifests: Record<string, AnyManifestFile>
): Dependency[] =>
  Object.entries(manifests)
    .map(([name, { content }]) => {
      const { name: overrideName, dependency, dependencies, provide } = content;
      const localDeps = dependency ? [dependency] : dependencies ?? [];
      return {
        module: name,
        requires: localDeps,
        provides: provide ?? overrideName ?? name,
      };
    })
    .sort((a, b) => (isDependencyOf(a, b) ? 1 : isDependencyOf(b, a) ? -1 : 0));

export const isDependencyOf = (a: Dependency, b: Dependency) =>
  [b.module, b.provides].some((b) => b && a.requires.includes(b));

export const warnOnMissingDependencies = (deps: Dependency[]) => {
  deps.forEach(({ module, requires }) => {
    requires.forEach((req) => {
      if (!deps.some((dep) => [dep.module, dep.provides!].includes(req))) {
        console.warn(
          `Module "${module}" requires "${req}", but it is not in any of the subscribed repositories`
        );
      }
    });
  });
};
