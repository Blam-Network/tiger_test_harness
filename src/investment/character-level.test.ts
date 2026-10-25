import { expect, it } from "vitest";
import { destinationProgressions } from "../content/destinations";
import { characterConstants, levelProgression } from "../content/progressions";
import { describeWithPackages } from "../test-support/build";
import {
  effectiveLevel,
  levelCap,
  levelForLight,
  levelForXp,
  lightForLevel,
  progressionRows,
  statOverride,
  xpForLevel,
} from "./character-level";

describeWithPackages("character level", () => {
  // The reward tracker's unchecked lookups: constants roles 1
  // and 3, and each destination row's list. One row per index, the level's
  // first.
  it("carries a row for every progression the client dereferences", () => {
    const rows = progressionRows(5);
    const indices = rows.map((row) => row.unknown3);
    const { progressions } = characterConstants();
    expect(new Set(indices).size).toBe(indices.length);
    expect(indices[0]).toBe(levelProgression().index);
    expect(rows[0]?.unknown0).toBe(xpForLevel(5));
    expect(progressions[1]).toBe(109);
    expect(progressions[3]).toBe(110);
    for (const index of [...progressions, ...destinationProgressions()]) {
      expect(indices).toContain(index);
    }
    for (const row of rows.slice(1)) {
      expect(row.unknown0).toBe(0);
    }
  });

  it("walks progression 109 like sub_831B5190", () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(899)).toBe(1);
    expect(levelForXp(900)).toBe(2);
    expect(xpForLevel(20)).toBe(305_900);
    expect(levelForXp(xpForLevel(20))).toBe(levelCap());
    for (let level = 1; level <= 20; level++) {
      expect(levelForXp(xpForLevel(level))).toBe(level);
    }
    // Past the cap the XP clamps; light carries the rest.
    expect(xpForLevel(34)).toBe(305_900);
  });

  it("maps light to level along the stat 0 curve", () => {
    expect(levelForLight(120)).toBe(30);
    expect(levelForLight(240)).toBe(40);
    expect(levelForLight(1000)).toBe(50);
    for (let level = 21; level <= 50; level++) {
      const light = lightForLevel(level);
      expect(Math.floor(levelForLight(light))).toBe(level);
      expect(effectiveLevel(20, light)).toBe(level);
    }
  });

  it("ignores light below the progression cap", () => {
    expect(effectiveLevel(19, 400)).toBe(19);
    expect(lightForLevel(20)).toBe(0);
    expect(statOverride(20)).toBeUndefined();
    expect(statOverride(34)?.unknown1.unknown0).toHaveLength(7);
  });
});
