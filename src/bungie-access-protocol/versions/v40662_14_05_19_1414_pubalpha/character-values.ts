// Canned values the self, peer and select families send where a real server
// would compute or store them.

import { fnv1 } from "@blamnetwork/bullshcript/destiny1/common";
import type { StatPair } from "../../../investment/loadout";
import { k_empty_name_hash } from "../../../utils/name-hash";

// The ammo fractions of a fresh profile: full magazine + reserve on every
// weapon slot (0 / absent spawns the guardian with "NO AMMO").
export const DEFAULT_PROFILE_AMMO = { unknown0: 1, unknown1: 1, unknown2: 1 };

// Orbit key: the profile's member 3, fnv1 of the orbit bubble the ship sits in
// ("orbit_earth", orbit_moon, orbit_venus, orbit_mars, orbit_reef). The client
// copies it into its fireteam session's "orbit" property and uploads it back
// in every 702. Empty (fnv1("")) makes the orbit_prologue state (30) take its
// no-orbit branch, which skips the outro cinematic; orbit_outro (31) then
// waits forever on the orbit cinematic nobody stops.
export const DEFAULT_ORBIT_KEY = fnv1("orbit_earth");
export const EMPTY_ORBIT_KEY = k_empty_name_hash;

// Self character member 8: shared dirty idx 6 is set by inventory bag;
// sent as 0.
export const SELF_CHARACTER_UNKNOWN8 = {
  unknown0: 1,
  unknown1: 1,
  unknown2: 0,
  unknown3: 5,
  unknown4: undefined,
  unknown5: 0n,
  unknown6: undefined,
  unknown7: undefined,
};

// Self character member 5 past the activity index and finished flag: the
// second activity index (-1, none) and two zero members.
export const SELF_CHARACTER_UNKNOWN5 = {
  unknown1: -1,
  unknown2: 0,
  unknown3: 0,
};

// The peer primary's two zeroed i16 tables, sent
// present with these lengths as in a retail capture.
export const PEER_PRIMARY_UNKNOWN2_COUNT = 27;
export const PEER_PRIMARY_UNKNOWN3_COUNT = 5;

// Two lists of 16 i16 the client reads for the gear block (true names
// unknown), -1 where unused.
export const GEAR_LIST_7: readonly number[] = [
  912, 439, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
];
export const GEAR_LIST_8: readonly number[] = [
  543, 435, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
];

// Armor / Agility / Recovery (stats 2 / 3 / 4) of each subclass's
// auto-granted stat node, by subclass def (grids 126 / 127 / 129 / 131 / 133
// / 134, the one auto node with stats). The other stat nodes are picked per
// column and add to these.
export const SUBCLASS_BASE_STATS: ReadonlyMap<number, readonly StatPair[]> =
  new Map([
    [
      648,
      [
        [2, 1],
        [3, 5],
        [4, 1],
      ],
    ], // Bladedancer
    [
      649,
      [
        [2, 1],
        [3, 5],
        [4, 1],
      ],
    ], // Gunslinger
    [
      650,
      [
        [2, 5],
        [3, 1],
        [4, 1],
      ],
    ], // Striker
    [
      651,
      [
        [2, 5],
        [3, 1],
        [4, 1],
      ],
    ], // Defender
    [
      652,
      [
        [2, 1],
        [3, 1],
        [4, 5],
      ],
    ], // Sunsinger
    [
      653,
      [
        [2, 1],
        [3, 1],
        [4, 5],
      ],
    ], // Voidwalker
  ]);
