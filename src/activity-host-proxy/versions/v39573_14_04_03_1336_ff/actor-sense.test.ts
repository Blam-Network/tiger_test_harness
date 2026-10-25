import { BitReader, BitWriter } from "@blamnetwork/rsat";
import { describe, expect, it } from "vitest";
import { defineAhSchemas } from "./ah";
import { createSenseWire } from "./sensor-sense";

const ah = defineAhSchemas();

function actorSense(
  script?: Parameters<typeof ah.ActorSense.encode>[1]["unknown3"]
) {
  const bw = new BitWriter(256);
  ah.ActorSense.encode(bw, {
    unknown0: 1,
    unknown1: undefined,
    unknown2: undefined,
    unknown3: script,
    unknown4: undefined,
    unknown5: 0,
    unknown6: undefined,
    unknown7: undefined,
    unknown8: undefined,
    unknown9: false,
    unknown10: true,
  });
  return ah.ActorSense.decode(new BitReader(bw.finish()));
}

describe("an Actor row's command script", () => {
  // The Walker skiff reaching the drop in the 2.3.1 capture: PC 4 of its
  // four atoms under cookie 1.
  it("reads the PC, cookie and heartbeat out of its sense", () => {
    const sense = actorSense({
      unknown0: 4,
      unknown1: 1,
      unknown2: 3,
      unknown3: false,
    });
    expect(createSenseWire(ah).actorCommandScript?.(sense)).toEqual({
      cookieRunning: 1,
      heartbeat: 3,
      pcReached: 4,
    });
  });

  it("leaves out what the update did not carry", () => {
    const sense = actorSense({
      unknown0: 1,
      unknown1: undefined,
      unknown2: undefined,
      unknown3: false,
    });
    expect(createSenseWire(ah).actorCommandScript?.(sense)).toEqual({
      cookieRunning: undefined,
      heartbeat: undefined,
      pcReached: 1,
    });
    expect(createSenseWire(ah).actorCommandScript?.(actorSense())).toBe(
      undefined
    );
  });
});
