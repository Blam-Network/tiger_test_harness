// Item definitions, read off the disc packages on first use. The item
// table's row order is the item definition index the wire uses. Names are the
// English display names.
import { classFlagRanges } from "./class-flags";
import { weaponBuckets } from "./inventory";
import type { ItemDef, ItemRecord } from "./model/investment";
import { contentBuild } from "./versions";

export type { ItemDef } from "./model/investment";

// The build's item tiers (def tier): the item filters' rarity steps.
export function tierIds() {
  return contentBuild().ids.tier;
}

// The wire class index of an equip unlock made of one class flag, -1 for
// another.
function classFor(flag: number | null): number {
  if (flag === null) {
    return -1;
  }
  const range = classFlagRanges().find(
    ([low, high]) => flag >= low && flag <= high
  );
  return range ? range[2] : -1;
}

function itemDefOf(record: ItemRecord): ItemDef {
  return {
    bucket: record.bucket,
    equipSlot: record.equipSlot,
    sandboxPattern: record.sandboxPattern,
    scaling: record.scaling,
    artArrangement: record.artArrangement,
    instanced: record.instanced,
    classIndex: classFor(record.classFlag),
    tier: record.tier,
    level: record.level,
    quality: record.quality,
    maxStack: record.maxStack,
    gridIndex: record.gridIndex,
    weaponStats: weaponBuckets().has(record.bucket) ? record.stats : [],
  };
}

let defs: readonly ItemDef[] | undefined;

// Every item definition, in item table order.
export function itemDefs(): readonly ItemDef[] {
  if (!defs) {
    defs = contentBuild().readers.itemDefinitions().map(itemDefOf);
  }
  return defs ?? [];
}

// The item definition at an item table index, undefined past the table.
export function itemDef(defIndex: number): ItemDef | undefined {
  return itemDefs()[defIndex];
}

const names = new Map<number, string>();

// The def's display name (English string bank), "" when it has none.
export function itemName(defIndex: number): string {
  const cached = names.get(defIndex);
  if (cached !== undefined) {
    return cached;
  }
  const name =
    defIndex >= 0 && defIndex < itemDefs().length
      ? contentBuild().readers.itemName(defIndex)
      : "";
  names.set(defIndex, name);
  return name;
}
