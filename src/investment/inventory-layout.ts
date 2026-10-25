import { type InventoryBucket, inventoryBuckets } from "../content/inventory";

interface InventoryBucketRange extends InventoryBucket {
  // Best guess from the def slots and position; "unknown" where neither says.
  name: string;
}

// Names for the bucket ids; the packages don't name them.
const BUCKET_NAMES: Readonly<Record<number, string>> = {
  5: "materials",
  1: "consumables",
  6: "subclass",
  7: "helmet",
  8: "gauntlets",
  9: "chest",
  10: "legs",
  11: "class_item",
  2: "kinetic",
  3: "energy",
  4: "power",
  12: "ship",
  15: "mission",
  13: "sparrow",
  14: "ghost_shell",
  25: "emblem",
  27: "shader",
};

// The currency stacks' bucket id, an alias of the character scope: the
// currencies are in buckets (28..30) outside it, and have no bag slots of
// their own. Has no bucket 0; its slots 0..14 belong to id 5, so the
// alias points there.
export const CURRENCY_BUCKET = 0;
const CURRENCY_BUCKET_RANGE: InventoryBucketRange = {
  id: CURRENCY_BUCKET,
  firstSlot: 0,
  slotCount: 15,
  name: "currency",
};

// The character inventory def's buckets in bag slot order. The character scope
// runs 0..226 with no gaps.
export function inventoryBucketRanges(): readonly InventoryBucketRange[] {
  return inventoryBuckets().map((bucket) => ({
    ...bucket,
    name: BUCKET_NAMES[bucket.id] ?? "unknown",
  }));
}

let bagStarts: Readonly<Record<number, number>> | undefined;
let slotCounts: Readonly<Record<number, number>> | undefined;

function bagBuckets() {
  return [CURRENCY_BUCKET_RANGE, ...inventoryBucketRanges()];
}

// Where each bucket's items sit in the bag, from the character inventory def.
export function bucketBagStarts(): Readonly<Record<number, number>> {
  bagStarts ??= Object.fromEntries(
    bagBuckets().map((b) => [b.id, b.firstSlot])
  );
  return bagStarts;
}

// The same def's slot counts, for has_room_for_item style
// checks on a purchase: an instanced item needs a free row, a stack merges
// or needs one too.
export function bucketSlotCounts(): Readonly<Record<number, number>> {
  slotCounts ??= Object.fromEntries(
    bagBuckets().map((b) => [b.id, b.slotCount])
  );
  return slotCounts;
}

// The bucket a def's items are stored in: its own, else the currency alias
// when the character scope has no such bucket.
export function bagBucketFor(bucket: number): number {
  return bucketBagStarts()[bucket] === undefined ? CURRENCY_BUCKET : bucket;
}

export function bagIndexForBucket(bucket: number): number {
  return bucketBagStarts()[bucket] ?? -1;
}
