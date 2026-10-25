import { create, toBinary } from "@bufbuild/protobuf";
import { describe, expect, it } from "vitest";
import { liveBap } from "./versions/v41375_14_07_03_1501_live/live-bap";
import { formatXetrovNotification, xetrovBuild } from "./xetrov";

const {
  ClientToXetrovNotificationSchema,
  XetrovClientEventSchema,
  XetrovEventType,
  XetrovPackedEventSchema,
} = liveBap().protos.xetrov;

describe("xetrov protobuf decode", () => {
  it("names envelope + inner heartbeat fields from proto", () => {
    const event = create(XetrovClientEventSchema, {
      playerCharacterId: 42n,
      playerAccountId: 7n,
      eventType: XetrovEventType.HEARTBEAT,
      activityIndex: 316,
      build: "41375.14.07.03.1501.live__release_internal",
      destinationNameHash: 0x12345678,
    });
    const envelope = create(ClientToXetrovNotificationSchema, {
      reserved1: 1,
      reserved2: 2,
      reserved3: 99n,
      event: toBinary(XetrovClientEventSchema, event),
    });
    const body = Buffer.from(
      toBinary(ClientToXetrovNotificationSchema, envelope)
    );
    const log = formatXetrovNotification(body);
    expect(log).toContain(`xetrov ${body.length}B`);
    expect(log).toContain('"eventType":"HEARTBEAT"');
    expect(log).toContain('"activityIndex":316');
    expect(log).toContain("41375.14.07.03.1501.live__release_internal");
    expect(log).toContain('"destinationNameHash":305419896');
  });

  it("unwraps packed type + payload inside the BAP envelope", () => {
    const event = create(XetrovClientEventSchema, {
      playerCharacterId: 42n,
      eventType: XetrovEventType.RESURRECT,
      eventLinkId: 55n,
    });
    const packed = create(XetrovPackedEventSchema, {
      type: XetrovEventType.RESURRECT,
      payload: toBinary(XetrovClientEventSchema, event),
    });
    const envelope = create(ClientToXetrovNotificationSchema, {
      reserved1: 2,
      reserved2: 2,
      event: toBinary(XetrovPackedEventSchema, packed),
    });
    const body = Buffer.from(
      toBinary(ClientToXetrovNotificationSchema, envelope)
    );
    const log = formatXetrovNotification(body);
    expect(log).not.toContain("decode failed");
    expect(log).toContain('"type":"RESURRECT"');
    expect(log).toContain('"eventType":"RESURRECT"');
    expect(log).toContain('"playerCharacterId":"42"');
    expect(log).toContain('"eventLinkId":"55"');
  });

  it("names a bare client event (no envelope)", () => {
    const event = create(XetrovClientEventSchema, {
      playerCharacterId: 1n,
      playerAccountId: 2n,
      eventType: XetrovEventType.DEATH,
      eventLinkId: 55n,
    });
    const body = Buffer.from(toBinary(XetrovClientEventSchema, event));
    const log = formatXetrovNotification(body);
    expect(log).toContain('"eventType":"DEATH"');
    expect(log).toContain('"eventLinkId":"55"');
  });

  it("reports a hex head when the body is not protobuf", () => {
    const body = Buffer.from("not protobuf!!", "ascii");
    const log = formatXetrovNotification(body);
    expect(log).toContain("decode failed");
    expect(log).toContain("head=");
  });
});

describe("xetrovBuild", () => {
  const event = (build?: string) =>
    toBinary(
      XetrovClientEventSchema,
      create(XetrovClientEventSchema, {
        eventType: XetrovEventType.HEARTBEAT,
        ...(build ? { build } : {}),
      })
    );
  const envelope = (inner: Uint8Array) =>
    Buffer.from(
      toBinary(
        ClientToXetrovNotificationSchema,
        create(ClientToXetrovNotificationSchema, {
          event: inner,
          reserved1: 1,
          reserved2: 2,
        })
      )
    );

  it("reads the build off an envelope", () => {
    expect(
      xetrovBuild(envelope(event("41375.14.07.03.1501.live__release_internal")))
    ).toBe("41375.14.07.03.1501.live__release_internal");
  });

  it("reads the build off a packed event", () => {
    const packed = toBinary(
      XetrovPackedEventSchema,
      create(XetrovPackedEventSchema, {
        payload: event("41375.14.07.03.1501.live"),
        type: XetrovEventType.HEARTBEAT,
      })
    );
    expect(xetrovBuild(envelope(packed))).toBe("41375.14.07.03.1501.live");
  });

  it("is undefined when the event says none or the body is junk", () => {
    expect(xetrovBuild(envelope(event()))).toBeUndefined();
    expect(xetrovBuild(Buffer.from("not protobuf"))).toBeUndefined();
  });
});
