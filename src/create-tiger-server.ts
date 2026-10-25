import { createTigerGameServer } from "./create-tiger-game-server";
import { createTigerHttpServer } from "./create-tiger-http-server";

// Single-process boot: HTTP + guest TCP (BAP / AH / Demonware).
export async function createTigerServer(opts?: {
  hostname?: string;
}): Promise<void> {
  await createTigerHttpServer(opts);
  await createTigerGameServer(opts);
}
