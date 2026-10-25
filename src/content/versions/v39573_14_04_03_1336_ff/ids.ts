import type { ContentIds } from "../content-build";

// Equip slots 0..13 order the equipped soid and gear slot arrays, as the
// Alpha Trial's: an item's slot is the ordinal of its bucket among the
// inventory table's equippable rows, the shader (Built-in Shader) last. The
// packages order the slots but don't name them; the items in them do.
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
  // The defaults' lists hold the armour and the class's starter emblem only,
  // as the Alpha Trial's. Weapons are the tier 1 family at defs 1123..1131,
  // one of each weapon class, with the pre-alpha's special and heavy (Nox
  // Titus II, Deluge M10) and its auto rifle, Falcon A2, as the primary.
  // Phaeton Class-A is the ship, Shrike SV-7 the sparrow and Ghost JYS-C,
  // the one basic shell, the ghost.
  starterPicks: {
    primary: 1123,
    special: 1127,
    heavy: 1130,
    ship: 1429,
    vehicle: 1612,
    ghost: 664,
  },
  tier: { legendary: 4, exotic: 5 },
  unlockFlagSet: 2,
};
