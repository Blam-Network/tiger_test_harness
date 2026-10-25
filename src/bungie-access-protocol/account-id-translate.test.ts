import { describe, expect, it } from "vitest";
import {
  buildAccountIdTranslateResponse,
  parseAccountIdTranslateRequest,
} from "./account-id-translate";

const xbox = { type: 1, idBytes: 8 };
const psn = { type: 7, idBytes: 36 };

function u64(value: bigint): Buffer {
  const out = Buffer.alloc(8);
  out.writeBigUInt64BE(value);
  return out;
}

describe("account id translation", () => {
  it("answers Xbox ids with their soids", () => {
    const ids = [u64(0x1_0000_0001n), u64(0x2_0000_0002n)];
    const soid = 0x1_0000_0001n;
    const rsp = buildAccountIdTranslateResponse(ids, soid, xbox);
    expect(rsp.length).toBe(4 + 16 + 16);
    expect(rsp.readUInt16BE(0)).toBe(2);
    expect(rsp[2]).toBe(1);
    expect(rsp[3]).toBe(255);
    expect(rsp.readBigUInt64BE(4)).toBe(0x1_0000_0001n);
    expect(rsp.readBigUInt64BE(12)).toBe(0x2_0000_0002n);
    expect(rsp.readBigUInt64BE(20)).toBe(soid);
    expect(rsp.readBigUInt64BE(28)).toBe(soid);
  });

  it("reads count, reserved, then ids, and stops at the body's end", () => {
    const body = Buffer.concat([Buffer.from([0, 3, 0, 0]), u64(7n)]);
    expect(parseAccountIdTranslateRequest(body, xbox)).toEqual([u64(7n)]);
  });

  // The PS4 alpha's 40-byte request: one 36-byte PSN account nest.
  it("echoes a PSN account nest with type 7", () => {
    const nest = Buffer.alloc(36);
    nest.write("alphatrial", "ascii");
    const body = Buffer.concat([Buffer.from([0, 1, 0, 0]), nest]);
    const ids = parseAccountIdTranslateRequest(body, psn);
    expect(ids).toEqual([nest]);
    const rsp = buildAccountIdTranslateResponse(ids, 0x1_0000_0001n, psn);
    expect(rsp.length).toBe(4 + 36 + 8);
    expect(rsp.subarray(0, 4)).toEqual(Buffer.from([0, 1, 7, 255]));
    expect(rsp.subarray(4, 40)).toEqual(nest);
    expect(rsp.readBigUInt64BE(40)).toBe(0x1_0000_0001n);
  });
});
