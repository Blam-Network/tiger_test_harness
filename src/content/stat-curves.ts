// Stat curves, read off the disc packages on first use. A curve's index is
// its stat's index.
import { fnv1 } from "@blamnetwork/bullshcript/destiny1/common";
import type { StatCurve, StatCurvePoint } from "./model/investment";
import { contentBuild } from "./versions";

export type {
  StatCurve,
  StatCurvePoint,
  StatCurveSlotWeight,
} from "./model/investment";

let curves: readonly StatCurve[] | undefined;

function statCurves(): readonly StatCurve[] {
  curves ??= contentBuild().readers.statCurves();
  return curves ?? [];
}

export function statCurve(index: number): StatCurve | undefined {
  return statCurves()[index];
}

// The curve of the stat with this name, e.g. "weapon_power".
export function statCurveByName(name: string): StatCurve | undefined {
  const hash = fnv1(name) >>> 0;
  return statCurves().find((curve) => curve.nameHash >>> 0 === hash);
}

// Linear between the points, clamped at the ends.
export function evaluateStatCurve(points: StatCurvePoint[], x: number): number {
  if (points.length === 0) {
    return 0;
  }
  if (x <= points[0].x) {
    return points[0].y;
  }
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (x <= b.x) {
      return b.x === a.x ? b.y : a.y + ((x - a.x) * (b.y - a.y)) / (b.x - a.x);
    }
  }
  return points.at(-1)?.y ?? 0;
}

// The part of a curve from the last point at or before `x` on, where a curve
// may open with points of an earlier stretch.
export function statCurveFrom(
  points: readonly StatCurvePoint[],
  x: number
): StatCurvePoint[] {
  let from = 0;
  points.forEach((point, index) => {
    if (point.x <= x) {
      from = index;
    }
  });
  return points.slice(from);
}

// A curve inverted: the x at which it reaches y. Below the first point's y it
// is that point's x, past the last point's y the last point's x.
export function invertStatCurve(
  points: readonly StatCurvePoint[],
  y: number
): number {
  const last = points.at(-1);
  if (!last) {
    return 0;
  }
  if (y >= last.y) {
    return last.x;
  }
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    if (y < b.y) {
      return y < a.y ? a.x : a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x);
    }
  }
  return last.x;
}
