import "dotenv/config";
import { event_message } from "@blamnetwork/datamine";
import { VERSION_LINE } from "./build-info";
import { createTigerServer } from "./create-tiger-server";
import { startEvents, stopEventsOnSignal } from "./utils/events";

async function bootstrap() {
  stopEventsOnSignal();
  await startEvents();
  event_message("lifecycle: %s", VERSION_LINE);
  await createTigerServer();
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[web-tiger] failed to start", err);
  process.exit(1);
});
