import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
} from "node:crypto";
import type * as net from "node:net";
import {
  event_message,
  event_status,
  event_warning,
} from "@blamnetwork/datamine";
import { authSessions } from "./auth";
import { hexPreview, type LobbyLink } from "./util";

// Demonware lobby protocol 210 (bdLobbyConnection, DW 36), the PS4 builds'.
// Frames are u32le length | 0xAB | type | payload, the length counting from
// the marker:
//   - client header, raw 28 bytes: u32 200, 200, 210, 210, u32 (true meaning
//     unknown), u64 client nonce
//   - 0x81 server_header_ack: u32 210, u64 connection id, u64 server nonce. A
//     type 4 frame instead is "server too old".
//   - 0x82 client_auth: the client's bit-packed auth body (it holds our server
//     ticket), then its 8-byte challenge
//   - 0x83 server_auth_done: the 8-byte proof
//   - 0x84 error: u32 reason
//   - 0x85 record: u32 sequence (from 1, per direction), 16-byte IV,
//     AES-128-CBC ciphertext of u32 length | u8 type | message, zero padded,
//     then the first 8 bytes of an HMAC-SHA1 over the frame up to the tag
//
// Keys (libtomcrypt): HKDF over HMAC-SHA1, salt = SHA-1 of the handshake
// (client header from byte 8, the ack frame, the client_auth frame without
// its challenge), input = the 24-byte session key Demonware auth handed out.
// "CLIENTCHAL" expands to the challenge and the proof; "BDDATA" to the client
// and server MAC keys (20 bytes each), then the client and server AES keys.

export const LOBBY_PROTOCOL_210 = 210;
const CLIENT_HEADER_SIZE = 28;
const FRAME_MARKER = 0xab;
const FRAME_SERVER_HEADER_ACK = 0x81;
export const FRAME_CLIENT_AUTH = 0x82;
const FRAME_SERVER_AUTH_DONE = 0x83;
const FRAME_ERROR = 0x84;
const FRAME_RECORD = 0x85;
// The type every client record carries; its message starts with the 200
// protocol's body (service id first).
export const CLIENT_RECORD_TYPE = 0x86;
const CHALLENGE_SIZE = 8;
const TAG_SIZE = 8;
const IV_SIZE = 16;
const BLOCK = 16;

interface LobbyKeys {
  challenge: Buffer;
  clientKey: Buffer;
  clientMac: Buffer;
  proof: Buffer;
  serverKey: Buffer;
  serverMac: Buffer;
}

function hmac(key: Buffer, data: Buffer): Buffer {
  return createHmac("sha1", key).update(data).digest();
}

// The client's expand is RFC 5869's: T(n) = HMAC(PRK, T(n-1) |
// info | n).
function hkdf(salt: Buffer, sessionKey: Buffer, info: string, length: number) {
  return Buffer.from(hkdfSync("sha1", sessionKey, salt, info, length));
}

export function deriveLobbyKeys(
  transcript: Buffer,
  sessionKey: Buffer
): LobbyKeys {
  const salt = createHash("sha1").update(transcript).digest();
  const chal = hkdf(salt, sessionKey, "CLIENTCHAL", 16);
  const data = hkdf(salt, sessionKey, "BDDATA", 72);
  return {
    challenge: chal.subarray(0, CHALLENGE_SIZE),
    proof: chal.subarray(CHALLENGE_SIZE, 16),
    clientMac: data.subarray(0, 20),
    serverMac: data.subarray(20, 40),
    clientKey: data.subarray(40, 56),
    serverKey: data.subarray(56, 72),
  };
}

export function lobbyFrame(type: number, payload: Buffer): Buffer {
  const head = Buffer.alloc(6);
  head.writeUInt32LE(2 + payload.length, 0);
  head[4] = FRAME_MARKER;
  head[5] = type;
  return Buffer.concat([head, payload]);
}

export function serverHeaderAck(connectionId: bigint, nonce: Buffer): Buffer {
  const payload = Buffer.alloc(20);
  payload.writeUInt32LE(LOBBY_PROTOCOL_210, 0);
  payload.writeBigUInt64LE(connectionId, 4);
  nonce.copy(payload, 12, 0, 8);
  return lobbyFrame(FRAME_SERVER_HEADER_ACK, payload);
}

