import { describe, expect, it } from "vitest";
import {
  buildAccountIdTranslateResponse,
  parseAccountIdTranslateRequest,
} from "./account-id-translate";

describe("account-id-translate cstruct framing", () => {
  it("round-trips platform ids and investment soids", () => {
    const ids = [0x100000001n, 0x200000002n];
    const soid = 0x0000000100000001n;
    const rsp = buildAccountIdTranslateResponse(ids, soid);
    expect(rsp.length).toBe(4 + 16 + 16);
    expect(rsp.readUInt16BE(0)).toBe(2);
    expect(rsp[2]).toBe(1);
    expect(rsp[3]).toBe(255);
    expect(rsp.readBigUInt64BE(4)).toBe(ids[0]);
    expect(rsp.readBigUInt64BE(12)).toBe(ids[1]);
    expect(rsp.readBigUInt64BE(20)).toBe(soid);
    expect(rsp.readBigUInt64BE(28)).toBe(soid);
  });

  it("parses request bodies (count + pad + ids)", () => {
    const body = Buffer.alloc(4 + 16);
    body.writeUInt16BE(2, 0);
    body.writeUInt16BE(0, 2);
    body.writeBigUInt64BE(9n, 4);
    body.writeBigUInt64BE(10n, 12);
    expect(parseAccountIdTranslateRequest(body)).toEqual([9n, 10n]);
  });

  it("truncates when body is short", () => {
    const body = Buffer.alloc(4 + 8);
    body.writeUInt16BE(3, 0);
    body.writeBigUInt64BE(7n, 4);
    expect(parseAccountIdTranslateRequest(body)).toEqual([7n]);
  });

  it("handles a single platform id", () => {
    const rsp = buildAccountIdTranslateResponse([42n], 1n);
    expect(rsp.length).toBe(4 + 8 + 8);
    expect(parseAccountIdTranslateRequest(rsp.subarray(0, 4 + 8))).toEqual([
      42n,
    ]);
  });

  it("handles zero ids", () => {
    const rsp = buildAccountIdTranslateResponse([], 1n);
    expect(rsp.length).toBe(4);
    expect(rsp.readUInt16BE(0)).toBe(0);
    expect(rsp[2]).toBe(1);
    expect(rsp[3]).toBe(255);
  });
});
