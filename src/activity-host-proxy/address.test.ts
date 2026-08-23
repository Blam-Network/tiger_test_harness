import { describe, expect, it } from "vitest";
import { ipv4ToInt } from "../lib/cstruct";
import {
  buildGetActivityHostProxyResponse,
  parseGetActivityHostProxyRequest,
} from "./address";

describe("get_activity_host_proxy framing", () => {
  it("parses the 8-byte activity-host id", () => {
    const body = Buffer.alloc(8);
    body.writeBigUInt64BE(0x1122334455667788n, 0);
    expect(parseGetActivityHostProxyRequest(body)).toBe(0x1122334455667788n);
  });

  it("rejects a short request", () => {
    expect(parseGetActivityHostProxyRequest(Buffer.alloc(7))).toBeNull();
  });

  it("encodes id + ipv4 + reserved + port as 16 bytes", () => {
    const body = buildGetActivityHostProxyResponse(
      0xaabbccddeeff0011n,
      "127.0.0.1",
      37001
    );
    expect(body.length).toBe(16);
    expect(body.readBigUInt64BE(0)).toBe(0xaabbccddeeff0011n);
    expect(body.readUInt32BE(8)).toBe(ipv4ToInt("127.0.0.1"));
    expect(body.readUInt16BE(12)).toBe(0);
    expect(body.readUInt16BE(14)).toBe(37001);
  });

  it("round-trips a dotted IPv4 through the advanced type", () => {
    const body = buildGetActivityHostProxyResponse(1n, "10.20.30.40", 1);
    expect(body.subarray(8, 12)).toEqual(Buffer.from([10, 20, 30, 40]));
  });
});
