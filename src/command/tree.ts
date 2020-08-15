import { getConfig } from "../lib/configFile";
import {
  Dependency,
  isDependencyOf,
  resolveDependenciesFromManifests,
  warnOnMissingDependencies,
} from "../lib/dependencies";
import { getManifestsFromConfig } from "../lib/manifest";
import { SyncRepositoriesArgs } from "./sync";

interface DrawDependencyTreeArgs extends SyncRepositoriesArgs {}

export const drawDependencyTree = async (
  args: DrawDependencyTreeArgs
): Promise<void> => {
  const config = await getConfig(args.config);
  const manifests = await getManifestsFromConfig(config, args.cache);
  const dependencies = resolveDependenciesFromManifests(manifests);
  warnOnMissingDependencies(dependencies);
  const tree = generateTree(dependencies);

  console.log("All Resources");
  console.log(drawTree(tree).join("\n"));
};

export const generateTree = (
  dependencies: Dependency[],
  root?: Dependency
): any => {
  const thisLevel = dependencies.filter(
    root ? (x) => isDependencyOf(x, root) : (x) => !x.requires.length
  );

  return Object.fromEntries(
    thisLevel.map((dep) => [dep.module, generateTree(dependencies, dep)])
  );
};

export interface Tree extends Record<string, Tree> {}

export const drawTree = (tree: Tree, indent = ""): string[] => {
  return Object.entries(tree).flatMap(([name, children], index, list) => {
    const isLast = index === list.length - 1;
    return [
      `${indent}${isLast ? "└" : "├"} ${name}`,
      ...drawTree(children, indent + (isLast ? "  " : "│ ")),
    ];
  });
};
