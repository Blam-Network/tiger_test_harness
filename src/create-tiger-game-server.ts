import { event_warning } from "@blamnetwork/datamine";
import { createActivityHostProxyServer } from "./activity-host-proxy/init";
import { logActiveBuild } from "./builds";
import { createBungieAccessProtocolServer } from "./bungie-access-protocol/init";
import { createDebugServer } from "./debug/debug-server";
import { createDemonwareServer } from "./demonware/init";
import { loadWebTigerEnv } from "./env";
import { startEvents } from "./utils/events";

// Guest TCP (BAP / AH / Demonware). Nest --watch restarts this with the
// process, which drops any live session.
export async function createTigerGameServer(opts?: {
  hostname?: string;
}): Promise<void> {
  loadWebTigerEnv();
  await startEvents();
  logActiveBuild();
  await createBungieAccessProtocolServer({ hostname: opts?.hostname });
  await createActivityHostProxyServer({ hostname: opts?.hostname });
  await createDemonwareServer({ hostname: opts?.hostname });
  // The script debugger reads this process's live state, so it runs here,
  // next to the guest servers. A failure to bind (port taken) must not take the
  // game server down with it.
  await createDebugServer().catch((err: unknown) => {
    event_warning(
      "debug: Debug server not started: %s",
      err instanceof Error ? err.message : String(err)
    );
  });
}
