// Which unlock flags the server sets, by flag index. The flags are numbered,
// not named (their name hashes are not cracked). Which slot sets a flag, and
// which flags the time table owns, come from the packages
// (content/unlock-flags.ts). A slot value of 2 sets its flag; 0/1 clear it.
// Every pick is read off this build's own activity definitions, director
// nodes and slot tables. A flag another build's flag table shares by name hash
// is noted as "38464: n", "40662: n" or "41375: n".

// Promo vendor offers: the Ghost and Sparrow gates (38464: 1333, 1335, 1336;
// 40662: 1588, 1590, 1591).
export const VENDOR_OFFER_FLAGS: readonly number[] = [1503, 1505, 1506];

// Left clear among the offer slots:
// - 1614: cosmo_portal_1, cosmo_patrols_1 and city_tower_default1 (303, 304,
//   305) are visible only while it is clear.
// - 1615 makes dlc_test_activity (301) visible, and 1616 lifts its node on
//   this build's destination (854393bc) from teaser to available.
// - 1602 (38464: 1442, 40662: 1687, 41375: 1840) makes the debug
//   destination's dlc_test_activity (288) visible.

// This build's own destination (3da7a9e3): nodes 881eb920, 410a07b0 and
// 6796a864 offer cosmo_portal_1 (303), cosmo_patrols_1 (304) and
// city_tower_default1 (305), whose launch lists are this flag alone, and are
// available (state 3) on it. Its other nodes (act_cosmo_m0_highway,
// act_cosmo_m0_5_hangar, act_cosmo_m1_dome_a and act_cosmo_m2_dome_c) are
// teasers whatever is set. No other build's flag has its name hash.
export const DESTINATION_FLAG = 1612;

export const UNLOCKED_CHARACTER_FLAGS: readonly number[] = [
  DESTINATION_FLAG,
  // Inventory bucket locks: a bucket shows as locked while its flag is clear;
  // the real server sets them as the new guardian finds each kind. 38464:
  // 1221..1231, 40662: 1477..1487.
  1382, // consumables
  1384, // materials
  1386, // ships
  1389, // vehicles
  1390, // heavy weapons
  1391, // primary weapons
  1392, // special weapons
];

// Left clear: 93, city_tower_default1's (0) launch flag (the main destination
// a67020cb also reads it, and this build's own Tower is 305); 52, the Crucible
// account flag (38464: 54, 40662: 29, 41375: 70); 1591, 1592 and 1608 (38464:
// 1421, 1422, 1436), which join and launch the debug destination's (0248be86)
// test activities and its Tower copy (294).

// Not set at all: universe flags (every pick has a slot, and nothing the
// loadable activities need reads a flag only the universe list could force),
// the prologue flag 1693 (38464: 1518, 40662: 1718, 41375: 1871; nothing reads
// it) and subclass / progression flags (the equip lists are their class flags
// alone, and the progression flags, 38464: 1300, have no slot).
