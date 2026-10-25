import { BitReader } from "@blamnetwork/rsat";
import { describe, expect, it } from "vitest";
import { defineAhSchemas } from "./ah";
import { createSensorAuth } from "./sensor-auth";

const ah = defineAhSchemas();
const auth = createSensorAuth(ah);

describe("ff Actor auth", () => {
  // Sepiks Prime placed blind and deaf (set_blind/set_deaf), then woken as
  // his guards die: the flags, then their mask, after the generation. Left
  // at 0/0 he fights from the moment he is placed.
  it("writes the awareness flags and mask into the behaviour", () => {
    const encode = (awarenessFlags: number, generation: number) =>
      ah.ActorAuth.decode(
        new BitReader(
          auth.encodeActor({
            behaviour: { awarenessFlags, awarenessMask: 3, generation },
            place: true,
          }).bytes
        )
      ).behaviour;
    expect(encode(3, 1)).toMatchObject({
      unknown0: 1,
      unknown1: 3,
      unknown2: 3,
    });
    expect(encode(0, 2)).toMatchObject({
      unknown0: 2,
      unknown1: 0,
      unknown2: 3,
    });
  });
});
