// The gear block's stat blocks (members 9..12) as the client's own builder
// makes them (sub_831C5A80): per equipped item the stats of its def and of its
// grid's activated steps, each through the stat curve, summed by stat index;
// the self character's member 16 overrides then win, and only values > 0 are
// packed, in stat order, at most 16.

// The player reads them back: light (stat 0) lifts its combat level past the
// cap, Defense (1) is run back through its curve into a defense level, Armor /
// Agility / Recovery (2..4) are used raw and Intellect / Discipline / Strength
// (5..7) as 10 * value / curve(level), clamped 0..10. A weapon's Attack
// (stat 10) becomes its attack level.

import { equipSlotIds } from "../../../content/inventory";
import { itemDef } from "../../../content/items";
import { characterConstants } from "../../../content/progressions";
import { evaluateStatCurve, statCurve } from "../../../content/stat-curves";
import { statOverride } from "../../../investment/character-level";
import type { CharacterRecord } from "../../../investment/character-store";
import { type StatPair, starterSubclassDef } from "../../../investment/loadout";
import {
  itemPrimaryStat,
  primaryStatX,
} from "../../../investment/primary-stat";
import { SUBCLASS_BASE_STATS } from "./character-values";

const STAT_SLOTS = 16;
const EQUIP_SLOTS = 20;

// Character constants stat roles (+88..): [0] light, [5] Defense, [28..30]
// Intellect, Discipline, Strength.
const LIGHT_ROLE = 0;
const DEFENSE_ROLE = 5;
const ROLL_ROLES = [28, 29, 30];

// Armour's Intellect / Discipline / Strength come from its grid's
// auto-granted roll node: one stat at 1.15..1.35 of the curve or two at
// 0.6..0.7. Grids are not read yet, so every piece gets a middling roll
// split evenly over the three.
const ROLL_SCALE = 1.25;

// One stat of one item (sub_831CA5B8): a non-zero authored value as it is,
// else the stat's curve at level + quality / 10, times the item's equip
// slot weight over the sum of the weights (no weights: all of it; a slot
// the weights leave out: none), times the step's scale, truncated.
export function itemStat(
  stat: number,
  value: number,
  equipSlot: number,
  item: { level: number; quality: number },
  scale = 1
): number {
  if (value !== 0) {
    return Math.trunc(value * scale);
  }
  const curve = statCurve(stat);
  if (!curve || curve.points.length === 0) {
    return 0;
  }
  let factor = 1;
  if (curve.slotWeights.length > 0) {
    const total = curve.slotWeights.reduce((sum, w) => sum + w.weight, 0);
    const weight = curve.slotWeights.find(
      (w) => w.equipSlot === equipSlot
    )?.weight;
    factor = weight === undefined ? 0 : weight / total;
  }
  const y = evaluateStatCurve(
    curve.points,
    primaryStatX(curve, item.level, item.quality)
  );
  return Math.trunc(factor * y * scale);
}

// The stats above 0 in index order, at most 16.
function packStats(stats: ReadonlyMap<number, number>): StatPair[] {
  return [...stats]
    .filter(([, value]) => value > 0)
    .sort(([a], [b]) => a - b)
    .slice(0, STAT_SLOTS);
}

function addStat(stats: Map<number, number>, stat: number, value: number) {
  stats.set(stat, (stats.get(stat) ?? 0) + value);
}

// Member 9: light and Defense from the armour, Intellect / Discipline /
// Strength from its rolls, Armor / Agility / Recovery from the subclass,
// then the self character's stat overrides (light past the level cap).
export function characterStats(character: CharacterRecord): StatPair[] {
  const roles = characterConstants().stats;
  const light = roles[LIGHT_ROLE]!;
  const defense = roles[DEFENSE_ROLE]!;
  const rolls = ROLL_ROLES.map((role) => roles[role]!);
  const stats = new Map<number, number>();
  for (let slot = 0; slot < EQUIP_SLOTS; slot++) {
    const item = character.loadout.equipped(slot);
    const def = item && itemDef(item.defIndex);
    if (!(item && def) || def.equipSlot === null) {
      continue;
    }
    // The armour slots' share of each curve (other slots weigh nothing):
    // Defense from the def, light from the auto-granted light node every
    // armour grid has, the rolls from its roll node.
    const primary = itemPrimaryStat(item);
    addStat(stats, defense, itemStat(defense, 0, def.equipSlot, primary));
    addStat(stats, light, itemStat(light, 0, def.equipSlot, primary));
    const scale = ROLL_SCALE / rolls.length;
    for (const stat of rolls) {
      addStat(stats, stat, itemStat(stat, 0, def.equipSlot, primary, scale));
    }
  }
  const subclass =
    character.loadout.equipped(equipSlotIds().subclass)?.defIndex ??
    starterSubclassDef(character.appearance.classIndex);
  for (const [stat, value] of SUBCLASS_BASE_STATS.get(subclass) ?? []) {
    addStat(stats, stat, value);
  }
  for (const pair of statOverride()?.unknown1.unknown0 ?? []) {
    if (pair.unknown0 !== -1) {
      stats.set(pair.unknown0, pair.unknown1);
    }
  }
  return packStats(stats);
}

// Members 10..12: the equipped weapon's def stats, its Attack (weapon_power,
// authored 0) off the curve at the item's level and quality.
export function weaponStats(
  character: CharacterRecord,
  slot: number
): StatPair[] {
  const item = character.loadout.equipped(slot);
  const def = item && itemDef(item.defIndex);
  if (!(item && def) || def.equipSlot === null) {
    return [];
  }
  const primary = itemPrimaryStat(item);
  const stats = new Map<number, number>();
  for (const [stat, value] of def.weaponStats) {
    addStat(stats, stat, itemStat(stat, value, def.equipSlot, primary));
  }
  return packStats(stats);
}
