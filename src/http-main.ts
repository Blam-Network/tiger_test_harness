import "dotenv/config";
import { createTigerHttpServer } from "./create-tiger-http-server";
import { stopEventsOnSignal } from "./utils/events";

async function bootstrap() {
  stopEventsOnSignal();
  await createTigerHttpServer();
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[web-tiger] http failed to start", err);
  process.exit(1);
});
