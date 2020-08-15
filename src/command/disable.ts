import { setResourceEnabled } from "../lib/setEnabled";

export interface DisableResourceArgs {
  config: string;
  resource: string;
}

export async function disableResource(
  args: DisableResourceArgs
): Promise<void> {
  return setResourceEnabled({ ...args, enabled: false });
}
