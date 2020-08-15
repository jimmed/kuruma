import { setResourceEnabled } from "../lib/setEnabled";

export interface EnableResourceArgs {
  config: string;
  resource: string;
}

export async function enableResource(args: EnableResourceArgs): Promise<void> {
  return setResourceEnabled({ ...args, enabled: true });
}
