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
// present and zero as in a retail capture, at this build's lengths (17 and 5;
// 41375's first has 27).
export const PEER_PRIMARY_UNKNOWN2_COUNT = 17;
export const PEER_PRIMARY_UNKNOWN3_COUNT = 5;

// Two lists of 16 i16 the client reads for the gear block (true names
// unknown), -1 where unused. 41375's capture has two entries in each (912,
// 439 / 543, 435); what they index is unknown, so this build sends none.
export const GEAR_LIST_7: readonly number[] = Array.from(
  { length: 16 },
  () => -1
);
export const GEAR_LIST_8: readonly number[] = Array.from(
  { length: 16 },
  () => -1
);

// Armor / Agility / Recovery of each subclass's auto-granted stat node, by
// subclass def. The pre-alpha's subclass grids (61, 63..65, 68, 69, 187) have
// no stat node at all, so no subclass adds any.
export const SUBCLASS_BASE_STATS: ReadonlyMap<number, readonly StatPair[]> =
  new Map();
