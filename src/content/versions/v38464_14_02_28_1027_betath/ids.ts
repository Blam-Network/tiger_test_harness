import type { ContentIds } from "../content-build";

// Equip slots 0..12 order the equipped soid and gear slot arrays, as the
// Alpha Trial's but with no shader: an item's slot is the ordinal of its
// bucket among the inventory table's equippable rows. The packages order the
// slots but don't name them; the items in them do (Squire Helm, Sparrow SV-7,
// Ghost JYS-C, Guardian Class Emblem).
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
    shader: -1,
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
    emblem: 26,
  },
  // The defaults' lists hold the armour and a primary, Sargon X1S (1605).
  // The special and heavy are the tier 1 pair beside it, Nox Titus II and
  // Deluge M10; Phaeton Class-A is the ship, Sparrow SV-7 the sparrow and
  // Ghost JYS-C, the one basic shell, the ghost.
  starterPicks: {
    special: 1606,
    heavy: 1608,
    ship: 2030,
    vehicle: 2224,
    ghost: 683,
  },
  // The class emblems come in pairs (1295..1300, name hashes one apart): the
  // first of each, by name. Hunter Class Emblem and Warlock Class Emblem name
  // their class; Guardian Class Emblem is the titan's by elimination. The
  // defs' equip unlocks name no class.
  starterEmblem: { 0: 1295, 1: 1297, 2: 1299 },
  tier: { legendary: 4, exotic: 5 },
  unlockFlagSet: 2,
};
