import { ResourceNode } from "../ResourceNode";

describe("ResourceNode", () => {
  describe("ResourceNode.from()", () => {
    it("returns a new ResourceNode", () => {
      const node = ResourceNode.from({
        resource: "A",
        requires: [],
        provides: "A",
      });
      expect(node).toBeInstanceOf(ResourceNode);
    });
  });

  describe("ResourceNode.resolveDependencies()", () => {
    it("fills the provided Set with the correct load order", () => {
      const nodeA = ResourceNode.from({
        resource: "A",
        requires: ["B", "C"],
        provides: "A",
      });
      const nodeD = ResourceNode.from({
        resource: "D",
        requires: [],
        provides: "B",
      });
      const nodeC = ResourceNode.from({
        resource: "C",
        requires: ["B"],
        provides: "C",
      });

      nodeA.addDependency(nodeD);
      nodeA.addDependency(nodeC);
      nodeC.addDependency(nodeD);

      const resolvedFromA = new Set<ResourceNode>();
      nodeA.resolveDependencies(resolvedFromA);
      expect([...resolvedFromA]).toEqual([nodeD, nodeC, nodeA]);
    });
  });

  describe("<ResourceNode>.addDependency()", () => {
    it("adds the node to its internal dependencies set", () => {
      const node = ResourceNode.from({
        resource: "A",
        requires: ["B"],
        provides: "A",
      });
      const otherNode = ResourceNode.from({
        resource: "B",
        requires: [],
        provides: "B",
      });

      node.addDependency(otherNode);

      // @ts-expect-error - accessing private value
      expect(node.dependencies).toContain(otherNode);
    });
  });

  describe("<ResourceNode>.missingDependencies", () => {
    describe("when there are no dependencies", () => {
      it("is an empty array", () => {
        const node = ResourceNode.from({
          resource: "A",
          requires: [],
          provides: "A",
        });
        expect(node.missingDependencies).toEqual([]);
      });
    });

    describe("when there are unmet dependencies", () => {
      it("is an array of unmet dependency names", () => {
        const nodeA = ResourceNode.from({
          resource: "A",
          requires: ["B", "C"],
          provides: "A",
        });
        const nodeC = ResourceNode.from({
          resource: "C",
          requires: [],
          provides: "C",
        });

        nodeA.addDependency(nodeC);

        expect(nodeA.missingDependencies).toEqual(["B"]);
        expect(nodeC.missingDependencies).toEqual([]);
      });
    });

    describe("when all dependencies are met", () => {
      it("is an empty array", () => {
        const nodeA = ResourceNode.from({
          resource: "A",
          requires: ["B", "C"],
          provides: "A",
        });
        const nodeD = ResourceNode.from({
          resource: "D",
          requires: [],
          provides: "B",
        });
        const nodeC = ResourceNode.from({
          resource: "C",
          requires: ["B"],
          provides: "C",
        });

        nodeA.addDependency(nodeD);
        nodeA.addDependency(nodeC);
        nodeC.addDependency(nodeD);

        expect(nodeA.missingDependencies).toEqual([]);
        expect(nodeC.missingDependencies).toEqual([]);
        expect(nodeD.missingDependencies).toEqual([]);
      });
    });
  });
});
