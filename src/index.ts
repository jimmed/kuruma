#!/usr/bin/env node
import { resolve } from "path";
import yargs from "yargs";
import { disableResource } from "./command/disable";
import { enableResource } from "./command/enable";
import { listRepositoriesAndResources } from "./command/list";
import { outputLoadOrder } from "./command/loadOrder";
import { subscribeToRepository } from "./command/subscribe";
import { sync } from "./command/sync";
import { drawDependencyTree } from "./command/tree";
import { unsubscribeFromRepository } from "./command/unsubscribe";

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
    default: resolve(process.cwd(), "kuruma.yml"),
    describe: "Path to kuruma.yml file",
  })
  .option("cache", {
    alias: "C",
    type: "string",
    default: resolve(process.cwd(), "cache"),
    describe: "Path to cache directory",
  })
  .option("target", {
    alias: "t",
    type: "string",
    default: resolve(process.cwd(), "resources"),
    describe: "Path to target output directory",
  })
  .command(
    "list",
    "lists all repositories and resources",
    (yargs) =>
      yargs
        .option("resources", {
          alias: "R",
          type: "boolean",
          default: true,
          describe: "list resources",
        })
        .option("repositories", {
          alias: "r",
          type: "boolean",
          default: true,
          describe: "list repositories",
        }),
    listRepositoriesAndResources
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
    "enable <resource>",
    "enable a resource",
    (yargs) =>
      yargs.positional("resource", { type: "string", demandOption: true }),
    enableResource
  )
  .command(
    "disable <resource>",
    "disable a resource",
    (yargs) =>
      yargs.positional("resource", { type: "string", demandOption: true }),
    disableResource
  )
  .command("sync", "synchronize repositories and resources", () => {}, sync)
  .command(
    "tree",
    "lists the dependency tree of all resources",
    () => {},
    drawDependencyTree
  )
  .command(
    "load-order",
    "lists the load order of resources",
    () => {},
    outputLoadOrder
  )
  .demandCommand().argv;
