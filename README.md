# kuruma-cli

> Command-line package manager for FiveM/RedM servers

## Overview

Kuruma is designed around **reproducibility**. It lets you create reproducible FiveM server setups by tracking what you've installed in a (mostly) human-readable file.

All of the the main commands work by making changes to your Kuruma config file. The only exception to this is the `sync` command, which inspects your Kuruma config file, and compares it to what is currently installed in your FiveM server's resources folder, and ensures that required resources are installed.

## Installation

You can install Kuruma in the terminal using [yarn](https://yarnpkg.com).

```
yarn global add kuruma-cli
```

## Usage

You can run Kuruma in the terminal using either `kuruma` or `krm`:

```sh
kuruma [command]
# or
krm [command]
```

Running without a command will show information on how to use Kuruma.

### GitHub Token

Some commands access the GitHub API. While this can be used without authentication, there are harsh rate limits on unauthenticated API requests.

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

### Disable a resource

Disabling a resource will update the Kuruma config file to show that we want to make sure the resource is removed when we next run the `sync` command.

```bash
kuruma disable extendedmode
```

### Synchronising resources

Once you have subscribed to some repositories, and enabled some resources from them, the final step is to synchronise the resources listed in your config file with what's actually installed.

- Any repositories you've subscribed to that have not been downloaded locally yet will be downloaded
- Any repositories you're no longer subscribed to will be deleted
- Any resources you've enabled that aren't installed yet will be copied from their repository
- Any resources you've disabled that are still installed will be deleted

```bash
kuruma sync
```

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

For convenience (and upgrading an existing server), the `kuruma.yml` file is also copied into the resources folder.

Note that it is possible (and highly recommended) to provide your GitHub auth token as a build argument.

In the future, a pre-built public image may be provided to make this easier.
