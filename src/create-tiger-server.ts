import { createActivityHostProxyServer } from "./activity-host-proxy/init";
import { createBungieAccessProtocolServer } from "./bungie-access-protocol/init";
import { createDatamineServer } from "./datamine/init";
import { createDemonwareServer } from "./demonware/init";
import { loadWebTigerEnv } from "./env";
import { createSignonServer } from "./signon/init";

export async function createTigerServer(opts?: {
  hostname?: string;
}): Promise<void> {
  loadWebTigerEnv();
  // BORDER
  await createSignonServer({ hostname: opts?.hostname });
  await createDatamineServer({ hostname: opts?.hostname });
  await createBungieAccessProtocolServer({ hostname: opts?.hostname });
  await createActivityHostProxyServer({ hostname: opts?.hostname });
  await createDemonwareServer({ hostname: opts?.hostname });
}
