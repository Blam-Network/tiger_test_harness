import { describe, expect, it } from "vitest";
import {
  evaluateStatCurve,
  invertStatCurve,
  statCurveFrom,
} from "./stat-curves";

const points = [
  { x: 1, y: 0 },
  { x: 20, y: 1 },
  { x: 20, y: 8 },
  { x: 30, y: 120 },
];

describe("stat curve maths", () => {
  it("evaluates linearly and clamps at the ends", () => {
    expect(evaluateStatCurve(points, 0)).toBe(0);
    expect(evaluateStatCurve(points, 25)).toBe(64);
    expect(evaluateStatCurve(points, 99)).toBe(120);
  });

  it("keeps the part of a curve from the last point at or before x", () => {
    expect(statCurveFrom(points, 20)).toEqual(points.slice(2));
    expect(statCurveFrom(points, 0)).toEqual(points);
  });

  it("inverts a curve, clamped to its ends", () => {
    const tail = statCurveFrom(points, 20);
    expect(invertStatCurve(tail, 64)).toBe(25);
    expect(invertStatCurve(tail, 0)).toBe(20);
    expect(invertStatCurve(tail, 500)).toBe(30);
    expect(invertStatCurve([], 5)).toBe(0);
  });
});
