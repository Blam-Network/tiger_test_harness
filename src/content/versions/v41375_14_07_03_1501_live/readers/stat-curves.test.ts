import { expect, it } from "vitest";
import { describeWithPackages } from "../../../../test-support/build";
import { statCurve, statCurveByName } from "../../../stat-curves";

describeWithPackages("stat curves on the disc", () => {
  it("finds curves by index and by name", () => {
    expect(statCurve(10)).toBe(statCurveByName("weapon_power"));
    expect(statCurve(1)).toBe(statCurveByName("stat_defense"));
    expect(statCurve(0)?.points).toEqual([
      { x: 1, y: 0 },
      { x: 20, y: 1 },
      { x: 20, y: 8 },
      { x: 21, y: 20 },
      { x: 30, y: 120 },
      { x: 40, y: 240 },
      { x: 50, y: 400 },
    ]);
  });

  it("reads the quality clamp and the defense slot weights", () => {
    expect(statCurve(10)?.qualityPoints).toEqual([
      { x: -100, y: -10 },
      { x: 250, y: 25 },
    ]);
    expect(
      statCurveByName("stat_defense")?.slotWeights.map((w) => [
        w.equipSlot,
        w.weight,
      ])
    ).toEqual([
      [1, 33],
      [2, 27],
      [3, 36],
      [4, 24],
    ]);
  });
});
