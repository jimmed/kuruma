#!/usr/bin/env node
import { resolve } from "path";
import yargs from "yargs";
import { listRepositoriesAndModules } from "./command/list";
import {
  subscribeToRepository,
  unsubscribeFromRepository,
} from "./command/subscribe";
import { sync } from "./command/sync";
import { drawDependencyTree } from "./command/tree";
import { outputLoadOrder } from "./command/loadOrder";

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
  .command("sync", "synchronize repositories and modules", () => {}, sync)
  .command(
    "tree",
    "lists the dependency tree of all modules",
    () => {},
    drawDependencyTree
  )
  .command(
    "load-order",
    "lists the load order of modules",
    () => {},
    outputLoadOrder
  )
  .demandCommand().argv;
