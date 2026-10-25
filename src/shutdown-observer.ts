import type * as http from "node:http";
import type * as net from "node:net";
import {
  Injectable,
  type OnApplicationShutdown,
  type OnModuleInit,
} from "@nestjs/common";
import { startEvents, stopEvents } from "./utils/events";

function closeServer(server: net.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

// Closes the listeners it was handed, and brackets the events the same way:
// a Nest app embedding these modules gets events without calling a factory.
// Both are no-ops for events somebody else started.
@Injectable()
export class ShutdownObserver implements OnModuleInit, OnApplicationShutdown {
  private readonly httpServers: http.Server[] = [];
  private readonly tcpServers: net.Server[] = [];
  private readonly closeables: { close(): void }[] = [];

  public addHttpServer(server: http.Server): void {
    this.httpServers.push(server);
  }

  public addTcpServer(server: net.Server): void {
    this.tcpServers.push(server);
  }

  // Anything else to close on shutdown (UDP sockets).
  public addCloseable(closeable: { close(): void }): void {
    this.closeables.push(closeable);
  }

  public onModuleInit(): Promise<void> {
    return startEvents();
  }

  public async onApplicationShutdown(): Promise<void> {
    for (const closeable of this.closeables) {
      closeable.close();
    }
    await Promise.all(
      [...this.httpServers, ...this.tcpServers].map(closeServer)
    );
    await stopEvents();
  }
}
