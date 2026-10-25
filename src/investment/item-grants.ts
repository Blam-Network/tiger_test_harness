// Plans the dev gear grants (dev-config/item-grants.ts, which documents the
// rules) against a character's stored rows. A grant fits its bucket against
// bucketSlotCounts and the equipped item counts.

import { itemDef, itemName } from "../content/items";
import type { ItemGrant, ItemGrants } from "../dev-config/item-grants";
import { bucketSlotCounts } from "./inventory-layout";
import type { LoadoutSeed } from "./loadout";
import type { ItemRowUpdate, StoredItemRow } from "./loadout-repair";

type ItemGrantSkip =
  | "already owned"
  | "bucket full"
  | "class"
  | "label mismatch"
  | "not equipable"
  | "other character"
  | "unknown def";

interface ItemGrantPlan {
  creates: LoadoutSeed[];
  skipped: { grant: ItemGrant; reason: ItemGrantSkip }[];
  updates: ItemRowUpdate[];
}

// One pass over a character's stored rows: the seeds to insert and, for an
// equip grant, the row its slot displaces. Grants run in file order, so the
// first ones get a bucket's room.
export function planItemGrants(
  rows: readonly StoredItemRow[],
  classIndex: number,
  characterSoid: bigint,
  grants: ItemGrants
): ItemGrantPlan {
  const creates: LoadoutSeed[] = [];
  const skipped: ItemGrantPlan["skipped"] = [];
  const updates = new Map<number, ItemRowUpdate["data"]>();
  const owned = new Set(rows.map((row) => row.def_index));
  const used = new Map<number, number>();
  const slotRows = new Map<number, StoredItemRow>();
  for (const row of rows) {
    used.set(row.bucket, (used.get(row.bucket) ?? 0) + 1);
    if (row.equip_slot !== null) {
      slotRows.set(row.equip_slot, row);
    }
  }

  for (const grant of grants.grants) {
    const skip = (reason: ItemGrantSkip) => skipped.push({ grant, reason });
    if (grant.characters && !grant.characters.includes(characterSoid)) {
      skip("other character");
      continue;
    }
    const def = itemDef(grant.defIndex);
    if (!def) {
      skip("unknown def");
      continue;
    }
    if (grant.label !== undefined && grant.label !== itemName(grant.defIndex)) {
      skip("label mismatch");
      continue;
    }
    const capacity = bucketSlotCounts()[def.bucket];
    if (!def.instanced || def.equipSlot === null || capacity === undefined) {
      skip("not equipable");
      continue;
    }
    if (def.classIndex !== -1 && def.classIndex !== classIndex) {
      skip("class");
      continue;
    }
    if (owned.has(grant.defIndex)) {
      skip("already owned");
      continue;
    }
    if ((used.get(def.bucket) ?? 0) >= capacity) {
      skip("bucket full");
      continue;
    }
    let equipSlot: number | null = null;
    if (grant.equip) {
      equipSlot = def.equipSlot;
      const current = slotRows.get(equipSlot);
      if (current) {
        updates.set(current.id, { equip_slot: null });
        slotRows.delete(equipSlot);
      }
      const pending = creates.find((seed) => seed.equipSlot === equipSlot);
      if (pending) {
        pending.equipSlot = null;
      }
    }
    creates.push({
      defIndex: grant.defIndex,
      bucket: def.bucket,
      sandboxPattern: def.sandboxPattern,
      artArrangement: def.artArrangement,
      equipSlot,
      instanced: true,
      quantity: 1,
      power: 0,
      level: grant.level ?? grants.defaults.level ?? 0,
      quality: grant.quality ?? grants.defaults.quality ?? 0,
    });
    owned.add(grant.defIndex);
    used.set(def.bucket, (used.get(def.bucket) ?? 0) + 1);
  }

  return {
    creates,
    skipped,
    updates: [...updates].map(([id, data]) => ({ id, data })),
  };
}
