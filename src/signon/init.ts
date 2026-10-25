import * as http from "node:http";
import { event_message, event_status } from "@blamnetwork/datamine";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import express from "express";
import { activeBuild } from "../builds";
import { resolveHostname } from "../env";
import { ShutdownObserver } from "../shutdown-observer";
import { startEvents } from "../utils/events";
import { nestLogger } from "../utils/logger";
import { resolveSignonHttpPorts } from "./constants";
import { SignonModule } from "./signon.module";

export async function createSignonServer(opts?: {
  ports?: number[];
  hostname?: string;
}): Promise<http.Server[]> {
  await startEvents();
  const ports = opts?.ports ?? resolveSignonHttpPorts();
  const hostname = opts?.hostname ?? resolveHostname();

  const server = express();
  // XHTTP GET /signon still carries a protobuf body; keep it as raw bytes.
  server.use(express.raw({ type: () => true, limit: "1mb" }));

  // Every XHttp request the console makes lands on this port (signon, and
  // Demonware auth at /auth/), so log them all to the file, 404s included.
  server.use((req, res, next) => {
    res.on("finish", () => {
      const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      // Demonware auth is JSON; show it. SignOn logs its own protobuf.
      const text = req.is("application/json")
        ? ` ${body.toString("utf8")}`
        : "";
      event_status(
        "http: %s %s host=%s %d body=%dB%s",
        req.method,
        req.originalUrl,
        req.headers.host,
        res.statusCode,
        body.length,
        text
      );
    });
    next();
  });

  const app = await NestFactory.create(
    SignonModule,
    new ExpressAdapter(server),
    { bodyParser: false, logger: nestLogger }
  );

  const config = new DocumentBuilder()
    .setTitle("BNET - Tiger Sign-on Server")
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

  event_message("signon: Listening on ports: %s", ports.toString());

  return httpServers;
}
