import { AnyManifestFile } from "./manifest";

export interface Dependency {
  resource: string;
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
        resource: name,
        requires: localDeps,
        provides: provide ?? overrideName ?? name,
      };
    })
    .sort((a, b) => (isDependencyOf(a, b) ? 1 : isDependencyOf(b, a) ? -1 : 0));

export const isDependencyOf = (a: Dependency, b: Dependency) =>
  [b.resource, b.provides].some((b) => b && a.requires.includes(b));

export const warnOnMissingDependencies = (deps: Dependency[]) => {
  deps.forEach(({ resource, requires }) => {
    requires.forEach((req) => {
      if (!deps.some((dep) => [dep.resource, dep.provides!].includes(req))) {
        console.warn(
          `Resource "${resource}" requires "${req}", but it is not in any of the subscribed repositories`
        );
      }
    });
  });
};
