import * as crypto from "node:crypto";
import { BapMessageType } from "./constants";

type FrameFlag = 1 | 2;

export interface RawBapMessage {
  // Type 100 service_activity header: AH id at +0x18.
  activityHostId?: bigint;
  body: Buffer;
  msgType: number;
  sequence: number;
}

// Category-6 ah→c header. Type@0, seq@2, dest conn@6, AH@0x18.
const SERVICE_ACTIVITY_HEADER_SIZE = 0x20;
const SERVICE_ACTIVITY_CONN_OFF = 0x06;
const SERVICE_ACTIVITY_AH_OFF = 0x18;
// Dest connection 0 = OUT PRIMARY: the client relays the inner body as wire 9.
const SERVICE_ACTIVITY_DEST_PRIMARY = 0n;

// BAP TCP frame codec.
//
// Outer header: marker=1, flag (1=GCM, 2=plain), u32 payload length.
// Inner (plain/decrypted): u16 type, u32 sequence, body.
export class BungieCodec {
  private gcm: GcmState | undefined;

  enableEncryption(key: Buffer, nonce: Buffer): void {
    if (key.length !== 16 || nonce.length !== 12) {
      throw new Error("GCM key must be 16 bytes and nonce 12 bytes");
    }
    this.gcm = new GcmState(key, nonce);
  }

  tryDecode(buffer: Buffer): { message?: RawBapMessage; consumed: number } {
    if (buffer.length < 6) {
      return { consumed: 0 };
    }

    const marker = buffer.readUInt8(0);
    if (marker !== 1) {
      throw new Error(`Invalid BAP frame marker ${marker}`);
    }

    const flag = buffer.readUInt8(1);
    const length = buffer.readUInt32BE(2);
    if (buffer.length < 6 + length) {
      return { consumed: 0 };
    }

    let payload: Buffer = Buffer.from(buffer.subarray(6, 6 + length));
    if (flag === 1) {
      if (!this.gcm) {
        throw new Error(
          "Received encrypted BAP frame before secure hello completed"
        );
      }
      payload = Buffer.from(this.gcm.decrypt(payload));
    } else if (flag !== 2) {
      throw new Error(`Unknown BAP frame flag ${flag}`);
    }

    if (payload.length < 6) {
      throw new Error(`BAP inner header too short (${payload.length})`);
    }

    const msgType = payload.readUInt16BE(0);
    const sequence = payload.readUInt32BE(2);
    const body = Buffer.from(payload.subarray(6));

    return {
      consumed: 6 + length,
      message: { msgType, sequence, body },
    };
  }

  encode(message: RawBapMessage): Buffer {
    const parts: Buffer[] = [];
    if (message.msgType === BapMessageType.ActivityHostToClientNotification) {
      // 32-byte service_activity header, not the 6+0x00C8 status header. A
      // short header makes the client peel 32 bytes into our body.
      const header = Buffer.alloc(SERVICE_ACTIVITY_HEADER_SIZE, 0);
      header.writeUInt16BE(message.msgType & 0xffff, 0);
      header.writeUInt32BE(message.sequence >>> 0, 2);
      header.writeBigUInt64BE(
        SERVICE_ACTIVITY_DEST_PRIMARY,
        SERVICE_ACTIVITY_CONN_OFF
      );
      header.writeBigUInt64BE(
        message.activityHostId ?? 0n,
        SERVICE_ACTIVITY_AH_OFF
      );
      parts.push(header);
    } else {
      const header = Buffer.alloc(6);
      header.writeUInt16BE(message.msgType & 0xffff, 0);
      header.writeUInt32BE(message.sequence >>> 0, 2);
      parts.push(header);

      if (usesStatusTrailer(message.msgType)) {
        const trailer = Buffer.alloc(2);
        trailer.writeUInt16BE(0x00c8, 0);
        parts.push(trailer);
      }
    }

    parts.push(message.body);
    let payload: Buffer = Buffer.concat(parts);

    let flag: FrameFlag = 2;
    if (
      this.gcm &&
      message.msgType !== BapMessageType.ClientToBapSecureHelloResponse
    ) {
      payload = Buffer.from(this.gcm.encrypt(payload));
      flag = 1;
    }

    const frame = Buffer.alloc(6 + payload.length);
    frame.writeUInt8(1, 0);
    frame.writeUInt8(flag, 1);
    frame.writeUInt32BE(payload.length, 2);
    payload.copy(frame, 6);
    return frame;
  }
}

class GcmState {
  private readonly key: Buffer;
  private readonly nonceIn: Buffer;
  private readonly nonceOut: Buffer;

  constructor(key: Buffer, nonce: Buffer) {
    this.key = Buffer.from(key);
    this.nonceOut = Buffer.from(nonce);
    this.nonceIn = Buffer.from(nonce);
    this.nonceIn[11] ^= 1;
  }

  encrypt(data: Buffer): Buffer {
    const cipher = crypto.createCipheriv(
      "aes-128-gcm",
      this.key,
      this.nonceOut
    );
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    const tag = cipher.getAuthTag();
    incrementNonce(this.nonceOut);
    return Buffer.concat([tag, encrypted]);
  }

  decrypt(data: Buffer): Buffer {
    if (data.length < 16) {
      throw new Error("Encrypted BAP payload shorter than GCM tag");
    }
    const tag = data.subarray(0, 16);
    const ciphertext = data.subarray(16);
    const decipher = crypto.createDecipheriv(
      "aes-128-gcm",
      this.key,
      this.nonceIn
    );
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    incrementNonce(this.nonceIn);
    return plain;
  }
}

function usesStatusTrailer(msgType: number): boolean {
  return (
    msgType !== BapMessageType.QueuezToClientUpdateNotification &&
    msgType !== BapMessageType.BapToClientActivityNotification &&
    msgType !== BapMessageType.ActivityHostToClientNotification
  );
}

function incrementNonce(nonce: Buffer): void {
  for (let i = 0; i < nonce.length; i++) {
    nonce[i] = (nonce[i] + 1) & 0xff;
    if (nonce[i] !== 0) {
      break;
    }
  }
}
