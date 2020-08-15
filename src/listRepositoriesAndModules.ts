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
      manifest.repositories.forEach((repo) => {
        console.log(` - ${repo.org}/${repo.name} (${repo.sha.slice(0, 7)})`);
      });
    }
  }
  if (modules) {
    if (modules && repositories) console.log();
    if (!manifest.modules.length) {
      console.warn("No modules defined in config");
    } else {
      console.log("Available modules:");
      manifest.modules.forEach((module) => {
        console.log(
          ` - ${module.repository}${module.path ? "/" + module.path : ""}`,
          module.enabled ? "(enabled)" : ""
        );
      });
    }
  }
}
