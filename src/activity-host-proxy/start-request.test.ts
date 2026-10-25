import { encode, encodeServerMessage } from "@blamnetwork/rsat";
import { describe, expect, it } from "vitest";
import { e_server_message_network_id } from "../bungie-access-protocol/rsat/constants";
import { findU64BitOffset, parseStartRequest } from "./start-request";
import { activityHostBuild } from "./versions";

function buildStartRequestPayload(fields: {
  activityId?: number;
  ipValid?: boolean;
  unknown1?: boolean;
  stream?: Buffer;
}): Buffer {
  const options = encodeServerMessage(
    e_server_message_network_id._server_message_network_id_activity_host_get_activity_host_startup_options,
    activityHostBuild().startRequest.ActivityHostStartupOptionsRequest,
    {
      activityId: fields.activityId ?? 0,
      ipValid: fields.ipValid ?? false,
      unknown1: fields.unknown1 ?? false,
    }
  );
  const stream = fields.stream ?? Buffer.alloc(0);
  const payload = Buffer.alloc(
    activityHostBuild().startRequest.START_REQUEST_PAYLOAD_SIZE,
    0
  );
  payload.writeUInt16BE(options.length, 0);
  options.copy(payload, 2);
  payload.writeUInt16BE(
    stream.length,
    activityHostBuild().startRequest.START_REQUEST_STREAM_SIZE_OFFSET
  );
  stream.copy(
    payload,
    activityHostBuild().startRequest.START_REQUEST_STREAM_OFFSET
  );
  return payload;
}

describe("start request", () => {
  it("matches the live type-3 prefix (size 5, nid 1303, activity 0)", () => {
    const options = encodeServerMessage(
      e_server_message_network_id._server_message_network_id_activity_host_get_activity_host_startup_options,
      activityHostBuild().startRequest.ActivityHostStartupOptionsRequest,
      { activityId: 0, ipValid: false, unknown1: false }
    );
    expect(options.toString("hex")).toBe("0517800000");

    const payload = Buffer.alloc(
      activityHostBuild().startRequest.START_REQUEST_PAYLOAD_SIZE,
      0
    );
    payload.writeUInt16BE(options.length, 0);
    options.copy(payload, 2);
    expect(payload.subarray(0, 8).toString("hex")).toBe("0005051780000000");

    const parsed = parseStartRequest(payload);
    expect(parsed?.activityId).toBe(0);
    expect(parsed?.ipValid).toBe(false);
    expect(parsed?.stream.length).toBe(0);
  });

  it("reads a non-zero activity id and the unused stream slot", () => {
    const stream = Buffer.from([0xaa, 0xbb]);
    const parsed = parseStartRequest(
      buildStartRequestPayload({ activityId: 7, ipValid: true, stream })
    );
    expect(parsed?.activityId).toBe(7);
    expect(parsed?.ipValid).toBe(true);
    expect(parsed?.stream.equals(stream)).toBe(true);
  });

  it("rejects a truncated payload", () => {
    expect(parseStartRequest(Buffer.alloc(8, 0))).toBeNull();
  });
});

describe("start request stream decode", () => {
  it("round-trips an encoded stream (account, character, machine, fireteam)", () => {
    const emptySlot = { bytes: Array.from({ length: 256 }, () => 0) };
    const machine = Buffer.from("7c1e52a389ce", "hex");
    const stream = encode(activityHostBuild().startRequest.StartRequestStream, {
      unknown0: 0,
      unknown1: 0,
      activity: { activityId: 0, ip: -1 },
      slot0: emptySlot,
      slot1: emptySlot,
      slot2: emptySlot,
      slot3: emptySlot,
      fireteam: {
        members: [
          {
            account: 0x100000002n,
            character: 0x200000002n,
            machine,
            player: Buffer.alloc(8),
          },
        ],
      },
      machine,
    });
    const parsed = parseStartRequest(buildStartRequestPayload({ stream }));
    expect(parsed?.stream.length).toBe(stream.length);
    expect(parsed?.fireteam).toHaveLength(1);
    expect(parsed?.fireteam?.[0]?.account).toBe(0x100000002n);
    expect(parsed?.fireteam?.[0]?.character).toBe(0x200000002n);
    expect(parsed?.fireteam?.[0]?.machine.toString("hex")).toBe("7c1e52a389ce");
    expect(parsed?.requesterMachine?.toString("hex")).toBe("7c1e52a389ce");
  });
});

describe("findU64BitOffset", () => {
  function writeU64AtBit(buf: Buffer, bit: number, value: bigint): void {
    for (let i = 0; i < 64; i++) {
      const at = bit + i;
      if ((value >> BigInt(63 - i)) & 1n) {
        buf[at >> 3] |= 0x80 >> (at & 7);
      }
    }
  }

  it("finds a big-endian u64 at any bit offset", () => {
    const stream = Buffer.alloc(64, 0);
    // Unaligned, with the character 32 bits after the account.
    writeU64AtBit(stream, 203, 0x100000002n);
    writeU64AtBit(stream, 235, 0x200000002n);
    expect(findU64BitOffset(stream, 0x100000002n)).toBe(203);
    expect(findU64BitOffset(stream, 0x200000002n)).toBe(235);
    expect(findU64BitOffset(stream, 0x100000003n)).toBe(-1);
  });

  it("finds byte-aligned values including the last byte", () => {
    const stream = Buffer.alloc(16, 0xff);
    stream.writeBigUInt64BE(0x0123456789abcdefn, 8);
    expect(findU64BitOffset(stream, 0x0123456789abcdefn)).toBe(64);
    expect(findU64BitOffset(Buffer.alloc(7, 0), 0n)).toBe(-1);
  });
});
