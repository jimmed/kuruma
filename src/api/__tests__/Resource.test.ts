import { Resource } from "../Resource";
import { Repository } from "../Repository";
import { ManifestFile } from "../ManifestFile";

describe("Resource", () => {
  const repoA = Repository.fromDefinition({
    hash: "1234",
    name: "repo-a",
    owner: "org",
    ref: "master",
  });

  const repoB = Repository.fromDefinition({
    hash: "5678",
    name: "repo-b",
    owner: "org",
    ref: "master",
  });

  const A = Resource.fromManifestFile(
    repoA,
    ManifestFile.fromSource("fxmanifest.lua", `provide 'resource-a'`)
  );

  const B = Resource.fromManifestFile(
    repoB,
    ManifestFile.fromSource(
      "fxmanifest.lua",
      `provide 'resource-b'\n` + `dependency 'resource-a'`
    )
  );

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

  describe("when constructed from a manifest file", () => {
    let inRepoRoot: Resource;
    let inRepoSubDir: Resource;
    beforeEach(() => {
      inRepoRoot = Resource.fromManifestFile(
        repoA,
        ManifestFile.fromSource("fxmanifest.lua", `-- empty`)
      );
      inRepoSubDir = Resource.fromManifestFile(
        repoB,
        ManifestFile.fromSource(
          "resources/other/resource-b/fxmanifest.lua",
          `-- empty`
        )
      );
    });

    describe("name", () => {
      describe("when in the repository root", () => {
        it("returns the name of the repository", () => {
          expect(inRepoRoot.name).toBe("repo-a");
        });
      });

      describe("when in a subdirectory of the repository", () => {
        it("returns the name of the subdirectory", () => {
          expect(inRepoSubDir.name).toBe("resource-b");
        });
      });
    });

    describe("path", () => {
      describe("when in the repository root", () => {
        it("returns .", () => {
          expect(inRepoRoot.path).toBe(".");
        });
      });

      describe("when in a subdirectory of the repository", () => {
        it("returns the subdirectory path", () => {
          expect(inRepoSubDir.path).toBe("resources/other/resource-b");
        });
      });
    });

    describe("author", () => {
      describe("when the author is set in the manifest file", () => {
        it("returns the author", () => {
          const resourceWithAuthor = Resource.fromManifestFile(
            repoA,
            ManifestFile.fromSource("fxmanifest.lua", 'author "Jim"')
          );
          expect(resourceWithAuthor.author).toBe("Jim");
        });
      });

      describe("when the author is set in the manifest file", () => {
        it("returns the author", () => {
          expect(inRepoRoot.author).toBe(undefined);
        });
      });
    });

    describe("providedDependencies", () => {
      describe("when the manifest file is empty", () => {
        it("includes only the name of the resource", () => {
          expect(inRepoRoot.providedDependencies).toEqual(["repo-a"]);
          expect(inRepoSubDir.providedDependencies).toEqual(["resource-b"]);
        });
      });

      describe('when the manifest file overrides its "name"', () => {
        const withResourceName = Resource.fromManifestFile(
          repoA,
          ManifestFile.fromSource("fxmanifest.lua", `name "override-name"`)
        );
        it("includes the name of the resource and its override", () => {
          expect(withResourceName.providedDependencies).toEqual([
            "repo-a",
            "override-name",
          ]);
        });
      });

      describe('when the manifest file overrides its "name" but incompatible', () => {
        const withIncompatibleName = Resource.fromManifestFile(
          repoA,
          ManifestFile.fromSource("fxmanifest.lua", `name "My Awesome Module"`)
        );
        it("does not include the override", () => {
          expect(withIncompatibleName.providedDependencies).toEqual(["repo-a"]);
        });
      });

      describe('when the manifest file sets a "provide" property', () => {
        const withProvide = Resource.fromManifestFile(
          repoA,
          ManifestFile.fromSource("fxmanifest.lua", `provide "resource-b"`)
        );
        it("includes the provide property", () => {
          expect(withProvide.providedDependencies).toEqual([
            "repo-a",
            "resource-b",
          ]);
        });
      });

      describe("when the manifest file sets multiple identical names", () => {
        const withIdentical = Resource.fromManifestFile(
          repoA,
          ManifestFile.fromSource(
            "fxmanifest.lua",
            `name "repo-a"; provide "repo-a"`
          )
        );
        it("includes only one name", () => {
          expect(withIdentical.providedDependencies).toEqual(["repo-a"]);
        });
      });

      describe("when the manifest file sets multiple different names", () => {
        const withDifferent = Resource.fromManifestFile(
          repoA,
          ManifestFile.fromSource(
            "fxmanifest.lua",
            'name "other"; provide "else"'
          )
        );

        it("includes all names", () => {
          expect(withDifferent.providedDependencies).toEqual([
            "repo-a",
            "other",
            "else",
          ]);
        });
      });
    });

    describe("provides", () => {
      const withDifferent = Resource.fromManifestFile(
        repoA,
        ManifestFile.fromSource(
          "fxmanifest.lua",
          'name "other"; provide "else"'
        )
      );

      it("returns true for provided dependencies", () => {
        expect(withDifferent.provides("repo-a")).toBe(true);
        expect(withDifferent.provides("other")).toBe(true);
        expect(withDifferent.provides("else")).toBe(true);
      });
    });

    describe("dependencies", () => {
      const cases = [
        [`dependency "b"`, ["b"]],
        [`dependencies { "b", "c" }`, ["b", "c"]],
        [`client_script "@a/path/to/file.lua"`, ["a"]],
        [`client_scripts { "@a/file.lua", "@c/other/path.lua" }`, ["a", "c"]],
        [`shared_script "@a/path/to/file.lua"`, ["a"]],
        [`shared_scripts { "@a/file.lua", "@c/other/path.lua" }`, ["a", "c"]],
        [`server_script "@a/path/to/file.lua"`, ["a"]],
        [`server_scripts { "@a/file.lua", "@c/other/path.lua" }`, ["a", "c"]],
      ] as const;
      describe.each(cases)("with `%s`", (source, expectedDependencies) => {
        const resource = Resource.fromManifestFile(
          repoA,
          ManifestFile.fromSource("fxmanifest.lua", source)
        );
        it(`returns ${expectedDependencies.join("/")}`, () => {
          expect(resource.dependencies).toEqual(expectedDependencies);
        });
      });

      describe("with all of the above", () => {
        const allSources = cases.map((x) => x[0]).join(";\n");
        it("returns all unique dependencies", () => {
          const resource = Resource.fromManifestFile(
            repoA,
            ManifestFile.fromSource("fxmanifest.lua", allSources)
          );
          expect(resource.dependencies).toEqual(["b", "c", "a"]);
        });
      });
    });

    describe("isDependencyOf / dependsOn", () => {
      it("returns true if B depends on B", () => {
        expect(B.dependsOn(A)).toBe(true);
        expect(B.isDependencyOf(A)).toBe(false);
        expect(A.dependsOn(B)).toBe(false);
        expect(A.isDependencyOf(B)).toBe(true);
      });
    });
  });
});
