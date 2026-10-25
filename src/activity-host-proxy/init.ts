import type * as net from "node:net";
import { NestFactory } from "@nestjs/core";
import { startEvents } from "../utils/events";
import { nestLogger } from "../utils/logger";
import { ActivityHostProxyModule } from "./activity-host-proxy.module";
import { ActivityHostProxyServerService } from "./activity-host-proxy-server.service";
import { ACTIVITY_HOST_PROXY_PORT } from "./config";

export async function createActivityHostProxyServer(opts?: {
  port?: number;
  hostname?: string;
}): Promise<net.Server> {
  await startEvents();
  const app = await NestFactory.createApplicationContext(
    ActivityHostProxyModule,
    { logger: nestLogger }
  );

  const service = app.get(ActivityHostProxyServerService);
  return service.listen({
    port: opts?.port ?? ACTIVITY_HOST_PROXY_PORT,
    hostname: opts?.hostname,
  });
}
