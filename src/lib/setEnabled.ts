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
  enabled: boolean;
}

export interface SetResourceEnabledContext {
  configPath: string;
  resourceName: string;
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
        ctx.resource = ctx.config!.resources.find(
          (res) =>
            (res.path ?? res.repository).split("/").slice(-1)[0] ===
            ctx.resourceName
        );

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
    enabled: args.enabled,
  });
}
