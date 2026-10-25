import { BitReader, BitWriter } from "@blamnetwork/rsat";
import { describe, expect, it } from "vitest";
import { defineAhSchemas } from "./ah";
import { createSensorAuth } from "./sensor-auth";
import { createSenseWire } from "./sensor-sense";

const ah = defineAhSchemas();

const device = {
  powerStamp: 0,
  power: 1,
  lockStamp: 0,
  lock: 0,
  positionStamp: 2,
  position: 1,
};

function objectSense(
  components: Parameters<typeof ah.ObjectSense.encode>[1]["components"]
) {
  const bw = new BitWriter(256);
  ah.ObjectSense.encode(bw, {
    unknown0: 1,
    alive: true,
    unknown2: 0,
    unknown3: { unknown0: 1, unknown1: 0 },
    components,
  });
  return bw.finish();
}

describe("an Object row's component vec", () => {
  // Each element: a present bit, the 32-bit class handle, then the body in
  // that class (kind 34).
  it("reads the client's device out of its sense", () => {
    const bytes = objectSense({
      unknown0: [
        {
          schema: 0x80_80_20_22,
          value: { used: true, usedStamp: 0 },
        },
        { schema: 0x80_80_27_d3, value: device },
      ],
    });
    const sense = ah.ObjectSense.decode(new BitReader(bytes));
    expect(createSenseWire(ah).objectDevice?.(sense)).toEqual({
      position: 1,
      positionStamp: 2,
    });
  });

  it("has no device for a sense without one", () => {
    const sense = ah.ObjectSense.decode(
      new BitReader(objectSense({ unknown0: [] }))
    );
    expect(createSenseWire(ah).objectDevice?.(sense)).toBeUndefined();
  });

  it("reads back the auth the host writes", () => {
    const { bytes } = createSensorAuth(ah).encodeObject(
      1,
      true,
      { position: 0.5, stamp: 3 },
      { enabled: false, used: { stamp: 1, value: false } }
    );
    const br = new BitReader(bytes);
    expect(br.readNumber(32) >>> 0).toBe(0x80_00_00_01);
    expect(br.readBit()).toBe(1);
    ah.SensorClientRef.decode(br);
    const { unknown0 } = ah.Unknown80804113.decode(br);
    expect(unknown0.map((c) => c?.schema)).toEqual([
      0x80_80_21_48, 0x80_80_20_8c,
    ]);
    expect(unknown0[1]?.value).toMatchObject({
      power: 1,
      positionStamp: 3,
      position: 0.5,
    });
  });

  it("throws on a class it has no schema for", () => {
    const bw = new BitWriter(16);
    bw.write(1, 2);
    bw.writeBit(1);
    bw.write(0x80_80_00_01, 32);
    expect(() => ah.Unknown80804113.decode(new BitReader(bw.finish()))).toThrow(
      /not listed/
    );
  });
});
