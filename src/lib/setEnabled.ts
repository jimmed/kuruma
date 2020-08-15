import { getConfig, ConfigFile, saveConfigFile } from "../lib/configFile";

export interface SetResourceEnabledArgs {
  config: string;
  resource: string;
  enabled: boolean;
}

export async function setResourceEnabled(
  args: SetResourceEnabledArgs
): Promise<void> {
  const config = await getConfig(args.config);
  const resource = config.resources.find(
    (res) =>
      (res.path ?? res.repository).split("/").slice(-1)[0] === args.resource
  );

  if (!resource) {
    throw new Error(
      `Resource "${args.resource}" does not exist within any of the subscribed repositories`
    );
  }

  if (resource.enabled === args.enabled) {
    console.warn(
      `Resource "${args.resource}" is already ${
        args.enabled ? "enabled" : "disabled"
      }`
    );
    return;
  }

  const updatedConfig: ConfigFile = {
    ...config,
    resources: config.resources.map((res) =>
      res === resource ? { ...res, enabled: args.enabled } : res
    ),
  };

  await saveConfigFile(args.config, updatedConfig);

  console.log(
    `${args.enabled ? "Enabled" : "Disabled"} resource "${
      args.resource
    }" from repository "${resource.repository}"`
  );
}
