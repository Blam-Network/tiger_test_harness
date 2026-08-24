import { encode } from "@blamnetwork/rsat";
import { describe, expect, it } from "vitest";
import { JoinRequest } from "./join";
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
  it("reads the client join-request envelope from the FAH dump", () => {
    const payload = Buffer.alloc(0xcd, 0xab);
    payload.writeUInt32BE(0xb1e49c23, 0);

    const body = Buffer.concat([
      Buffer.from("00000000000000010100000003000000cd", "hex"),
      payload,
    ]);

    const parsed = parseClientToActivityHostNotification(body);
    expect(parsed?.sessionId).toBe(1n);
    expect(parsed?.variant).toBe(ACTIVITY_HOST_NOTIFICATION_VARIANT);
    expect(parsed?.kind).toBe(ActivityHostMessageType.JoinRequest);
    expect(parsed?.payload.length).toBe(0xcd);
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

  it("wraps an 808044F1 join result as type 4", () => {
    const request = encode(JoinRequest, {
      nonce: 0xb1e49c23,
      sessionId: 1n,
      identity: {
        machine: Buffer.alloc(6),
        player: Buffer.alloc(8),
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
    });
    const body = buildJoinResultNotification(1n, request);
    expect(body.readUInt32BE(9)).toBe(ActivityHostMessageType.JoinResult);
    expect(peekJoinRequest(request)).toEqual({
      nonce: 0xb1e49c23,
      activityHostId: 1n,
      machine: Buffer.alloc(6),
      player: Buffer.alloc(8),
      account: 0x100000001n,
      character: 0x200000002n,
    });
    expect(body.length).toBeGreaterThan(17);
  });
});
