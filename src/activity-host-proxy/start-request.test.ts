import { encodeServerMessage } from "@blamnetwork/rsat";
import { describe, expect, it } from "vitest";
import { e_server_message_network_id } from "../bungie-access-protocol/rsat/server-message";
import {
  ActivityHostStartupOptionsRequest,
  parseStartRequest,
  START_REQUEST_PAYLOAD_SIZE,
  START_REQUEST_STREAM_OFFSET,
  START_REQUEST_STREAM_SIZE_OFFSET,
} from "./start-request";

function buildStartRequestPayload(fields: {
  activityId?: number;
  ipValid?: boolean;
  unknown1?: boolean;
  stream?: Buffer;
}): Buffer {
  const options = encodeServerMessage(
    e_server_message_network_id._server_message_network_id_activity_host_get_activity_host_startup_options,
    ActivityHostStartupOptionsRequest,
    {
      activityId: fields.activityId ?? 0,
      ipValid: fields.ipValid ?? false,
      unknown1: fields.unknown1 ?? false,
    }
  );
  const stream = fields.stream ?? Buffer.alloc(0);
  const payload = Buffer.alloc(START_REQUEST_PAYLOAD_SIZE, 0);
  payload.writeUInt16BE(options.length, 0);
  options.copy(payload, 2);
  payload.writeUInt16BE(stream.length, START_REQUEST_STREAM_SIZE_OFFSET);
  stream.copy(payload, START_REQUEST_STREAM_OFFSET);
  return payload;
}

describe("start request", () => {
  it("matches the live type-3 prefix (size 5, nid 1303, activity 0)", () => {
    const options = encodeServerMessage(
      e_server_message_network_id._server_message_network_id_activity_host_get_activity_host_startup_options,
      ActivityHostStartupOptionsRequest,
      { activityId: 0, ipValid: false, unknown1: false }
    );
    expect(options.toString("hex")).toBe("0517800000");

    const payload = Buffer.alloc(START_REQUEST_PAYLOAD_SIZE, 0);
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
