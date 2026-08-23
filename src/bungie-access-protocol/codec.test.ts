import { describe, expect, it } from "vitest";
import { BungieCodec } from "./codec";
import { BapMessageType } from "./constants";

function innerOf(frame: Buffer): Buffer {
  const length = frame.readUInt32BE(2);
  return frame.subarray(6, 6 + length);
}

describe("BungieCodec encode headers", () => {
  it("uses the 32-byte service_activity header for type 100", () => {
    const body = Buffer.from(
      "0100000000000000010000000400000004aabbccdd",
      "hex"
    );
    const codec = new BungieCodec();
    const inner = innerOf(
      codec.encode({
        msgType: BapMessageType.ActivityHostToClientNotification,
        sequence: 7,
        body,
        activityHostId: 1n,
      })
    );

    expect(inner.length).toBe(0x20 + body.length);
    expect(inner.readUInt16BE(0)).toBe(
      BapMessageType.ActivityHostToClientNotification
    );
    expect(inner.readUInt32BE(2)).toBe(7);
    expect(inner.readBigUInt64BE(6)).toBe(0n);
    expect(inner.readBigUInt64BE(0x18)).toBe(1n);
    expect(inner.subarray(0x20)).toEqual(body);
    expect(inner.subarray(6, 8).equals(Buffer.from("00c8", "hex"))).toBe(false);
  });

  it("does not put 0x00c8 on wire 9", () => {
    const body = Buffer.from("01", "hex");
    const codec = new BungieCodec();
    const inner = innerOf(
      codec.encode({
        msgType: BapMessageType.BapToClientActivityNotification,
        sequence: 3,
        body,
      })
    );

    expect(inner.readUInt16BE(0)).toBe(
      BapMessageType.BapToClientActivityNotification
    );
    expect(inner.readUInt32BE(2)).toBe(3);
    expect(inner.subarray(6)).toEqual(body);
  });

  it("keeps the status trailer on request/response types", () => {
    const body = Buffer.from("aa", "hex");
    const codec = new BungieCodec();
    const inner = innerOf(
      codec.encode({
        msgType: BapMessageType.ClientToActivityHostManagerResponse,
        sequence: 1,
        body,
      })
    );

    expect(inner.readUInt16BE(6)).toBe(0x00c8);
    expect(inner.subarray(8)).toEqual(body);
  });
});
