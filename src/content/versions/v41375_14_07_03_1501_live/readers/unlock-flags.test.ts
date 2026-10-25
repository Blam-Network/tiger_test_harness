import { expect, it } from "vitest";
import { describeWithPackages } from "../../../../test-support/build";
import {
  flagCount,
  flagSetTime,
  flagSlot,
  flagSource,
  recordFlags,
  slotFlag,
  timedFlags,
  type UnlockScope,
  unlockSlotCount,
} from "../../../unlock-flags";

const SCOPES: readonly UnlockScope[] = ["account", "offer", "character"];

describeWithPackages("unlock flag tables", () => {
  it("maps slots to flags and back, agreeing with the flag table's sources", () => {
    for (const scope of SCOPES) {
      let mapped = 0;
      for (let slot = 0; slot < unlockSlotCount(scope); slot++) {
        const flag = slotFlag(scope, slot);
        if (flag !== undefined) {
          mapped++;
          expect(flagSlot(scope, flag), `${scope} slot ${slot}`).toBe(slot);
          expect(flagSource(flag), `${scope} slot ${slot}`).toBe(scope);
        }
      }
      expect(mapped).toBeGreaterThan(100);
    }
    expect(unlockSlotCount("account")).toBe(909);
    expect(unlockSlotCount("offer")).toBe(197);
    expect(unlockSlotCount("character")).toBe(549);
    expect(flagCount()).toBe(1988);
  });

  it("reads the character slots of the new-guardian flags", () => {
    // Character slots 313-320 are flags 1233-1240.
    expect(slotFlag("character", 313)).toBe(1233);
    expect(slotFlag("character", 320)).toBe(1240);
  });

  it("times the release flags", () => {
    expect(flagSetTime(250)).toBe(1_417_510_800n);
    expect(flagSetTime(252)).toBe(1_425_978_000n);
    expect(timedFlags().has(244)).toBe(true);
  });

  it("holds Epic Raider's flag in the achievement records", () => {
    expect(recordFlags()[40]).toBe(112);
  });
});
