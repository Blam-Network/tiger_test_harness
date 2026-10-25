import type * as net from "node:net";
import { NestFactory } from "@nestjs/core";
import { startEvents } from "../utils/events";
import { nestLogger } from "../utils/logger";
import { resolveDemonwareLobbyPorts } from "./config";
import { DemonwareModule } from "./demonware.module";
import { DemonwareServerService } from "./demonware-server.service";

export async function createDemonwareServer(opts?: {
  ports?: number[];
  hostname?: string;
}): Promise<net.Server[]> {
  await startEvents();
  const app = await NestFactory.createApplicationContext(DemonwareModule, {
    logger: nestLogger,
  });

  const service = app.get(DemonwareServerService);
  return service.listen({
    ports: opts?.ports ?? resolveDemonwareLobbyPorts(),
    hostname: opts?.hostname,
  });
}
