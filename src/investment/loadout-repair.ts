// Brings a stored character's items in line with the loaded definitions on
// read. Nothing is deleted: rows move to their def's real bucket, bad equips
// go back to the bag, the class kit is added and fills empty slots. Until
// the granted-gear equip crash is understood, equipped armour and weapons
// outside the class kit go back to the bag too (LoadoutRepairOptions).

import { bucketIds } from "../content/inventory";
import { itemDef } from "../content/items";
import { type LoadoutSeed, starterItems } from "./loadout";

interface LoadoutRepairOptions {
  // Keep non-kit armour / weapons equipped (debug-toggles.json
  // allowGrantedEquip). Off, they go back to the bag on every read, so a
  // saved equip that crashes the console cannot crash-loop sign-in.
  allowGrantedEquip?: boolean;
}

let gearBuckets: ReadonlySet<number> | undefined;

// Buckets whose equipped item the character build renders.
function renderedBuckets(): ReadonlySet<number> {
  const ids = bucketIds();
  gearBuckets ??= new Set([
    ids.kinetic,
    ids.energy,
    ids.power,
    ids.helmet,
    ids.gauntlets,
    ids.chest,
    ids.legs,
    ids.classItem,
  ]);
  return gearBuckets;
}

// The character_item columns the repair reads.
export interface StoredItemRow {
  art_arrangement: number;
  bucket: number;
  def_index: number;
  equip_slot: number | null;
  id: number;
  instanced: boolean;
  sandbox_pattern: number;
}

export interface ItemRowUpdate {
  data: Partial<
    Pick<
      StoredItemRow,
      "art_arrangement" | "bucket" | "equip_slot" | "sandbox_pattern"
    >
  >;
  id: number;
}

interface LoadoutRepair {
  // Starter items (kit and currency) the character never had, to the bag.
  creates: LoadoutSeed[];
  updates: ItemRowUpdate[];
}

// One pass. Rows created by a pass are only equipped by the next one (they
// have no id yet), so the store runs it until nothing is left to do.
export function planLoadoutRepair(
  rows: readonly StoredItemRow[],
  classIndex: number,
  options: LoadoutRepairOptions = {}
): LoadoutRepair {
  const starters = starterItems(classIndex);
  const kitDefForSlot = new Map(
    starters
      .filter((seed) => seed.equipSlot !== null)
      .map((seed) => [seed.equipSlot, seed.defIndex])
  );
  const updates = new Map<number, ItemRowUpdate["data"]>();
  const update = (id: number, data: ItemRowUpdate["data"]) => {
    updates.set(id, { ...updates.get(id), ...data });
  };
  const slotOf = new Map<number, number | null>();

  for (const row of rows) {
    slotOf.set(row.id, row.equip_slot);
    // Currency and material stacks use bucket 0, the bag's currency
    // alias; leave them be.
    if (!row.instanced) {
      continue;
    }
    const def = itemDef(row.def_index);
    if (
      def &&
      (def.bucket !== row.bucket ||
        def.sandboxPattern !== row.sandbox_pattern ||
        def.artArrangement !== row.art_arrangement)
    ) {
      update(row.id, {
        bucket: def.bucket,
        sandbox_pattern: def.sandboxPattern,
        art_arrangement: def.artArrangement,
      });
    }
    if (row.equip_slot === null) {
      continue;
    }
    const kitItem = kitDefForSlot.get(row.equip_slot) === row.def_index;
    const valid =
      def?.equipSlot === row.equip_slot &&
      (kitItem ||
        options.allowGrantedEquip ||
        !renderedBuckets().has(def.bucket));
    if (!valid) {
      update(row.id, { equip_slot: null });
      slotOf.set(row.id, null);
    }
  }

  const have = new Set(rows.map((row) => row.def_index));
  const creates = starters
    .filter((seed) => !have.has(seed.defIndex))
    .map((seed) => ({ ...seed, equipSlot: null }));

  // A kit slot left empty gets the kit item back from the bag.
  const occupied = new Set([...slotOf.values()].filter((s) => s !== null));
  for (const [slot, defIndex] of kitDefForSlot) {
    if (slot === null || occupied.has(slot)) {
      continue;
    }
    const row = rows.find(
      (r) =>
        r.instanced && r.def_index === defIndex && slotOf.get(r.id) === null
    );
    if (row) {
      update(row.id, { equip_slot: slot });
      slotOf.set(row.id, slot);
      occupied.add(slot);
    }
  }

  return {
    creates,
    updates: [...updates].map(([id, data]) => ({ id, data })),
  };
}
