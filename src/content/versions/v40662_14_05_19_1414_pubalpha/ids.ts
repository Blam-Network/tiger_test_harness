import type { ContentIds } from "../content-build";

// Equip slots 0..13 order the equipped soid and gear slot arrays, as the live
// build's: every equipable item def's slot holds one bucket, the live build's
// bucket for that slot. The packages order the slots but don't name them.
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
  // The defaults' lists hold the armour and the class emblem only. Weapons are
  // the tier 1 family at defs 1764..1772 (level formula {1,0,0,0}), whose
  // slots fall as the live build's picks from 3159..3167 do (primary +0,
  // heavy +5, special +8): Khvostov 7G-02, Baron RS/2 and Calcutta-LR2.
  // Phaeton Class v1 is the ship, Sparrow S-10 the sparrow and Generalist
  // Shell, the one basic shell, the ghost.
  starterPicks: {
    primary: 1764,
    special: 1772,
    heavy: 1769,
    ship: 1550,
    vehicle: 1696,
    ghost: 766,
  },
  tier: { legendary: 4, exotic: 5 },
  unlockFlagSet: 2,
};
