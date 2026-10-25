import type { ContentIds } from "../content-build";

// The alpha's equip slots count from 1 (0 is unused); an item's slot is the
// ordinal of its bucket among the inventory table's equippable rows, so each
// bucket is equip_slot_buckets()[slot - 1]. The packages order them but don't
// name them; the buckets' names are the client's (bucket 16 is its shader).
// Slot 13 is the shader's, which the live build also numbers last but one. No
// equip slot of the alpha is an emblem.
export const IDS: ContentIds = {
  equipSlot: {
    subclass: 1,
    helmet: 2,
    gauntlets: 3,
    chest: 4,
    legs: 5,
    classItem: 6,
    primary: 7,
    special: 8,
    heavy: 9,
    ship: 10,
    vehicle: 11,
    ghost: 12,
    shader: 13,
    emblem: -1,
  },
  bucket: {
    subclass: 7,
    helmet: 8,
    gauntlets: 9,
    chest: 10,
    legs: 11,
    classItem: 12,
    kinetic: 3,
    energy: 4,
    power: 5,
    emblem: -1,
  },
  // The alpha's kits give a weapon for the primary slot; the special and
  // heavy are the tier 1 sniper rifle and rocket launcher, the ship a tier 1
  // one, with the sparrow and the ghost.
  starterPicks: {
    special: 963,
    heavy: 962,
    ship: 916,
    vehicle: 943,
    ghost: 450,
  },
  // The alpha's item defs carry no class, so none of its nine subclass defs
  // (434..442) can be matched to one. Its server gave every class the first.
  starterSubclass: { 0: 434, 1: 434, 2: 434 },
  // Currency, basic, common, one tier whose name is unknown, exotic. The
  // unnamed tier is the best below exotic, so it takes legendary's part (at
  // this point it might be called superior).
  tier: { legendary: 3, exotic: 4 },
  unlockFlagSet: 2,
};
