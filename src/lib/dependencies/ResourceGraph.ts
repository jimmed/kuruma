import { ResourceNode } from "./ResourceNode";
import { Dependency } from "./index";

export class ResourceGraph {
  static from(dependencies?: Dependency[]) {
    return new ResourceGraph(new Set(dependencies?.map(ResourceNode.from)));
  }

  private constructor(private _nodes: Set<ResourceNode>) {
    _nodes.forEach((node) => this.addNode(node));
  }

  public get nodes(): ResourceNode[] {
    return Array.from(this._nodes);
  }

  private addNode(node: ResourceNode) {
    node.requires.forEach((dependency) => {
      const depNodes = this.nodes.filter((nod) => nod.provides === dependency);
      if (!depNodes.length) {
        throw new Error(
          `Resource "${node.name}" depends on "${dependency}", but it could not be found`
        );
      }
      if (depNodes.length > 1) {
        throw new Error(
          `Resource "${
            node.name
          }" depends on "${dependency}", but multiple resources provide it (${depNodes
            .map((node) => node.name)
            .join("/")})`
        );
      }

      node.addDependency(depNodes[0]);
    });

    this._nodes.add(node);
  }

  public get loadOrder() {
    const nodes = this.nodes;

    /**
     * Find our entry points into the graph. These are nodes
     * that have dependencies, but are not depended on by
     * anything else.
     */
    const entrypoints = nodes.filter(
      (node) =>
        node.hasDependencies &&
        !nodes.some((otherNode) => otherNode.dependsOn(node))
    );

    /**
     * Find all of the modules that have no dependencies.
     * We'll use these to start our list.
     */
    const dependencyFree = nodes.filter((node) => !node.hasDependencies);
    const resolved = new Set<ResourceNode>(dependencyFree);

    /**
     * Generate the rest of our list by walking the dependency
     * graph from each of our entry points.
     */
    entrypoints.forEach((node) => node.resolveDependencies(resolved));
    return resolved;
  }
}
