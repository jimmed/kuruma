import { getConfig } from "../lib/configFile";

interface ListRepositoriesAndResourcesArgs {
  config: string;
  resources: boolean;
  repositories: boolean;
}

export async function listRepositoriesAndResources({
  config,
  resources,
  repositories,
}: ListRepositoriesAndResourcesArgs) {
  const manifest = await getConfig(config);
  if (repositories) {
    if (!manifest.repositories.length) {
      console.warn("No repositories defined in config");
    } else {
      console.log("Subscribed repositories:");
      manifest.repositories.forEach((repo) => {
        console.log(` - ${repo.org}/${repo.name} (${repo.sha.slice(0, 7)})`);
      });
    }
  }
  if (resources) {
    if (resources && repositories) console.log();
    if (!manifest.resources.length) {
      console.warn("No resources defined in config");
    } else {
      console.log("Available resources:");
      manifest.resources.forEach((resource) => {
        console.log(
          ` - ${resource.repository}${
            resource.path ? "/" + resource.path : ""
          }`,
          resource.enabled ? "(enabled)" : ""
        );
      });
    }
  }
}
