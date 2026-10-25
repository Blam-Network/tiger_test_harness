import { logActiveBuild } from "./builds";
import { createDatamineServer } from "./datamine/init";
import { loadWebTigerEnv } from "./env";
import { createSignonServer } from "./signon/init";
import { startEvents } from "./utils/events";

// Nest HTTP (signon / datamine). Safe to --watch; Xenia does not hold these.
export async function createTigerHttpServer(opts?: {
  hostname?: string;
}): Promise<void> {
  loadWebTigerEnv();
  await startEvents();
  logActiveBuild();
  await createSignonServer({ hostname: opts?.hostname });
  await createDatamineServer({ hostname: opts?.hostname });
}
