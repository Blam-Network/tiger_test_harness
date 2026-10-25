import * as net from "node:net";
import { event_message } from "@blamnetwork/datamine";
import { Inject, Injectable } from "@nestjs/common";
import { resolveHostname } from "../env";
import {
  type CharacterStore,
  CharacterStoreToken,
} from "../investment/character-store";
import { ShutdownObserver } from "../shutdown-observer";
import { BAP_BIND_IP, BAP_SIGNON_PORT } from "./config";
import { BungieAccessProtocolSession } from "./session";

@Injectable()
export class BungieAccessProtocolServerService {
  constructor(
    private readonly shutdownObserver: ShutdownObserver,
    @Inject(CharacterStoreToken) private readonly store: CharacterStore
  ) {}

  listen(opts?: { port?: number; hostname?: string }): Promise<net.Server> {
    const port = opts?.port ?? BAP_SIGNON_PORT;
    const hostname = opts?.hostname ?? resolveHostname() ?? BAP_BIND_IP;

    return new Promise((resolve, reject) => {
      const server = net.createServer((socket) => {
        new BungieAccessProtocolSession(socket, this.store);
      });

      server.once("error", reject);
      server.listen(port, hostname, () => {
        this.shutdownObserver.addTcpServer(server);
        event_message(
          "networking:bap: Bungie Access Protocol listening on %s:%d",
          hostname,
          port
        );
        resolve(server);
      });
    });
  }
}
