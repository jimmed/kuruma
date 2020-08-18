import Listr from "listr";
import { ConfigFile, getConfig, saveConfigFile } from "../lib/configFile";
import { getRepoIdentifier, SubscribeToRepositoryArgs } from "./subscribe";

export async function unsubscribeFromRepository({
  repo: url,
  config: configPath,
}: SubscribeToRepositoryArgs) {
  const { owner, repo } = getRepoIdentifier(url);
  return new Listr<{
    configPath: string;
    config?: ConfigFile;
    owner: string;
    repo: string;
    alreadySubscribed?: boolean;
  }>([
    {
      title: "Read config file",
      task: async (ctx) => {
        ctx.config = await getConfig(ctx.configPath);
      },
    },
    {
      title: "Check if subscribed",
      task: (ctx) => {
        ctx.alreadySubscribed = ctx.config!.repositories.some(
          (r) => r.name === repo && r.org === owner
        );
      },
    },
    {
      title: "Update config file",
      task: async (ctx) => {
        ctx.config!.repositories = ctx.config!.repositories.filter(
          (x) => x.org !== ctx.owner && x.name !== ctx.repo
        );
        ctx.config!.resources = ctx.config!.resources.filter(
          (x) => x.repository === `${ctx.owner}/${ctx.repo}`
        );
        await saveConfigFile(configPath, ctx.config!);
      },
      skip: (ctx) => !ctx.alreadySubscribed,
    },
  ]).run({ owner, repo, configPath });
}
