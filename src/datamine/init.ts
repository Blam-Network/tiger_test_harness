import * as http from "node:http";
import { event_message } from "@blamnetwork/datamine";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import express from "express";
import { activeBuild } from "../builds";
import { loadWebTigerEnv, resolveHostname } from "../env";
import { ShutdownObserver } from "../shutdown-observer";
import { startEvents } from "../utils/events";
import { nestLogger } from "../utils/logger";
import { resolveDatamineHttpPorts } from "./constants";
import { DatamineModule } from "./datamine.module";

export async function createDatamineServer(opts?: {
  ports?: number[];
  hostname?: string;
}): Promise<http.Server[]> {
  loadWebTigerEnv();
  await startEvents();
  const ports = opts?.ports ?? resolveDatamineHttpPorts();
  const hostname = opts?.hostname ?? resolveHostname();

  const server = express();
  // Client PUTs binary datamine blobs; keep the body as raw bytes.
  server.use(express.raw({ type: () => true, limit: "32mb" }));

  const app = await NestFactory.create(
    DatamineModule,
    new ExpressAdapter(server),
    { bodyParser: false, logger: nestLogger }
  );

  const config = new DocumentBuilder()
    .setTitle("BNET - Tiger Datamine / Ticket Server")
    .setVersion(activeBuild())
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api", app, document);

  app.enableCors();
  await app.init();

  const shutdownObserver = app.get(ShutdownObserver);
  const httpServers = ports.map((port) => {
    const httpServer = http.createServer(server).listen(port, hostname);
    shutdownObserver.addHttpServer(httpServer);
    return httpServer;
  });

  event_message("datamine: Listening on ports: %s", ports.toString());

  return httpServers;
}