// A record from one side, sealed with that side's key and MAC key.
export function sealRecord(
  key: Buffer,
  macKey: Buffer,
  sequence: number,
  type: number,
  message: Buffer,
  iv: Buffer = randomBytes(IV_SIZE)
): Buffer {
  const plain = Buffer.alloc(Math.ceil((5 + message.length) / BLOCK) * BLOCK);
  plain.writeUInt32LE(message.length, 0);
  plain[4] = type;
  message.copy(plain, 5);
  const cipher = createCipheriv("aes-128-cbc", key, iv).setAutoPadding(false);
  const sealed = Buffer.concat([cipher.update(plain), cipher.final()]);
  const seq = Buffer.alloc(4);
  seq.writeUInt32LE(sequence >>> 0, 0);
  const head = Buffer.alloc(6);
  head.writeUInt32LE(2 + 4 + IV_SIZE + sealed.length + TAG_SIZE, 0);
  head[4] = FRAME_MARKER;
  head[5] = FRAME_RECORD;
  const body = Buffer.concat([head, seq, iv, sealed]);
  return Buffer.concat([body, hmac(macKey, body).subarray(0, TAG_SIZE)]);
}

// One whole record frame, its length field first. A string is why it was
// refused.
export function openRecord(
  key: Buffer,
  macKey: Buffer,
  sequence: number,
  frame: Buffer
): { message: Buffer; type: number } | string {
  const sealedLength = frame.length - 6 - 4 - IV_SIZE - TAG_SIZE;
  if (sealedLength <= 0 || sealedLength % BLOCK !== 0) {
    return `bad record length ${frame.length}`;
  }
  const tagAt = frame.length - TAG_SIZE;
  const tag = hmac(macKey, frame.subarray(0, tagAt)).subarray(0, TAG_SIZE);
  if (!tag.equals(frame.subarray(tagAt))) {
    return "bad tag";
  }
  const seq = frame.readUInt32LE(6);
  if (seq !== sequence >>> 0) {
    return `sequence ${seq}, expected ${sequence}`;
  }
  const iv = frame.subarray(10, 10 + IV_SIZE);
  const decipher = createDecipheriv("aes-128-cbc", key, iv).setAutoPadding(
    false
  );
  const plain = Buffer.concat([
    decipher.update(frame.subarray(10 + IV_SIZE, tagAt)),
    decipher.final(),
  ]);
  const length = plain.readUInt32LE(0);
  if (length > plain.length - 5) {
    return `message length ${length} past the record`;
  }
  return { type: plain[4], message: plain.subarray(5, 5 + length) };
}

type State = "header" | "auth" | "ready" | "closed";

// One lobby connection on protocol 210. Messages in records are handed to
// onMessage with a link whose writes (200 protocol frames: u32le size | u8
// encrypt flag | u8 type | data) go out as records.
export class Lobby210Connection {
  private buffer: Buffer = Buffer.alloc(0);
  private state: State = "header";
  private clientHeaderTail = Buffer.alloc(0);
  private ack = Buffer.alloc(0);
  private keys?: LobbyKeys;
  private receiveSequence = 1;
  private sendSequence = 1;
  readonly link: LobbyLink = { write: (frame) => this.sendFrame200(frame) };

  constructor(
    private readonly socket: net.Socket,
    private readonly remote: string,
    private readonly connectionId: bigint,
    private readonly onMessage: (body: Buffer) => void
  ) {}

  receive(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    if (this.state === "header") {
      if (this.buffer.length < CLIENT_HEADER_SIZE) {
        return;
      }
      this.acceptHeader(this.buffer.subarray(0, CLIENT_HEADER_SIZE));
      this.buffer = this.buffer.subarray(CLIENT_HEADER_SIZE);
    }
    while (this.state !== "closed" && this.buffer.length >= 4) {
      const length = this.buffer.readUInt32LE(0);
      // An empty frame is the client's keepalive.
      if (length === 0) {
        this.buffer = this.buffer.subarray(4);
        continue;
      }
      if (length < 2 || length > 0x10_0000) {
        this.close(`frame length ${length}`);
        return;
      }
      if (this.buffer.length < 4 + length) {
        return;
      }
      const frame = this.buffer.subarray(0, 4 + length);
      this.buffer = this.buffer.subarray(4 + length);
      this.handleFrame(frame);
    }
  }

