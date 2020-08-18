import { matches } from "lodash";
import { ConfigManager } from "./ConfigManager";
import { Repository, RepositoryMatcher } from "./Repository";

export class RepositoryManager {
  constructor(private config: ConfigManager) {}

  public async getAll() {
    const { repositories } = await this.config.get();
    return repositories.map(Repository.fromDefinition);
  }

  public async find(matcher: RepositoryMatcher) {
    const all = await this.getAll();
    return all.find(matches(matcher));
  }

  public async findRemote(matcher: RepositoryMatcher) {
    return Repository.fromRemote(matcher);
  }

  async subscribeToRepository(
    source: RepositoryMatcher,
    enableResources = false
  ) {
    const existing = await this.find({
      owner: source.owner,
      name: source.name,
    });

    if (existing) {
      throw new Error(`Already subscribed to ${existing.identifier}`);
    }

    const newRepo = await this.findRemote(source);
    const resources = await newRepo.getRemoteResources();

    await this.config.update((config) => {
      config.repositories.push(newRepo.source);
      config.resources.push(
        ...resources.map((resource) => ({
          repository: newRepo.identifier,
          path: resource.path,
          enabled: enableResources,
        }))
      );
    });

    return newRepo;
  }

  async unsubscribeFromRepository(source: RepositoryMatcher) {
    const existing = await this.find({
      owner: source.owner,
      name: source.name,
    });
    if (!existing) {
      throw new Error(`Not subscribed to ${source.owner}/${source.name}`);
    }

    await this.config.update((config) => {
      config.repositories = config.repositories.filter((repo) => {
        repo.owner !== existing.owner || repo.name !== existing.name;
      });
      config.resources = config.resources.filter((resource) => {
        resource.repository !== existing.identifier;
      });
    });
  }
}
