import { Resource } from "../Resource";
import { Repository } from "../Repository";
import { ManifestFile } from "../ManifestFile";

describe("Resource", () => {
  describe("getNameFromManifestPath", () => {
    describe("when the manifest file is in a subdirectory of the repo", () => {
      it("returns the name of the subdirectory", () => {
        expect(
          Resource.getNameFromManifestPath("subdir/other/__resource.lua")
        ).toBe("other");
      });
    });

    describe("when the manifest file is in the root of the repo", () => {
      it("returns undefined", () => {
        expect(
          Resource.getNameFromManifestPath("./fxmanifest.lua")
        ).toBeUndefined();
      });
    });
  });

  describe("isDependencyOf", () => {
    const A = Resource.fromManifestFile(
      Repository.fromDefinition({
        hash: "1234",
        name: "repo-a",
        owner: "org",
        ref: "master",
      }),
      ManifestFile.fromSource("fxmanifest.lua", `provide 'resource-a'`)
    );

    const B = Resource.fromManifestFile(
      Repository.fromDefinition({
        hash: "5678",
        name: "repo-b",
        owner: "org",
        ref: "master",
      }),
      ManifestFile.fromSource(
        "fxmanifest.lua",
        `provide 'resource-b'\n` + `dependency 'resource-a'`
      )
    );

    describe("when A is a dependency of B", () => {
      it("returns true", () => {
        expect(Resource.isDependencyOf(A, B)).toBe(true);
      });
    });
    describe("when B is a dependency of A", () => {
      it("returns false", () => {
        expect(Resource.isDependencyOf(B, A)).toBe(false);
      });
    });
    describe("when neither A nor B depend on one another", () => {
      it("should return false", () => {
        expect(Resource.isDependencyOf(A, A)).toBe(false);
      });
    });
  });

  describe("when constructed from a manifest file", () => {});
});
