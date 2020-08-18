import { promises as fs } from "fs";
import { relative } from "path";
import { URL } from "url";
import { findFilesRecursively } from "../command/sql";
import { isManifestFile } from "../lib/manifest";
import { github } from "./GitHub";
import { ManifestFile } from "./ManifestFile";
import { Resource } from "./Resource";

export interface RepositoryMatcher {
  /** The user or organisation that owners this repository */
  owner: string;
  /** The name of the repository */
  name: string;
  /** The target commit hash */
  hash?: string;
  /** The git ref (branch, tag or commit hash) used to resolve this hash */
  ref?: string;
}

export interface RepositoryDefinition extends Required<RepositoryMatcher> {}

export class Repository implements RepositoryDefinition {
  static parseIdentifier(id: string): RepositoryMatcher {
    const [, owner, name, ref] =
      id.match(/^([^/]+)\/([^#@]+)(?:[#@](.+))?$/) ?? [];
    if (!owner || !name) {
      throw new Error("Repository ID must match <owner>/<name>[#<ref>]");
    }
    return { owner, name, ref };
  }

  static parseUrl(url: URL | string): RepositoryMatcher {
    const { protocol, hostname, pathname } =
      url instanceof URL ? url : new URL(url);

    if (protocol !== "http:" && protocol !== "https:") {
      throw new Error(`Repository URL must have http: or https: protocol`);
    }
    if (hostname !== "github.com" && hostname !== "www.github.com") {
      throw new Error(`Repository URL must have a hostname of github.com`);
    }

    const [owner, name, treeOrCommit, ...rest] = pathname
      .replace(/^\//, "")
      .split("/");
    if (!owner) {
      throw new Error(`Could not find owner in repository URL`);
    }
    if (!name) {
      throw new Error(`Could not find repo name in repository URL`);
    }
    const identifier: RepositoryMatcher = { owner, name };

    switch (treeOrCommit) {
      case "tree":
        if (rest.length) {
          identifier.ref = rest.join("/");
        }
        break;
      case "commit":
        if (rest.length) {
          identifier.ref = identifier.hash = rest[0];
        }
        break;
    }
    return identifier;
  }

  static async fromIdentifier(id: string): Promise<Repository> {
    return this.fromRemote(this.parseIdentifier(id));
  }

  static async fromUrl(url: URL | string): Promise<Repository> {
    return this.fromRemote(this.parseUrl(url));
  }

  static async fromRemote({
    owner,
    name,
    ref,
    hash,
  }: RepositoryMatcher): Promise<Repository> {
    const { data: repository } = await github.repos.get({ owner, repo: name });
    const targetRef = hash ?? ref ?? repository.default_branch;

    const { data: commit } = await github.git.getCommit({
      owner,
      repo: name,
      commit_sha: targetRef,
    });

    return this.fromDefinition({
      owner,
      name,
      ref: targetRef,
      hash: commit.sha,
    });
  }

  static fromDefinition(source: RepositoryDefinition): Repository {
    if (source instanceof Repository) {
      return source;
    }
    return new Repository(source);
  }

  private constructor(public readonly source: RepositoryDefinition) {}

  public get name() {
    return this.source.name;
  }

  public get owner() {
    return this.source.owner;
  }

  public get hash() {
    return this.source.hash;
  }

  public get ref() {
    return this.source.ref;
  }

  public get identifier(): string {
    return `${this.owner}/${this.name}`;
  }

  public get url(): URL {
    return new URL(this.identifier, "https://github.com/");
  }

  private async getRemoteTree(ref: string = this.hash) {
    const { data: branch } = await github.git.getTree({
      owner: this.owner,
      repo: this.name,
      tree_sha: ref,
      recursive: "true",
    });
    return branch;
  }

  public async getRemoteManifestFiles(
    ref: string = this.hash
  ): Promise<ManifestFile[]> {
    const { tree } = await this.getRemoteTree(ref);
    const manifestFiles = tree.filter(
      ({ type, path }) => type === "blob" && isManifestFile(path)
    );
    return await Promise.all(
      manifestFiles.map(async ({ sha, path }) => {
        const { data: blob } = await github.git.getBlob({
          owner: this.owner,
          repo: this.name,
          file_sha: sha,
        });
        const rawCode = Buffer.from(blob.content, "base64").toString("utf8");
        return ManifestFile.fromSource(path, rawCode);
      })
    );
  }

  public async getLocalManifestFiles(
    repositoryPath: string
  ): Promise<ManifestFile[]> {
    const files = await findFilesRecursively(
      repositoryPath,
      ManifestFile.fileNameRegexp
    );

    return await Promise.all(
      files.map(async (path) => {
        const source = await fs.readFile(path, "utf8");
        return ManifestFile.fromSource(relative(repositoryPath, path), source);
      })
    );
  }

  public async getRemoteResources(ref?: string): Promise<Resource[]> {
    const manifestFiles = await this.getRemoteManifestFiles(ref);
    return manifestFiles.map((file) => Resource.fromManifestFile(this, file));
  }

  public async getLocalResources(repositoryPath: string): Promise<Resource[]> {
    const manifestFiles = await this.getLocalManifestFiles(repositoryPath);
    return manifestFiles.map((file) => Resource.fromManifestFile(this, file));
  }
}
