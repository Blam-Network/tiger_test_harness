// The gear block's stat blocks (members 9..12) as the client's own builder
// makes them: per equipped item the stats of its def and of its grid's
// activated steps, each through the stat curve, summed by stat index; the self
// character's member 16 overrides then win, and only values > 0 are packed, in
// stat order, at most 16.

// The 40662 client reads them back: light (stat 0) lifts its combat level past
// the cap, Defense is run back through its curve into a defense level, Armor /
// Agility / Recovery are used raw and Intellect / Discipline / Strength as
// 10 * value / curve(level), clamped 0..10. This build's stat curves (power,
// stat_armor 1, stat_agility 2, stat_recovery 4, weapon_power 12, ...) have no
// stat_defense and none of the three roll stats, so armour adds light alone.
// Its reading of them is not checked.

import { equipSlotIds } from "../../../content/inventory";
import { itemDef } from "../../../content/items";
import { characterConstants } from "../../../content/progressions";
import { evaluateStatCurve, statCurve } from "../../../content/stat-curves";
import { levelForXp, statOverride } from "../../../investment/character-level";
import type { CharacterRecord } from "../../../investment/character-store";
import { type StatPair, starterSubclassDef } from "../../../investment/loadout";
import {
  itemPrimaryStat,
  primaryStatX,
} from "../../../investment/primary-stat";
import { SUBCLASS_BASE_STATS } from "./character-values";

// The character's own level: its XP on the level progression (a new character
// is level 1), as the screens and the progression rows show it.
export function characterLevelOf(character: CharacterRecord): number {
  return levelForXp(character.progressionXp);
}

const STAT_SLOTS = 16;
const EQUIP_SLOTS = 20;

// Character constants stat roles (30 here): [0] light (the power curve).
const LIGHT_ROLE = 0;

// One stat of one item: a non-zero authored value as it is,
// else the stat's curve at level + quality / 10, times the item's equip
// slot weight over the sum of the weights (no weights: all of it; a slot
// the weights leave out: none), times the step's scale, truncated.
function itemStat(
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

// Member 9: light from the armour, Armor / Agility / Recovery from the
// subclass, then the self character's stat overrides (light past the level
// cap).
export function characterStats(character: CharacterRecord): StatPair[] {
  const light = characterConstants().stats[LIGHT_ROLE]!;
  const stats = new Map<number, number>();
  for (let slot = 0; slot < EQUIP_SLOTS; slot++) {
    const item = character.loadout.equipped(slot);
    const def = item && itemDef(item.defIndex);
    if (!(item && def) || def.equipSlot === null) {
      continue;
    }
    // The armour slots' share of the light curve (other slots weigh
    // nothing), as 40662's auto-granted light node.
    const primary = itemPrimaryStat(item);
    addStat(stats, light, itemStat(light, 0, def.equipSlot, primary));
  }
  const subclass =
    character.loadout.equipped(equipSlotIds().subclass)?.defIndex ??
    starterSubclassDef(character.appearance.classIndex);
  for (const [stat, value] of SUBCLASS_BASE_STATS.get(subclass) ?? []) {
    addStat(stats, stat, value);
  }
  const level = characterLevelOf(character);
  for (const pair of statOverride(level)?.unknown1.unknown0 ?? []) {
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
