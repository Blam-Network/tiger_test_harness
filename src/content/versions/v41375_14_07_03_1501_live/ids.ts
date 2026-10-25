import type { ContentIds } from "../content-build";

// Equip slots 0..13 order the equipped soid and gear slot arrays. The packages
// order the slots but don't name them.
export const IDS: ContentIds = {
  equipSlot: {
    subclass: 0,
    helmet: 1,
    gauntlets: 2,
    chest: 3,
    legs: 4,
    classItem: 5,
    primary: 6,
    special: 7,
    heavy: 8,
    ship: 9,
    vehicle: 10,
    ghost: 11,
    emblem: 12,
    shader: 13,
  },
  bucket: {
    subclass: 6,
    helmet: 7,
    gauntlets: 8,
    chest: 9,
    legs: 10,
    classItem: 11,
    kinetic: 2,
    energy: 3,
    power: 4,
    emblem: 25,
  },
  // Weapons are the tier 1 family (defs 3159..3167, level formula {1,0,0,0});
  // Khvostov 7G-02 is the prologue auto rifle. Phaeton Class v1 is the ship
  // and Sign of the Ancients the emblem every character starts with.
  starterPicks: {
    primary: 3159,
    special: 3167,
    heavy: 3164,
    ship: 3048,
    emblem: 1562,
  },
  tier: { legendary: 4, exotic: 5 },
  unlockFlagSet: 2,
};
