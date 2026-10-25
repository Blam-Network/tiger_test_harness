import { levelForXp } from "../../investment/character-level";
import type { CharacterRecord } from "../../investment/character-store";
import type { StatPair } from "../../investment/loadout";

// The power an owned item carries: the authored value (a vendor purchase
// keeps its entry's, investment/vendor.ts), else the character's level, the
// scale the stat curve reads it on (starting gear, loot).
export function itemPower(
  authored: number | undefined,
  character: CharacterRecord
): number {
  return authored && authored > 0
    ? authored
    : levelForXp(character.progressionXp);
}

// Stat 0, "power": the equipped gear's average power through the stat-0 curve,
// 50 + 50 * power. Left out, the power level clamps to its floor and combat
// runs at it.
export function characterPowerStat(character: CharacterRecord): StatPair {
  const powers: number[] = [];
  for (let slot = 0; slot < 20; slot++) {
    const item = character.loadout.equipped(slot);
    if (item?.instanced) {
      powers.push(itemPower(item.power, character));
    }
  }
  const power =
    powers.length > 0
      ? Math.round(powers.reduce((sum, p) => sum + p, 0) / powers.length)
      : 0;
  return [0, 50 + 50 * power];
}

// Stat 0's main curve, {x, y} points. Matches none of the package stat curves
// (curve 0 there is a different, level 1-50 curve), so it stays hand-written.
const POWER_STAT_CURVE: readonly (readonly [number, number])[] = [
  [0, 50],
  [20, 1050],
  [200, 10_050],
];
// The client never lets the power level fall below this.
const POWER_LEVEL_FLOOR = 0.0001;

// The Power Level the client works out from what we send (xetrov logs it
// x 10000 as characterPowerLevel): stat 0 run backwards through its curve,
// then floored. Not the character level.
export function characterPowerLevel(character: CharacterRecord): number {
  const [, value] = characterPowerStat(character);
  return Math.max(POWER_LEVEL_FLOOR, inverseCurve(POWER_STAT_CURVE, value));
}

// The x at which a curve reaches y. Clamped to the first and last points,
// linear between.
function inverseCurve(
  points: readonly (readonly [number, number])[],
  y: number
): number {
  let [x0, y0] = points[0] ?? [0, 0];
  if (y <= y0) {
    return x0;
  }
  for (const [x1, y1] of points.slice(1)) {
    if (y <= y1) {
      return x0 + ((y - y0) * (x1 - x0)) / (y1 - y0);
    }
    [x0, y0] = [x1, y1];
  }
  return x0;
}