  private acceptHeader(header: Buffer): void {
    const versions = [0, 4, 8, 12].map((at) => header.readUInt32LE(at));
    event_message(
      "demonware:lobby: [%s] client header %s",
      this.remote,
      versions.join(",")
    );
    if (versions[3] !== LOBBY_PROTOCOL_210) {
      this.close(`client offers protocol ${versions[3]}`);
      return;
    }
    this.clientHeaderTail = Buffer.from(header.subarray(8));
    this.ack = serverHeaderAck(this.connectionId, randomBytes(8));
    this.socket.write(this.ack);
    this.state = "auth";
  }

  private handleFrame(frame: Buffer): void {
    if (frame[4] !== FRAME_MARKER) {
      this.close(`frame marker 0x${frame[4].toString(16)}`);
      return;
    }
    const type = frame[5];
    if (this.state === "auth" && type === FRAME_CLIENT_AUTH) {
      this.acceptAuth(frame);
      return;
    }
    if (this.state === "ready" && type === FRAME_RECORD && this.keys) {
      const opened = openRecord(
        this.keys.clientKey,
        this.keys.clientMac,
        this.receiveSequence,
        frame
      );
      if (typeof opened === "string") {
        this.close(`client record refused: ${opened}`);
        return;
      }
      this.receiveSequence++;
      if (opened.type !== CLIENT_RECORD_TYPE) {
        event_warning(
          "demonware:lobby: [%s] record type 0x%x: %s",
          this.remote,
          opened.type,
          hexPreview(opened.message)
        );
        return;
      }
      this.onMessage(opened.message);
      return;
    }
    event_warning(
      "demonware:lobby: [%s] unexpected frame 0x%x in state %s: %s",
      this.remote,
      type,
      this.state,
      hexPreview(frame)
    );
  }

  // The session key is the one whose derived challenge matches the client's:
  // the auth body's bit layout is not read.
  private acceptAuth(frame: Buffer): void {
    const challenge = frame.subarray(frame.length - CHALLENGE_SIZE);
    const transcript = Buffer.concat([
      this.clientHeaderTail,
      this.ack,
      frame.subarray(0, frame.length - CHALLENGE_SIZE),
    ]);
    for (const session of authSessions()) {
      const keys = deriveLobbyKeys(transcript, session.sessionKey);
      if (keys.challenge.equals(challenge)) {
        this.keys = keys;
        this.socket.write(lobbyFrame(FRAME_SERVER_AUTH_DONE, keys.proof));
        this.state = "ready";
        event_message(
          "demonware:lobby: [%s] authenticated with auth session %d",
          this.remote,
          session.id
        );
        return;
      }
    }
    const error = Buffer.alloc(4);
    error.writeUInt32LE(1, 0);
    this.socket.write(lobbyFrame(FRAME_ERROR, error));
    this.close(
      `no auth session matches challenge ${challenge.toString("hex")}`
    );
  }

  private sendFrame200(frame: Buffer): void {
    if (!this.keys || this.state !== "ready" || frame.length < 6) {
      event_warning(
        "demonware:lobby: [%s] dropped a frame before the handshake: %s",
        this.remote,
        hexPreview(frame)
      );
      return;
    }
    const record = sealRecord(
      this.keys.serverKey,
      this.keys.serverMac,
      this.sendSequence++,
      frame[5],
      frame.subarray(6)
    );
    event_status(
      "demonware:lobby: [%s] record type %d, %d bytes",
      this.remote,
      frame[5],
      frame.length - 6
    );
    this.socket.write(record);
  }

  private close(reason: string): void {
    event_warning("demonware:lobby: [%s] %s", this.remote, reason);
    this.state = "closed";
    this.socket.destroy();
  }
}
