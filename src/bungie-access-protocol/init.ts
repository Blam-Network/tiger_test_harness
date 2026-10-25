import type * as net from "node:net";
import { NestFactory } from "@nestjs/core";
import { startEvents } from "../utils/events";
import { nestLogger } from "../utils/logger";
import { BungieAccessProtocolModule } from "./bungie-access-protocol.module";
import { BungieAccessProtocolServerService } from "./bungie-access-protocol-server.service";
import { BAP_SIGNON_PORT } from "./config";

export async function createBungieAccessProtocolServer(opts?: {
  port?: number;
  hostname?: string;
}): Promise<net.Server> {
  await startEvents();
  const app = await NestFactory.createApplicationContext(
    BungieAccessProtocolModule,
    { logger: nestLogger }
  );

  const service = app.get(BungieAccessProtocolServerService);
  return service.listen({
    port: opts?.port ?? BAP_SIGNON_PORT,
    hostname: opts?.hostname,
  });
}
