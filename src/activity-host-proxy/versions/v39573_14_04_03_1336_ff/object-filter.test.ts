import { BitReader } from "@blamnetwork/rsat";
import { describe, expect, it } from "vitest";
import { defineAhSchemas } from "./ah";
import { createSensorAuth } from "./sensor-auth";

const ah = defineAhSchemas();
const auth = createSensorAuth(ah);

const SHIP = 0xfe_85_01_fa | 0;
const SQUAD = 1;

describe("ff ObjectFilter auth", () => {
  // of_ultra_servitor.add(sq_bossbattle_boss01) in enc_ship_portal1: left out,
  // the filter is empty and Sepiks Prime's performance shield never goes up.
  it("sends a squad as a squad-members predicate", () => {
    const servitor = { bundle: SHIP, typeId: SQUAD, typeIndex: 3 };
    const { bytes } = auth.encodeObjectFilter([
      { kind: "squadMembers", item: servitor },
    ]);
    const br = new BitReader(bytes);
    expect(br.readNumber(4)).toBe(1);
    expect(br.readBit()).toBe(1);
    expect(br.readNumber(32) >>> 0).toBe(0x80_80_06_e5);
    expect(ah.ObjectFilterSquadMembersPredicate.decode(br)).toEqual({
      mode: 0,
      item: servitor,
    });
  });
});
