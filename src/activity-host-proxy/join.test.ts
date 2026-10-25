import { decode } from "@blamnetwork/rsat";
import { describe, expect, it } from "vitest";
import { formatActivityHostTag } from "./config";
import {
  buildJoinResultRsat,
  encodeJoinRequest,
  parseJoinRequest,
} from "./join";
import { liveAh } from "./versions/v41375_14_07_03_1501_live/live-ah";

const sample = {
  nonce: 0xb1_e4_9c_23,
  sessionId: 1n,
  machine: Buffer.from("aabbccddeeff0000", "hex"),
  player: Buffer.from("1122334455667788", "hex"),
  account: 0x1_00_00_00_01n,
  character: 0x2_00_00_00_02n,
  identityUnknown4: 0x33_8a_2d_02_15_a1_5f_54n,
};

describe("80800A58 join result", () => {
  it("decodes the request nest and accepts with result 0", () => {
    const payload = encodeJoinRequest(sample);
    const parsed = parseJoinRequest(payload);
    expect(parsed).toEqual(sample);

    const result = decode(liveAh().JoinResult, buildJoinResultRsat(payload));
    expect(result.result).toBe(0);
    expect(result.request.nonce >>> 0).toBe(0xb1e49c23);
    expect(result.request.sessionId).toBe(1n);
    expect(result.replicationEpoch).toBe(1);
    expect(result.activityTime).toBe(0);
    expect(
      result.sessionDisplay.text.chars
        .map((c) => (c ? String.fromCharCode(c) : ""))
        .join("")
    ).toBe(formatActivityHostTag(1n));
  });
});
