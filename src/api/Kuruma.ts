import { ConfigManager } from "./ConfigManager";
import { RepositoryManager } from "./RepositoryManager";

export interface KurumaPaths {
  cache: string;
  config: string;
  target: string;
}

export class Kuruma {
  public readonly config = new ConfigManager(this.paths.config);
  public readonly repositories = new RepositoryManager(this.config);
  constructor(private paths: KurumaPaths) {}
}
