import * as net from "node:net";
import { Inject, Injectable } from "@nestjs/common";
import type ILogger from "../ILogger";
import { ILoggerSymbol } from "../ILogger";
import { ShutdownObserver } from "../ShutdownObserver";
import { BAP_SIGNON_IP, BAP_SIGNON_PORT } from "./config";
import { BungieAccessProtocolSession } from "./session";

@Injectable()
export class BungieAccessProtocolServerService {
  private server?: net.Server;

  constructor(
    @Inject(ILoggerSymbol) private readonly logger: ILogger,
    private readonly shutdownObserver: ShutdownObserver
  ) {}

  listen(opts?: { port?: number; hostname?: string }): Promise<net.Server> {
    const port = opts?.port ?? BAP_SIGNON_PORT;
    const hostname = opts?.hostname ?? process.env.HOSTNAME ?? BAP_SIGNON_IP;

    return new Promise((resolve, reject) => {
      const server = net.createServer((socket) => {
        new BungieAccessProtocolSession(socket, this.logger);
      });

      server.once("error", reject);
      server.listen(port, hostname, () => {
        this.server = server;
        this.shutdownObserver.addTcpServer(server);
        this.logger.log(
          `Bungie Access Protocol listening on ${hostname}:${port}`
        );
        resolve(server);
      });
    });
  }
}
