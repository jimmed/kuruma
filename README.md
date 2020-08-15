# kuruma-cli

> Command-line package manager for FiveM/RedM servers

## Overview

Kuruma is designed around **reproducibility**. It lets you create reproducible FiveM server setups by tracking what you've installed in a (mostly) human-readable file.

All of the the main commands work by making changes to your Kuruma config file. The only exception to this is the `sync` command, which inspects your Kuruma config file, and compares it to what is currently installed in your FiveM server's resources folder, and ensures that required resources are installed.

## Roadmap for v1.0.0

- [x] Subscribe/unsubscribe from repositories
- [x] Synchronise installed modules
- [x] Automatically generate resource load order
- [ ] Enable/disable individual modules
- [ ] Fancy [listr](https://npm.im/listr)-based CLI
- [ ] Internationalisation
- [ ] Automatic server config
- [ ] Database migration capabilities

## Installation

You can install Kuruma in the terminal using [yarn](https://yarnpkg.com).

```bash
yarn global add kuruma-cli
```

## Usage

You can run Kuruma in the terminal using either `kuruma` or `krm`:

```bash
kuruma
# or
krm
```

Running without a command will show information on how to use Kuruma.

### GitHub authentication

Some commands access the GitHub API. While they can be used without authentication, there are harsh rate limits on unauthenticated API requests.

If you want to use Kuruma without hitting GitHub API rate limits, or you want to subscribe to private GitHub repositories, you should supply a GitHub auth token using the `GITHUB_AUTH_TOKEN` environment variable.

### Subscribe to a repository

Subscribing to a repository tells Kuruma that this is somewhere
FiveM resources can be found. It updates the Kuruma config file to include the new repository, as well as all of the resources found within the repo.

```bash
kuruma subscribe extendedmode/extendedmode
# or
kuruma subscribe https://github.com/extendedmode/extendedmode
```

Note that the modules will not be installed until the `sync` command is run.

### Unsubscribe from a repository

Unsubscribing from a repository will remove it from the Kuruma config file, and it will no longer be possible to install FiveM resources from it.

```bash
kuruma unsubscribe extendedmode/extendedmode
# or
kuruma subscribe https://github.com/extendedmode/extendedmode
```

### Enable a resource

Enabling a resource will update the Kuruma config file to show that we want to make sure the resource is installed when we next run the `sync` command.

```bash
kuruma enable extendedmode
```

If the resource depends on other resources that are already available from the subscribed repositories, they will automatically be enabled.

> **Note:** This command is not yet implemented. All resources from all repositories are enabled by default. This will change in a future version.

### Disable a resource

Disabling a resource will update the Kuruma config file to show that we want to make sure the resource is removed when we next run the `sync` command.

```bash
kuruma disable extendedmode
```

> **Note:** This command is not yet implemented. All resources from all repositories are enabled by default. This will change in a future version.

### Synchronising resources

Once you have subscribed to some repositories, and enabled some resources from them, the final step is to synchronise the resources listed in your config file with what's actually installed.

- Any repositories you've subscribed to that have not been downloaded locally yet will be downloaded
- Any repositories you're no longer subscribed to will be deleted
- Any resources you've enabled that aren't installed yet will be copied from their repository
- Any resources you've disabled that are still installed will be deleted

If any resources are missing a dependency, a warning will be shown in the terminal.

```bash
kuruma sync
```

### Generating a load order

If you have enabled a large number of modules, you may find that determining the correct load
order in your `server.cfg` file becomes tedious.

Kuruma can inspect each resource's dependencies, and so it is able to construct a dependency graph based on your enabled modules. Using this, it can determine a load order for you. Run the `load-order` command to try this for yourself.

```bash
kuruma load-order
```

This will output something like:

```sh
# GENERATED BY KURUMA (https://npm.im/kuruma-cli)
start log_info;
start cron;
start async;
start instance;
start esx_datastore;
start skinchanger;
start esx_license;
start esx_status;
start esx_optionalneeds;
start esx_voice;
start esx_sit;
start esx_holdup;
start esx_garage;
start esx_lscustom;
start mysql-async; # provided by fivem-mysql-async
start es_extended; # provided by extendedmode; requires mysql-async
start esx_skin; # requires es_extended, skinchanger
start esx_accessories; # requires es_extended, esx_skin, esx_datastore
start esx_vehicleshop; # requires es_extended
start esx_ambulancejob; # requires es_extended, esx_skin, esx_vehicleshop
```

You can pipe this output into your `server.cfg` using this command:

```bash
kuruma load-order >> ./path/to/server.cfg
```

> **Note:** In order for this to work correctly, resources must correctly specify their `dependency` or `dependencies` in their `fxmanifest.lua` (or `__resource.lua`) file. The ability to manually override module dependencies will be added in a future version.

## Usage with Docker

Kuruma is designed to play nice with Docker, and can be used to build Docker images of your server setup.

### Reproducible server builds

```Dockerfile
FROM node:alpine AS kuruma
ARG GITHUB_AUTH_TOKEN
ENV GITHUB_AUTH_TOKEN=${GITHUB_AUTH_TOKEN}
WORKDIR /resources
RUN yarn global add kuruma-cli
COPY kuruma.yml kuruma.yml
RUN node kuruma sync

FROM spritsail/fivem
COPY server.cfg /config/server.cfg
COPY --from=kuruma /resources /config/resources
```

This Dockerfile installs Kuruma in a temporary build container, and uses the `sync` command to install the required resources. It then copies these into the final server image, along with your `server.cfg`.

For convenience, the `kuruma.yml` file is also copied into the resources folder.

Note that it is possible (and highly recommended) to provide your GitHub auth token as a build argument.

In the future, a pre-built public image may be provided to make this easier.
