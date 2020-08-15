import { Dependency } from "./index";

export class ResourceNode {
  static from(dependency: Dependency) {
    return new ResourceNode(dependency);
  }

  static resolveDependencies(node: ResourceNode, resolved: Set<ResourceNode>) {
    if (node.missingDependencies.length) {
      console.warn(
        `Resource "${node.source.resource}" has missing depdencies:`
      );
      node.missingDependencies.forEach((dep) => console.log(` - ${dep}`));
    }

    node.dependencies.forEach((depNode) =>
      this.resolveDependencies(depNode, resolved)
    );

    resolved.add(node);
  }

  private dependencies = new Set<ResourceNode>();
  private constructor(private readonly source: Dependency) {}

  public get name(): string {
    return this.source.resource;
  }

  public get provides(): string | undefined {
    return this.source.provides;
  }

  public get requires(): string[] {
    return this.source.requires ?? [];
  }

  public addDependency(dependency: ResourceNode) {
    this.dependencies.add(dependency);
  }

  public resolveDependencies(resolved: Set<ResourceNode> = new Set()) {
    ResourceNode.resolveDependencies(this, resolved);
  }

  public get dependencyCount(): number {
    return this.dependencies.size;
  }

  public get hasDependencies(): boolean {
    return this.dependencyCount > 0;
  }

  public get missingDependencies(): string[] {
    const available = [...this.dependencies];
    return this.requires.filter(
      (r) => !available.some((a) => a.source.provides === r)
    );
  }

  public dependsOn(node: ResourceNode) {
    return this.dependencies.has(node);
  }
}
