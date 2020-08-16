import { promises as fs } from "fs";
import { filter, flow, get, has, map, matches } from "lodash/fp";
import {
  CallStatement,
  Chunk,
  Identifier,
  parse,
  Statement,
  StringCallExpression,
  StringLiteral,
} from "luaparse";
import { basename, resolve } from "path";
import { ConfigFile, getRepositoryFromConfig } from "./configFile";

export enum ManifestFileType {
  FxManifest = "fxmanifest.lua",
  LegacyResource = "__resource.lua",
}

export enum FxVersion {
  Adamant = "adamant",
  Bodacious = "bodacious",
  Cerulean = "cerulean",
}

export enum SupportedGame {
  Gta5 = "gta5",
  Rdr3 = "rdr3",
  All = "common",
}

export const isManifestFile = (
  fileName: string
): fileName is ManifestFileType =>
  Object.values<string>(ManifestFileType).includes(basename(fileName));

export const isSupportedFxVersion = (
  fxVersion: string
): fxVersion is FxVersion =>
  Object.values<string>(FxVersion).includes(basename(fxVersion));

export interface CommonResourceManifestProperties {
  name?: string;
  game?: SupportedGame;
  games?: SupportedGame[];
  author?: string;
  /**
   * Defines a script to be loaded on the client, and implicitly adds the file to the resource packfile.
   * The extension determines which script loader will handle the file.
   */
  client_script?: string;
  client_scripts?: string[];
  /**
   * Defines a script to be loaded on the server.
   * The extension determines which script loader will handle the file, as with `client_script`.
   */
  server_script?: string;
  server_scripts?: string[];
  /**
   * Defines a script to be loaded on both sides, and adds the file to the resource packfile.
   * The extension determines which script loader will handle the file, as with `client_script`.
   */
  shared_script?: string;
  shared_scripts?: string[];
  /**
   * Defines a global function to be exported by a client script.
   * In Lua, this will export `_G[exportName]` as `exportName`.
   * In C#, this'll do absolutely nothing at this time.
   */
  exports?: string[];
  /**
   * Defines a global function to be exported by a server script.
   * Behaves like `exports`.
   */
  server_export?: string[];
  /**
   * Marks the resource as being server-only. This stops clients from downloading anything of this resource.
   * **Note:** This can be any value, but should be considered a boolean based on truthiness in Lua.
   */
  server_only?: any;
  dependency?: string;
  dependencies?: string[];
  provide?: string;
}

export interface FxManifestProperties extends CommonResourceManifestProperties {
  /**
   * Defines the supported functionality for the resource.
   * This has to be one of a specific set of words.
   * Each entry inherits properties from the previous one.
   */
  fx_version: FxVersion;
}

/**
 * @deprecated You should be using `fxmanifest.lua` instead
 */
export interface LegacyResourceManifestProperties
  extends CommonResourceManifestProperties {
  /**
   * @deprecated You should be using `fxmanifest.lua` and `fx_version` instead.
   *
   * Defines the supported functionality for the resource.
   * This has to be one of a specific set of GUIDs.
   * Each GUID inherits properties from the previous one.
   *
   * The current resource manifest version is `44febabe-d386-4d18-afbe-5e627f4af937`.
   */
  resource_manifest_version: string;
}

export interface ResourceManifestFile {
  type: ManifestFileType;
  content: CommonResourceManifestProperties;
}

export interface FxManifestFile extends ResourceManifestFile {
  type: ManifestFileType.FxManifest;
  content: FxManifestProperties;
}

export interface LegacyManifestFile extends ResourceManifestFile {
  type: ManifestFileType.LegacyResource;
  content: LegacyResourceManifestProperties;
}

export type AnyManifestFile = FxManifestFile | LegacyManifestFile;

export const parseCallStatement = (
  statement: CallStatement
): [string, string | string[]] | undefined => {
  const { expression } = statement;
  if (!expression?.type) {
    console.error("Error in expression:", statement);
  }

  // TODO: Find a better way to do this
  switch (expression?.type) {
    case "StringCallExpression": {
      const { base, argument } = expression;
      if (base?.type !== "Identifier") break;
      if (argument?.type !== "StringLiteral") break;
      return [base?.name, argument.raw.slice(1, -1)];
    }

    case "TableCallExpression": {
      const { base, arguments: args } = expression;
      if (base?.type !== "Identifier" && base?.type !== "StringCallExpression")
        break;
      if (args.type !== "TableConstructorExpression") break;
      return [
        (base as Identifier)?.name ??
          ((base as StringCallExpression)?.base as Identifier)?.name,
        args.fields
          .filter((field) => field.value?.type === "StringLiteral")
          .map((field) => (field.value as StringLiteral).raw.slice(1, -1)),
      ];
    }
  }
  console.warn(`Unsure how to interpret lua AST node`, expression);
};

export async function readManifestFile(
  resourcePath: string
): Promise<AnyManifestFile> {
  const potentialManifestPaths = Object.values(
    ManifestFileType
  ).map((filename) => resolve(resourcePath, filename));

  const manifestFiles = await Promise.all(
    potentialManifestPaths.map(async (path) => {
      try {
        return {
          type: basename(path),
          rawContent: await fs.readFile(path, "utf8"),
        };
      } catch (error) {
        if (error.code === "ENOENT") return { type: basename(path) };
        throw error;
      }
    })
  );

  const firstManifestFile = manifestFiles
    .filter((x) => x?.rawContent)
    .map(({ type, rawContent }) => ({
      type,
      content: parseManifestFile(rawContent!),
    }))
    .find(Boolean);

  if (!firstManifestFile)
    throw new Error(`No manifest files found in ${resourcePath}`);

  return firstManifestFile as AnyManifestFile;
}

const isCallStatement = matches({
  type: "CallStatement",
}) as (x: Statement) => x is CallStatement;

const extractProperties = flow(
  (rawLuaCode) => parse(rawLuaCode, { scope: true }),
  get<Chunk, "body">("body"),
  filter<Statement, CallStatement>(isCallStatement),
  map(parseCallStatement),
  filter(
    has(0) as (
      pair?: [string, string | string[]]
    ) => pair is [string, string | string[]]
  )
);

export function parseManifestFile(
  rawLuaCode: string
): ResourceManifestFile["content"] {
  try {
    const extractedProperties = extractProperties(rawLuaCode);
    return Object.fromEntries(extractedProperties);
  } catch (error) {
    console.warn(`Error while parsing Lua code:\n\n${rawLuaCode}\n\n`);
    throw error;
  }
}

export const getManifestsFromConfig = async (
  config: ConfigFile,
  cachePath: string
): Promise<Record<string, AnyManifestFile>> =>
  Object.fromEntries(
    await Promise.all(
      config.resources.filter(get("enabled")).map(async (mod) => {
        const { sha } = getRepositoryFromConfig(config, mod.repository)!;
        const resourcePath = mod.path
          ? resolve(cachePath, sha, mod.path)
          : resolve(cachePath, sha);
        const resourceName = [mod.repository, ...(mod.path ? [mod.path] : [])]
          .join("/")
          .split("/")
          .slice(-1);
        const manifest = await readManifestFile(resourcePath);
        return [resourceName, manifest];
      })
    )
  );
