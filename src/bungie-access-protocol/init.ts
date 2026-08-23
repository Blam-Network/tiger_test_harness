import type * as net from "node:net";
import { NestFactory } from "@nestjs/core";
import { BungieAccessProtocolModule } from "./bungie-access-protocol.module";
import { BungieAccessProtocolServerService } from "./bungie-access-protocol-server.service";
import { BAP_SIGNON_PORT } from "./config";

export async function createBungieAccessProtocolServer(opts?: {
  port?: number;
  hostname?: string;
}): Promise<net.Server> {
  const app = await NestFactory.createApplicationContext(
    BungieAccessProtocolModule,
    {
      logger: false,
    }
  );

  const service = app.get(BungieAccessProtocolServerService);
  return service.listen({
    port: opts?.port ?? BAP_SIGNON_PORT,
    hostname: opts?.hostname,
  });
}
