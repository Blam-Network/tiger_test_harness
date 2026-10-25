import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  CLIENT_RECORD_TYPE,
  deriveLobbyKeys,
  FRAME_CLIENT_AUTH,
  lobbyFrame,
  openRecord,
  sealRecord,
  serverHeaderAck,
} from "./lobby-210";

// The client's key expansion, kept apart from the
// server's hkdfSync so the two are checked against each other.
function clientExpand(prk: Buffer, label: string, length: number): Buffer {
  const out: Buffer[] = [];
  let previous: Buffer = Buffer.alloc(0);
  for (let n = 1; Buffer.concat(out).length < length; n++) {
    previous = createHmac("sha1", prk)
      .update(Buffer.concat([previous, Buffer.from(label), Buffer.from([n])]))
      .digest();
    out.push(previous);
  }
  return Buffer.concat(out).subarray(0, length);
}

describe("Demonware lobby 210", () => {
  const sessionKey = Buffer.from(
    "00112233445566778899aabbccddeeff0011223344556677",
    "hex"
  );
  const header = Buffer.alloc(28);
  for (const [i, v] of [200, 200, 210, 210, 0x1_0000].entries()) {
    header.writeUInt32LE(v, i * 4);
  }
  header.writeBigUInt64LE(0x0102_0304_0506_0708n, 20);
  const ack = serverHeaderAck(0x1337n, Buffer.alloc(8, 0xee));
  const authBody = Buffer.from("07ff00010203", "hex");

  it("frames the server header ack", () => {
    expect(ack.toString("hex")).toBe(
      `16000000ab81d2000000${"3713000000000000"}${"ee".repeat(8)}`
    );
  });

  it("derives the challenge the client sends", () => {
    const authHead = lobbyFrame(
      FRAME_CLIENT_AUTH,
      Buffer.concat([authBody, Buffer.alloc(8)])
    );
    const transcript = Buffer.concat([
      header.subarray(8),
      ack,
      authHead.subarray(0, authHead.length - 8),
    ]);
    const salt = createHash("sha1").update(transcript).digest();
    const prk = createHmac("sha1", salt).update(sessionKey).digest();
    const chal = clientExpand(prk, "CLIENTCHAL", 16);
    const data = clientExpand(prk, "BDDATA", 72);

    const keys = deriveLobbyKeys(transcript, sessionKey);
    expect(keys.challenge).toEqual(chal.subarray(0, 8));
    expect(keys.proof).toEqual(chal.subarray(8));
    expect(keys.clientMac).toEqual(data.subarray(0, 20));
    expect(keys.serverMac).toEqual(data.subarray(20, 40));
    expect(keys.clientKey).toEqual(data.subarray(40, 56));
    expect(keys.serverKey).toEqual(data.subarray(56, 72));
  });

  it("opens a record laid out as the client writes it", () => {
    const keys = deriveLobbyKeys(Buffer.from("transcript"), sessionKey);
    const message = Buffer.from("15010203", "hex");
    const record = sealRecord(
      keys.clientKey,
      keys.clientMac,
      1,
      CLIENT_RECORD_TYPE,
      message
    );
    // u32 length = padded plaintext + 30, the plaintext padded
    // from its 5-byte header: (length + 20) & ~15.
    const padded = (message.length + 20) & ~15;
    expect(record.readUInt32LE(0)).toBe(padded + 30);
    expect(record.length).toBe(4 + padded + 30);
    expect(openRecord(keys.clientKey, keys.clientMac, 1, record)).toEqual({
      type: CLIENT_RECORD_TYPE,
      message,
    });
    expect(openRecord(keys.clientKey, keys.clientMac, 2, record)).toMatch(
      /sequence/
    );
    const tampered = Buffer.from(record);
    tampered[12] ^= 1;
    expect(openRecord(keys.clientKey, keys.clientMac, 1, tampered)).toBe(
      "bad tag"
    );
  });
});
