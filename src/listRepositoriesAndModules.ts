import { getConfig } from "./lib/configFile";

interface ListRepositoriesAndModulesArgs {
  config: string;
  modules: boolean;
  repositories: boolean;
}

export async function listRepositoriesAndModules({
  config,
  modules,
  repositories,
}: ListRepositoriesAndModulesArgs) {
  const manifest = await getConfig(config);
  if (repositories) {
    if (!manifest.repositories.length) {
      console.warn("No repositories defined in config");
    } else {
      console.log("Subscribed repositories:");
      console.table(manifest.repositories);
    }
  }
  if (modules) {
    if (!manifest.modules.length) {
      console.warn("No modules defined in config");
    } else {
      console.log("Installed modules:");
      console.table(manifest.modules);
    }
  }
}
