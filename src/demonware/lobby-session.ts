import type * as net from "node:net";
import {
  event_message,
  event_status,
  event_warning,
} from "@blamnetwork/datamine";
import {
  CLIENT_HEADER_MAGIC,
  DEFAULT_SERVER_MAX_MSG,
  FAKE_CONNECTION_ID,
  MSG_CLIENT_INIT_BLOB,
  MSG_LSG_CONNECTION_ID,
} from "./constants";
import { LOBBY_PROTOCOL_210, Lobby210Connection } from "./lobby-210";
import { dispatchLobbyService } from "./matchmaking";
import { buildConnectionIdFrame } from "./typed-buffer";
import { hexPreview, type LobbyLink, readI32LE, writeI32LE } from "./util";
import { demonwareBuild } from "./versions";

const KEEPALIVE_INTERVAL_MS = 60_000;

// LSG / bdLobbyConnection session. A protocol 210 build runs its handshake
// and records in lobby-210.ts and hands the messages to handleBody. The 200
// flow:
//   1. Client sends 8-byte "200 header": u32le magic=200 | u32le maxRecvBuffer
//   2. Framed messages: u32le size | u8 encryptFlag | body[size-1]
//   3. body[0] is lobby control type or bd* service id
export class LobbySession {
  private buffer: Buffer = Buffer.alloc(0);
  private gotClientHeader = false;
  private clientMaxMsg = DEFAULT_SERVER_MAX_MSG;
  private sentConnectionId = false;
  private readonly remote: string;

  constructor(private readonly socket: net.Socket) {
    this.remote = `${socket.remoteAddress}:${socket.remotePort}`;
    event_message("demonware:lobby: connect from %s", this.remote);

    socket.on("error", (err) => {
      event_warning(
        "demonware:lobby: socket error (%s): %s",
        this.remote,
        err.message
      );
    });
    // The client drops the lobby after 200 s with nothing received
    // (bdLobbyConnection); an empty frame is the keepalive, in 210 as well
    // (the client sends them).
    const keepalive = setInterval(
      () => socket.write(Buffer.alloc(4)),
      KEEPALIVE_INTERVAL_MS
    );
    socket.on("close", () => {
      clearInterval(keepalive);
      event_message("demonware:lobby: disconnect %s", this.remote);
    });

    // A 210 connection carries no other plaintext frame: its connection id is
    // in the handshake.
    if (demonwareBuild().lobbyProtocol === LOBBY_PROTOCOL_210) {
      this.sentConnectionId = true;
      const connection = new Lobby210Connection(
        socket,
        this.remote,
        FAKE_CONNECTION_ID,
        (body) => this.handleBody(body, connection.link)
      );
      socket.on("data", (chunk) => connection.receive(chunk));
      return;
    }

    socket.on("data", (chunk) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.buffer = this.drain();
    });
  }

  private drain(): Buffer {
    let buffer = this.buffer;

    if (!this.gotClientHeader) {
      if (buffer.length < 8) {
        return buffer;
      }

      const magic = buffer.readUInt32LE(0);
      const maxMsg = buffer.readUInt32LE(4);
      buffer = buffer.subarray(8);

      if (magic === CLIENT_HEADER_MAGIC) {
        this.gotClientHeader = true;
        this.clientMaxMsg = maxMsg || DEFAULT_SERVER_MAX_MSG;
        event_message(
          "demonware:lobby: [%s] 200 client header ok (maxMsg=%d)",
          this.remote,
          this.clientMaxMsg
        );
        this.sendConnectionId();
      } else {
        event_warning(
          "demonware:lobby: [%s] expected 200 client header, got magic=%u (0x%x)",
          this.remote,
          magic,
          magic
        );
        buffer = Buffer.concat([writeI32LE(magic), writeI32LE(maxMsg), buffer]);
        this.gotClientHeader = true;
      }
    }

    while (buffer.length >= 4) {
      const size = readI32LE(buffer, 0);

      if (size <= 0) {
        this.socket.write(Buffer.from([0, 0, 0, 0]));
        buffer = buffer.subarray(4);
        continue;
      }

      if (size === CLIENT_HEADER_MAGIC && !this.sentConnectionId) {
        event_warning(
          "demonware:lobby: [%s] saw size==200 mid-stream — treating as late client header",
          this.remote
        );
        if (buffer.length < 8) {
          return buffer;
        }
        this.clientMaxMsg = buffer.readUInt32LE(4) || DEFAULT_SERVER_MAX_MSG;
        buffer = buffer.subarray(8);
        this.sendConnectionId();
        continue;
      }

      if (size > 0x100000) {
        event_warning(
          "demonware:lobby: [%s] absurd frame size %d — dropping connection",
          this.remote,
          size
        );
        this.socket.destroy();
        return Buffer.alloc(0);
      }

      const total = 4 + size;
      if (buffer.length < total) {
        return buffer;
      }

      const payload = buffer.subarray(4, total);
      buffer = buffer.subarray(total);
      this.handleFrame(size, payload);
    }

    return buffer;
  }

  private sendConnectionId(): void {
    if (this.sentConnectionId) {
      return;
    }
    this.sentConnectionId = true;
    const frame = buildConnectionIdFrame(FAKE_CONNECTION_ID);
    this.socket.write(frame);
    event_message(
      "demonware:lobby: [%s] LSG connection ID (type 4) sent id=0x%I64x frame=%s",
      this.remote,
      FAKE_CONNECTION_ID,
      hexPreview(frame)
    );
  }

  private handleFrame(size: number, payload: Buffer): void {
    if (payload.length < 1) {
      event_warning(
        "demonware:lobby: [%s] empty frame size=%d",
        this.remote,
        size
      );
      return;
    }

    const enc = payload[0]!;
    const body = payload.subarray(1);

    event_status(
      "demonware:lobby: [%s] frame size=%d enc=%d body=%s",
      this.remote,
      size,
      enc,
      hexPreview(body, 96)
    );

    if (enc === 1 || enc === 2) {
      event_warning(
        "demonware:lobby: [%s] encrypted frame (flag=%d) not implemented",
        this.remote,
        enc
      );
      return;
    }

    this.handleBody(body, this.socket);
  }

  // A message: its type, then its data (a 200 frame's body, or a 210
  // record's message).
  private handleBody(body: Buffer, link: LobbyLink): void {
    if (body.length < 1) {
      event_warning(
        "demonware:lobby: [%s] frame missing message type",
        this.remote
      );
      return;
    }

    const msgType = body[0]!;
    const rest = body.subarray(1);

    switch (msgType) {
      case MSG_CLIENT_INIT_BLOB:
        event_message(
          "demonware:lobby: [%s] client init blob (type 7) len=%d data=%s",
          this.remote,
          rest.length,
          hexPreview(rest, 48)
        );
        this.sendConnectionId();
        break;

      case MSG_LSG_CONNECTION_ID:
        event_message(
          "demonware:lobby: [%s] unexpected client connection-id echo? %s",
          this.remote,
          hexPreview(rest)
        );
        break;

      default:
        if (msgType >= 8) {
          dispatchLobbyService(link, this.remote, msgType, rest);
        } else {
          event_warning(
            "demonware:lobby: [%s] unhandled LSG message type=%d rest=%s",
            this.remote,
            msgType,
            hexPreview(rest)
          );
        }
        break;
    }
  }
}
