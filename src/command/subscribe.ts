import { Octokit } from "@octokit/rest";
import {
  CallStatement,
  Identifier,
  parse as parseLua,
  StringCallExpression,
  StringLiteral,
  TableConstructorExpression,
} from "luaparse";
import { parse as parseUrl } from "url";
import {
  ConfigFile,
  getConfig,
  Module,
  saveConfigFile,
} from "../lib/configFile";

interface SubscribeToRepositoryArgs {
  repo: string;
  config: string;
}

export function getRepoIdentifier(url: string) {
  const { protocol, hostname, pathname } = parseUrl(url);

  if (
    pathname &&
    ((!protocol && !hostname) ||
      (protocol?.match(/^https?:$/) && hostname === "github.com"))
  ) {
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length === 2) {
      const [owner, repo] = parts;
      return { owner, repo };
    }
  }
  throw new Error(`Invalid repository URL "${url}"`);
}

export async function subscribeToRepository({
  repo: url,
  config: configPath,
}: SubscribeToRepositoryArgs) {
  const currentConfig = await getConfig(configPath);
  const { owner, repo } = getRepoIdentifier(url);
  if (
    currentConfig.repositories.some((r) => r.name === repo && r.org === owner)
  ) {
    console.info(`Already subscribed to ${owner}/${repo}`);
    return;
  }
  const gh = new Octokit({ auth: process.env.GITHUB_AUTH_TOKEN });
  console.info(`Fetching GitHub repository (${owner}/${repo})...`);
  const { data: repository } = await gh.repos.get({ owner, repo });

  if (repository.archived) {
    console.warn("Repository is archived");
  }

  console.info(
    `Getting file listing for ${repository.default_branch} branch...`
  );
  const { data: master } = await gh.git.getTree({
    owner,
    repo,
    tree_sha: repository.default_branch,
    recursive: "true",
  });

  if (master.truncated) {
    console.warn(
      "GitHub truncated file listing result, may not be able to find "
    );
  }

  const manifests = master.tree.filter(
    ({ type, path }) =>
      (type === "blob" && path.endsWith("fxmanifest.lua")) ||
      path.endsWith("__resource.lua")
  );

  if (!manifests.length) {
    throw new Error(
      "Repository does not contain any fxmanifest.lua or __resource.lua files"
    );
  }

  const modules = Object.fromEntries(
    await Promise.all(
      manifests.map(async (manifest) => {
        const { data: file } = await gh.git.getBlob({
          owner,
          repo,
          file_sha: manifest.sha,
        });

        const content = Buffer.from(file.content, "base64").toString("utf8");

        const modules = Object.fromEntries(
          parseLua(content)
            .body.filter((x): x is CallStatement => x.type === "CallStatement")
            .map((x) => {
              const identifier = x.expression.base as
                | Identifier
                | StringCallExpression;
              switch (x.expression.type) {
                case "StringCallExpression": {
                  return [
                    (identifier as Identifier).name,
                    (x.expression.argument as StringLiteral).raw.slice(1, -1),
                  ];
                }
                case "TableCallExpression":
                  return [
                    (identifier as Identifier).name ??
                      ((identifier as StringCallExpression).base as Identifier)
                        .name,
                    (x.expression
                      .arguments as TableConstructorExpression).fields
                      .filter((field) => field.value.type === "StringLiteral")
                      .map((field) =>
                        (field.value as StringLiteral).raw.slice(1, -1)
                      ),
                  ];
              }
              return [];
            })
            .filter((x) => x?.[0])
        );
        return [manifest.path, modules];
      })
    )
  );
  const entries = Object.entries<Module>(modules);
  console.log(
    `Repository contains ${entries.length} module${
      entries.length === 1 ? "" : "s"
    }:`
  );
  Object.entries(modules).forEach(([path, mod]: [string, any]) => {
    console.info(
      ` - ${path.split("/").slice(-2, -1)[0] || repo} (${
        mod.version ?? "unknown version"
      })`
    );
  });

  const newConfig: ConfigFile = {
    ...currentConfig,
    repositories: [
      ...currentConfig.repositories,
      { org: owner, name: repo, sha: master.sha },
    ],
    modules: [
      ...currentConfig.modules,
      ...entries.map(([path]) => {
        const modulePathParts = path.split("/").slice(0, -1);
        const moduleNamespace = modulePathParts
          .filter((x) => x.match(/^\[.+\]$/))
          .map((x) => x.slice(1, -1));
        const modulePath = modulePathParts.join("/");

        const mod: Module = {
          repository: `${owner}/${repo}`,
          namespace: [repo, ...moduleNamespace],
        };

        if (modulePath) {
          mod.path = modulePath;
        }
        return mod;
      }),
    ],
  };

  await saveConfigFile(configPath, newConfig);

  console.log(`Subscribed to ${owner}/${repo}`);
}

export async function unsubscribeFromRepository({
  repo: url,
  config: configPath,
}: SubscribeToRepositoryArgs) {
  const currentConfig = await getConfig(configPath);
  const { owner, repo } = getRepoIdentifier(url);
  if (
    !currentConfig.repositories.some((r) => r.name === repo && r.org === owner)
  ) {
    console.info(`Not subscribed to ${owner}/${repo}`);
    return;
  }

  // TODO: Delete child modules from config
  const newConfig: ConfigFile = {
    ...currentConfig,
    repositories: currentConfig.repositories.filter(
      (x) => x.org !== owner && x.name !== "repo"
    ),
  };

  await saveConfigFile(configPath, newConfig);

  console.log(`Unsubscribed from ${owner}/${repo}`);
}
