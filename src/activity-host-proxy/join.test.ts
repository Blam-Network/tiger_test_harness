import { decode, encode } from "@blamnetwork/rsat";
import { describe, expect, it } from "vitest";
import {
  buildJoinResultRsat,
  formatAhSessionDisplay,
  JoinRequest,
  JoinResult,
  parseJoinRequest,
} from "./join";

function sampleJoinRequest() {
  return {
    nonce: 0xb1e49c23,
    sessionId: 1n,
    identity: {
      machine: Buffer.from("aabbccddeeff", "hex"),
      player: Buffer.from("1122334455667788", "hex"),
      account: 0x100000001n,
      character: 0x200000002n,
    },
    auth: {
      unk0: 0,
      displayName: { chars: new Array(128).fill(0) },
      unk2: 0n,
      unk3: 0n,
      unk4: 0n,
      unk5: 0,
      unk6: Buffer.alloc(6),
    },
  };
}

describe("808044F1 join result", () => {
  it("decodes the request nest and accepts with result 0", () => {
    const payload = encode(JoinRequest, sampleJoinRequest());
    const parsed = parseJoinRequest(payload);
    expect(parsed).toEqual({
      nonce: 0xb1e49c23,
      sessionId: 1n,
      machine: Buffer.from("aabbccddeeff", "hex"),
      player: Buffer.from("1122334455667788", "hex"),
      account: 0x100000001n,
      character: 0x200000002n,
    });

    const result = decode(JoinResult, buildJoinResultRsat(payload));
    expect(result.result).toBe(0);
    expect(result.request.nonce >>> 0).toBe(0xb1e49c23);
    expect(result.request.sessionId).toBe(1n);
    expect(result.replicationEpoch).toBe(1);
    expect(result.activityTime).toBe(0);
    expect(
      result.sessionDisplay.chars
        .map((c) => (c ? String.fromCharCode(c) : ""))
        .join("")
    ).toBe(formatAhSessionDisplay(1n));
  });
});
