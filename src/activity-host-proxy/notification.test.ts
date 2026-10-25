import { describe, expect, it } from "vitest";
import { encodeJoinRequest } from "./join";
import { ActivityHostMessageType } from "./messages";
import {
  ACTIVITY_HOST_NOTIFICATION_VARIANT,
  buildActivityHostToClientNotification,
  buildJoinResultNotification,
  parseActivityHostToClientNotification,
  parseClientToActivityHostNotification,
  peekJoinRequest,
} from "./notification";

describe("activity host notification framing", () => {
  // Wire 8 (Xenia capture, 253-byte body): frame session, variant 1, kind 3,
  // length 0xe8, a fourth word 0, then the join request.
  it("reads the client join-request envelope", () => {
    const payload = Buffer.alloc(0xe8, 0xab);
    payload.writeUInt32BE(0x21_de_b1_00, 0);

    const body = Buffer.concat([
      Buffer.from("947aec531717dc140100000003000000e800000000", "hex"),
      payload,
    ]);

    const parsed = parseClientToActivityHostNotification(body);
    expect(parsed?.sessionId).toBe(0x94_7a_ec_53_17_17_dc_14n);
    expect(parsed?.variant).toBe(ACTIVITY_HOST_NOTIFICATION_VARIANT);
    expect(parsed?.kind).toBe(ActivityHostMessageType.JoinRequest);
    expect(parsed?.payload.length).toBe(0xe8);
    expect(parsed?.payload.readUInt32BE(0)).toBe(0x21_de_b1_00);
  });

  it("builds the inner notification the client decoder expects", () => {
    const payload = Buffer.from("aabbccdd", "hex");
    const body = buildActivityHostToClientNotification(1n, 4, payload);
    expect(body[0]).toBe(ACTIVITY_HOST_NOTIFICATION_VARIANT);
    expect(body.readBigUInt64BE(1)).toBe(1n);
    expect(body.readUInt32BE(9)).toBe(4);
    expect(body.readUInt32BE(13)).toBe(4);
    expect(body.subarray(17)).toEqual(payload);
    expect(parseActivityHostToClientNotification(body)).toEqual({
      sessionId: 1n,
      variant: ACTIVITY_HOST_NOTIFICATION_VARIANT,
      kind: 4,
      payload,
    });
  });

  it("wraps a 80800A58 join result as type 4", () => {
    const request = encodeJoinRequest({
      nonce: 0xb1_e4_9c_23,
      sessionId: 1n,
      machine: Buffer.alloc(8),
      player: Buffer.alloc(8),
      account: 0x1_00_00_00_01n,
      character: 0x2_00_00_00_02n,
    });
    const body = buildJoinResultNotification(1n, request);
    expect(body.readUInt32BE(9)).toBe(ActivityHostMessageType.JoinResult);
    expect(peekJoinRequest(request)).toEqual({
      nonce: 0xb1e49c23,
      activityHostId: 1n,
      machine: Buffer.alloc(8),
      player: Buffer.alloc(8),
      account: 0x100000001n,
      character: 0x200000002n,
      identityUnknown4: 0n,
    });
    expect(body.length).toBeGreaterThan(17);
  });
});
