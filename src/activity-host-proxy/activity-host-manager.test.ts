import { describe, expect, it, vi } from "vitest";
import {
  ACTIVITY_HOST_MANAGER_RESPONSE_TYPE,
  ACTIVITY_HOST_MANAGER_START_TYPE,
  ActivityHostManager,
  buildActivityHostManagerResponse,
  parseActivityHostManagerRequest,
} from "./activity-host-manager";
import { START_REQUEST_PAYLOAD_SIZE } from "./start-request";

function silentLogger() {
  return {
    debug: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
  };
}

describe("ActivityHostManager", () => {
  it("replies to a start request and keeps the payload", () => {
    const manager = new ActivityHostManager(silentLogger());
    const inner = Buffer.alloc(START_REQUEST_PAYLOAD_SIZE, 0);
    Buffer.from("0005051780000000", "hex").copy(inner);
    const body = Buffer.alloc(3095, 0);
    body[0] = ACTIVITY_HOST_MANAGER_START_TYPE;
    inner.copy(body, 1);

    const rsp = manager.handle({
      msgType: 6,
      sequence: 1,
      body,
    });

    expect(rsp?.[0]).toBe(2);
    expect(rsp?.readBigUInt64BE(1)).toBe(1n);
    expect(manager.getStartRequest()?.activityId).toBe(0);
  });

  it("reads the request subtype", () => {
    const body = Buffer.alloc(3095, 0);
    body[0] = ACTIVITY_HOST_MANAGER_START_TYPE;
    body.writeBigUInt64BE(0x11n, 1);
    const req = parseActivityHostManagerRequest(body);
    expect(req?.type).toBe(ACTIVITY_HOST_MANAGER_START_TYPE);
    expect(req?.payload.readBigUInt64BE(0)).toBe(0x11n);
  });

  it("puts a non-zero activity-host id at the start of the 136-byte blob", () => {
    const body = buildActivityHostManagerResponse(1n);
    expect(body.length).toBe(137);
    expect(body[0]).toBe(ACTIVITY_HOST_MANAGER_RESPONSE_TYPE);
    expect(body.readBigUInt64BE(1)).toBe(1n);
    expect(body.readUInt32BE(5)).not.toBe(0);
    expect(body.subarray(9).every((b) => b === 0)).toBe(true);
  });

  it("starts with a FAH and no GAH", () => {
    const manager = new ActivityHostManager(silentLogger());
    expect(manager.fah.id).toBe(1n);
    expect(manager.gah).toBeUndefined();
  });

  it("absorbs an empty body", () => {
    const logger = silentLogger();
    const manager = new ActivityHostManager(logger);
    expect(
      manager.handle({ msgType: 6, sequence: 1, body: Buffer.alloc(0) })
    ).toBeNull();
    expect(logger.warn).toHaveBeenCalled();
    expect(manager.getStartRequest()).toBeUndefined();
  });
});
