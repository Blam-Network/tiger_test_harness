import * as net from "node:net";
import { event_message } from "@blamnetwork/datamine";
import { Injectable, type OnApplicationShutdown } from "@nestjs/common";
import { resolveHostname } from "../env";
import { ShutdownObserver } from "../shutdown-observer";
import { ActivityHostManager } from "./activity-host-manager";
import {
  ACTIVITY_HOST_PROXY_BIND_IP,
  ACTIVITY_HOST_PROXY_PORT,
} from "./config";
import { type ScriptBuild, startScriptBuild } from "./script-host/script-build";
import { ActivityHostProxySession } from "./session";

@Injectable()
export class ActivityHostProxyServerService implements OnApplicationShutdown {
  private scripts?: ScriptBuild;

  constructor(
    private readonly shutdownObserver: ShutdownObserver,
    private readonly manager: ActivityHostManager
  ) {}

  listen(opts?: { port?: number; hostname?: string }): Promise<net.Server> {
    const port = opts?.port ?? ACTIVITY_HOST_PROXY_PORT;
    const hostname =
      opts?.hostname ?? resolveHostname() ?? ACTIVITY_HOST_PROXY_BIND_IP;
    // The hosts' scripts are built here (the executable loads its prebuilt
    // ones), before a client can connect, and rebuilt on every edit. Bad scripts throw,
    // so the server does not come up on them.
    this.scripts ??= startScriptBuild();

    return new Promise((resolve, reject) => {
      const server = net.createServer((socket) => {
        new ActivityHostProxySession(socket, this.manager);
      });

      server.once("error", reject);
      server.listen(port, hostname, () => {
        this.shutdownObserver.addTcpServer(server);
        event_message(
          "activities:host: Activity Host Proxy listening on %s:%d",
          hostname,
          port
        );
        resolve(server);
      });
    });
  }

  onApplicationShutdown(): void {
    this.scripts?.close();
  }
}
