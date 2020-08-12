# kuruma-cli

> Command-line package manager for FiveM servers

## Design Principles

 - User-friendly and intuitive
 - Clear error messages
 - Deterministic behaviour
 - Sensible defaults, flexible overrides

## Capabilities

 - Install one or more modules from a GitHub repository
 - Analyze repository to determine module paths
 - Download repo bundle to local cache
 - Symlink module into its intended location
 - (Maybe in the future) specify and read a module manifest

## Usage

### Install a module

```sh
# install the latest tagged version of a module
krm add jimmed/my-fivem-module

# install a tagged version of a module
krm add jimmed/my-fivem-module@v1.2.0

# install a module from a branch
krm add jimmed/my-fivem-module@master
```

### List installed modules

```sh
krm ls
# or
krm list
```

### Remove a module

```sh
# remove a module by org and repo
krm remove jimmed/my-fivem-module

# remove a module by name
krm remove my-fivem-module
```
