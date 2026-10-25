import * as crypto from "node:crypto";
import { e_event_level, event } from "@blamnetwork/datamine";
import { BAP_SESSION_KEY_AES, BAP_SESSION_KEY_HMAC } from "../../signon/config";
import type { BungieCodec, RawBapMessage } from "./codec";
import { BapMessageType } from "./constants";

// The two ends BAP and the activity host proxy share: both open a channel the
// same way, then wrap the codec's GCM key and IV in the signon AES-CBC + HMAC.
export interface ChannelEnd {
  // The events category of every line, "networking:bap:" or
  // "activities:host:".
  category: string;
  codec: BungieCodec;
  send(message: RawBapMessage): void;
}

const CHANNEL_MAGIC = Buffer.from("DESTINY\x01", "ascii");

export function handleChannelStartup(
  end: ChannelEnd,
  message: RawBapMessage
): void {
  if (
    message.body.length < 8 ||
    !message.body.subarray(0, 8).equals(CHANNEL_MAGIC)
  ) {
    event(
      e_event_level.warning,
      `${end.category} channel startup magic mismatch (%d bytes)`,
      message.body.length
    );
  }

  const seed = crypto.randomBytes(120);
  const body = Buffer.concat([CHANNEL_MAGIC, seed]);
  end.send({
    msgType: BapMessageType.ClientToBapChannelStartupResponse,
    sequence: message.sequence,
    body,
  });
  event(e_event_level.message, `${end.category} channel startup complete`);
}

// Secure hello: wrap the GCM key/IV in signon AES-CBC+HMAC, then enable codec GCM.
export function handleSecureHello(
  end: ChannelEnd,
  message: RawBapMessage
): void {
  const gcmKey = crypto.randomBytes(16);
  const gcmIv = crypto.randomBytes(12);
  const cbcNonce = Buffer.alloc(16, 0);

  const dataRaw = Buffer.concat([gcmIv, gcmKey]);
  const dataEncrypted = aes128CbcEncrypt(
    BAP_SESSION_KEY_AES,
    cbcNonce,
    dataRaw
  );

  const payloadCore = Buffer.alloc(4 + cbcNonce.length + dataEncrypted.length);
  payloadCore.writeUInt32BE(0x50, 0);
  cbcNonce.copy(payloadCore, 4);
  dataEncrypted.copy(payloadCore, 4 + cbcNonce.length);

  const tag = crypto
    .createHmac("sha256", BAP_SESSION_KEY_HMAC)
    .update(payloadCore)
    .digest();

  const payload = Buffer.concat([payloadCore, tag]);
  end.send({
    msgType: BapMessageType.ClientToBapSecureHelloResponse,
    sequence: message.sequence,
    body: payload,
  });

  end.codec.enableEncryption(gcmKey, gcmIv);
  event(
    e_event_level.message,
    `${end.category} secure hello complete — GCM enabled`
  );
}

function aes128CbcEncrypt(key: Buffer, iv: Buffer, data: Buffer): Buffer {
  const cipher = crypto.createCipheriv("aes-128-cbc", key, iv);
  return Buffer.concat([cipher.update(data), cipher.final()]);
}
