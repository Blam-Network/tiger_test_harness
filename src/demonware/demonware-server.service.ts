import * as net from "node:net";
import { event_message } from "@blamnetwork/datamine";
import { Injectable } from "@nestjs/common";
import { ShutdownObserver } from "../shutdown-observer";
import { DEMONWARE_BIND_HOST, resolveDemonwareLobbyPorts } from "./config";
import { LobbySession } from "./lobby-session";
import { NatDiscoveryServer } from "./nat-discovery";
import { demonwareBuild } from "./versions";

@Injectable()
export class DemonwareServerService {
  private readonly servers: net.Server[] = [];

  constructor(private readonly shutdownObserver: ShutdownObserver) {}

  async listen(opts?: {
    ports?: number[];
    hostname?: string;
  }): Promise<net.Server[]> {
    const ports = opts?.ports ?? resolveDemonwareLobbyPorts();
    const hostname = opts?.hostname ?? DEMONWARE_BIND_HOST;
    const natPorts = demonwareBuild().natDiscoveryPorts;
    const nat = natPorts && new NatDiscoveryServer(hostname, natPorts);
    if (nat) {
      this.shutdownObserver.addCloseable(nat);
    }

    const servers = await Promise.all(
      ports.map((port) => this.listenOne(port, hostname))
    );
    await nat?.listen();
    return servers;
  }

  private listenOne(port: number, hostname: string): Promise<net.Server> {
    return new Promise((resolve, reject) => {
      const server = net.createServer((socket) => {
        new LobbySession(socket);
      });

      server.once("error", reject);
      server.listen(port, hostname, () => {
        this.servers.push(server);
        this.shutdownObserver.addTcpServer(server);
        event_message(
          "demonware:lobby: Demonware lobby TCP listening on %s:%d",
          hostname,
          port
        );
        resolve(server);
      });
    });
  }
}
