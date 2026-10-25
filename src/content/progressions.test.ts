import { describe, expect, it } from "vitest";
import { levelForXp, xpForLevel } from "./progressions";

const steps = (...costs: number[]) =>
  costs.map((xpRequired) => ({ xpRequired, grantedItem: 0xff_ff }));

describe("progression walk", () => {
  const ladder = { clampAtMax: false, steps: steps(0, 100, 200, 300) };

  it("counts the steps the XP covers", () => {
    expect(levelForXp(ladder, 0)).toEqual({
      level: 1,
      remainder: 0,
      nextRequirement: 100,
    });
    expect(levelForXp(ladder, 99).level).toBe(1);
    expect(levelForXp(ladder, 100).level).toBe(2);
    expect(levelForXp(ladder, 350)).toEqual({
      level: 3,
      remainder: 50,
      nextRequirement: 300,
    });
  });

  it("stops at the last step unless the progression clamps", () => {
    expect(levelForXp(ladder, 10_000).level).toBe(4);
    const clamped = { clampAtMax: true, steps: steps(0, 100) };
    expect(levelForXp(clamped, 100 * 5).level).toBe(6);
  });

  it("starts below level 1 when the first step costs something", () => {
    expect(levelForXp({ clampAtMax: false, steps: steps(5) }, 4).level).toBe(0);
  });

  it("gives the least XP for a level", () => {
    expect(xpForLevel(ladder, 1)).toBe(0);
    expect(xpForLevel(ladder, 3)).toBe(300);
    expect(xpForLevel(ladder, 99)).toBe(600);
    for (const level of [1, 2, 3, 4]) {
      expect(levelForXp(ladder, xpForLevel(ladder, level)).level).toBe(level);
    }
    expect(xpForLevel({ clampAtMax: true, steps: steps(0, 100) }, 4)).toBe(300);
  });
});
