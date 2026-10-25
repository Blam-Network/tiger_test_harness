// An owned item's primary stat, a weapon's Attack or armour's Defense, as the
// client computes it from the replicated item:
//   x = level + clamp(quality / 10, -10, 25)
//   attack  = weapon_power curve(x)
//   defense = slot weight / sum of weights * stat_defense curve(x)
// Level, required level and quality are the item's 80801711 {i32 +0x18, i32
// +0x1C, i16 +0x20}; a row without its own takes the def's level block. The
// required level gates equipping against the level progression (109). The
// talent grid would add to quality per activated step; items send none.

import { weaponBuckets } from "../content/inventory";
import { itemDef } from "../content/items";
import {
  evaluateStatCurve,
  type StatCurve,
  statCurveByName,
} from "../content/stat-curves";
import type { LoadoutItem } from "./loadout";

export interface ItemPrimaryStat {
  level: number;
  quality: number;
  requiredLevel: number;
}

// The stat curves the two stats read, by stat name.
const WEAPON_POWER_STAT = "weapon_power";
const DEFENSE_STAT = "stat_defense";

function curveOf(name: string): StatCurve {
  const curve = statCurveByName(name);
  if (!curve) {
    throw new Error(`no stat curve named ${name}`);
  }
  return curve;
}

// The curve input a stat shares: the level plus the quality, clamped by the
// stat curve's own quality points (in tenths).
export function primaryStatX(
  curve: StatCurve,
  level: number,
  quality: number
): number {
  return level + evaluateStatCurve(curve.qualityPoints, quality);
}

export function weaponAttack(level: number, quality: number): number {
  const curve = curveOf(WEAPON_POWER_STAT);
  return Math.trunc(
    evaluateStatCurve(curve.points, primaryStatX(curve, level, quality))
  );
}

// null for a slot with no Defense (class items, subclasses, ...). An armour
// slot's share of the defense curve is its weight over the weights' sum.
export function armourDefense(
  equipSlot: number,
  level: number,
  quality: number
): number | null {
  const curve = curveOf(DEFENSE_STAT);
  const weight = curve.slotWeights.find(
    (entry) => entry.equipSlot === equipSlot
  )?.weight;
  if (weight === undefined) {
    return null;
  }
  const total = curve.slotWeights.reduce((sum, entry) => sum + entry.weight, 0);
  const defense = evaluateStatCurve(
    curve.points,
    primaryStatX(curve, level, quality)
  );
  return Math.trunc((weight / total) * defense);
}

// What the item replicates: its own level / quality when it has them, else
// the def's; the required level is the def's level as the client's own
// seeding makes it (formula {1, 0, 0, 0}).
export function itemPrimaryStat(
  item: Pick<LoadoutItem, "defIndex" | "level" | "quality">
): ItemPrimaryStat {
  const def = itemDef(item.defIndex);
  return {
    level: item.level || (def?.level ?? 0),
    requiredLevel: def?.level ?? 0,
    quality: item.quality || (def?.quality ?? 0),
  };
}

// The number the item screen shows for a def with these instance values,
// null when the def has no primary stat.
export function displayedPrimaryStat(
  defIndex: number,
  stat: Pick<ItemPrimaryStat, "level" | "quality">
): number | null {
  const def = itemDef(defIndex);
  if (!def || def.equipSlot === null) {
    return null;
  }
  if (weaponBuckets().has(def.bucket)) {
    return weaponAttack(stat.level, stat.quality);
  }
  return armourDefense(def.equipSlot, stat.level, stat.quality);
}
