import "dotenv/config";
import { createTigerGameServer } from "./create-tiger-game-server";
import { stopEventsOnSignal } from "./utils/events";

// Optional game-TCP-only entry. Prefer `main` / `npm run start:dev`.
async function bootstrap() {
  stopEventsOnSignal();
  await createTigerGameServer();
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[web-tiger] game server failed to start", err);
  process.exit(1);
});
