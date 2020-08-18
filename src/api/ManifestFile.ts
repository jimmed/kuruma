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
import { AnyManifestFile, ManifestFileType } from "../lib/manifest";
import { basename } from "path";

export class ManifestFile {
  static fileNameRegexp = new RegExp(
    Object.values(ManifestFileType)
      .map((x) => x.replace(".", "\\."))
      .join("|") + "$",
    "i"
  );

  static isCallStatement = matches({
    type: "CallStatement",
  }) as (x: Statement) => x is CallStatement;

  static parseCallStatement(
    statement: CallStatement
  ): [string, string | string[]] | undefined {
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
        if (
          base?.type !== "Identifier" &&
          base?.type !== "StringCallExpression"
        )
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
  }

  static parse = flow(
    (rawLuaCode: string) => parse(rawLuaCode, { scope: true }),
    get<Chunk, "body">("body"),
    filter<Statement, CallStatement>(ManifestFile.isCallStatement),
    map(ManifestFile.parseCallStatement),
    filter(
      has(0) as (
        pair?: [string, string | string[]]
      ) => pair is [string, string | string[]]
    ),
    Object.fromEntries
  ) as (rawLuaCode: string) => AnyManifestFile["content"];

  static fromSource(pathInRepo: string, source: string) {
    return new ManifestFile(pathInRepo, ManifestFile.parse(source));
  }

  private constructor(
    /** The relative path of the manifest file within the repo */
    public readonly path: string,
    /** The properties parsed from the manifest file */
    public readonly properties: AnyManifestFile["content"]
  ) {}

  public get type(): ManifestFileType {
    return basename(this.path) as ManifestFileType;
  }
}
