import {
  ConfigFile,
  getConfig,
  Resource,
  saveConfigFile,
} from "../lib/configFile";
import Listr from "listr";

export interface SetResourceEnabledArgs {
  config: string;
  resource: string;
  repo?: string;
  enabled: boolean;
}

export interface SetResourceEnabledContext {
  configPath: string;
  resourceName: string;
  repositoryIdentifer?: string;
  enabled: boolean;
  resource?: Resource;
  config?: ConfigFile;
  alreadyEnabled?: boolean;
}

export async function setResourceEnabled(args: SetResourceEnabledArgs) {
  return new Listr<SetResourceEnabledContext>([
    {
      title: "Read config file",
      task: async (ctx) => {
        ctx.config = await getConfig(ctx.configPath);
      },
    },
    {
      title: "Find resource in config",
      task: (ctx) => {
        const matching = ctx.config!.resources.filter(
          (res) =>
            (res.path ?? res.repository).split("/").slice(-1)[0] ===
              ctx.resourceName &&
            (!ctx.repositoryIdentifer ||
              ctx.repositoryIdentifer === res.repository)
        );
        if (matching.length > 1) {
          throw new Error(
            `Multiple repositories provide ${ctx.resourceName}:\n${matching
              .map((repo) => ` - ${repo.repository}`)
              .join(
                "\n"
              )}\nPlease specify which repository using the --repo option`
          );
        }

        ctx.resource = matching[0];

        if (!ctx.resource) {
          throw new Error(
            `Resource "${ctx.resourceName}" does not exist in the config file`
          );
        }

        ctx.alreadyEnabled = !!ctx.resource.enabled;
      },
    },
    {
      title: "Update config file",
      skip: (ctx) => ctx.enabled === ctx.alreadyEnabled,
      task: async (ctx) => {
        const updatedConfig: ConfigFile = {
          ...ctx.config!,
          resources: ctx.config!.resources.map((res) =>
            res === ctx.resource ? { ...res, enabled: args.enabled } : res
          ),
        };

        await saveConfigFile(ctx.configPath, updatedConfig);
      },
    },
  ]).run({
    configPath: args.config,
    resourceName: args.resource,
    repositoryIdentifer: args.repo,
    enabled: args.enabled,
  });
}
