import { ConfigFile, getConfig, saveConfigFile } from "../lib/configFile";
import { getRepoIdentifier, SubscribeToRepositoryArgs } from "./subscribe";

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

  // TODO: Delete child resources from config
  const newConfig: ConfigFile = {
    ...currentConfig,
    repositories: currentConfig.repositories.filter(
      (x) => x.org !== owner && x.name !== "repo"
    ),
  };

  await saveConfigFile(configPath, newConfig);

  console.log(`Unsubscribed from ${owner}/${repo}`);
}
