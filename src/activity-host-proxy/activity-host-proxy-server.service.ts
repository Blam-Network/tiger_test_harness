import * as net from "node:net";
import { Inject, Injectable } from "@nestjs/common";
import type ILogger from "../ILogger";
import { ILoggerSymbol } from "../ILogger";
import { ShutdownObserver } from "../ShutdownObserver";
import { ActivityHostManager } from "./activity-host-manager";
import { ACTIVITY_HOST_PROXY_IP, ACTIVITY_HOST_PROXY_PORT } from "./config";
import { ActivityHostProxySession } from "./session";

@Injectable()
export class ActivityHostProxyServerService {
  private server?: net.Server;

  constructor(
    @Inject(ILoggerSymbol) private readonly logger: ILogger,
    private readonly shutdownObserver: ShutdownObserver,
    private readonly manager: ActivityHostManager
  ) {}

  listen(opts?: { port?: number; hostname?: string }): Promise<net.Server> {
    const port = opts?.port ?? ACTIVITY_HOST_PROXY_PORT;
    const hostname =
      opts?.hostname ?? process.env.HOSTNAME ?? ACTIVITY_HOST_PROXY_IP;

    return new Promise((resolve, reject) => {
      const server = net.createServer((socket) => {
        new ActivityHostProxySession(socket, this.logger, this.manager);
      });

      server.once("error", reject);
      server.listen(port, hostname, () => {
        this.server = server;
        this.shutdownObserver.addTcpServer(server);
        this.logger.log(`Activity Host Proxy listening on ${hostname}:${port}`);
        resolve(server);
      });
    });
  }
}
