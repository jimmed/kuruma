import { resolve } from "path";
import yargs from "yargs";
import { listRepositoriesAndModules } from "./listRepositoriesAndModules";
import {
  subscribeToRepository,
  unsubscribeFromRepository,
} from "./subscribeToRepository";
import { syncRepositories } from "./syncRepositories";

yargs
  .option("verbose", {
    alias: "v",
    type: "boolean",
    default: false,
    description: "Run with verbose logging",
  })
  .option("config", {
    alias: "c",
    type: "string",
    default: resolve(process.cwd(), "fvm.yml"),
    describe: "Path to fvm.yml file",
  })
  .option("cache", {
    alias: "C",
    type: "string",
    default: resolve(process.cwd(), "cache"),
    describe: "Path to cache directory",
  })
  .command(
    "list",
    "lists all repositories and modules",
    (yargs) =>
      yargs
        .option("modules", {
          alias: "m",
          type: "boolean",
          default: true,
          describe: "list modules",
        })
        .option("repositories", {
          alias: "r",
          type: "boolean",
          default: true,
          describe: "list repositories",
        }),
    listRepositoriesAndModules
  )
  .command(
    "subscribe <repo>",
    "subscribe to a new repository",
    (yargs) => yargs.positional("repo", { type: "string", demandOption: true }),
    subscribeToRepository
  )
  .command(
    "unsubscribe <repo>",
    "unsubscribe from a new repository",
    (yargs) => yargs.positional("repo", { type: "string", demandOption: true }),
    unsubscribeFromRepository
  )
  .command(
    "sync",
    "synchronize repositories and modules",
    () => {},
    syncRepositories
  )
  .demandCommand().argv;
