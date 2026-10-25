// Which unlock flags the server sets, by flag index. The flags are numbered,
// not named (their name hashes are not cracked). Which slot sets a flag, and
// which flags the time table owns, come from the packages
// (content/unlock-flags.ts). A slot value of 2 sets its flag; 0/1 clear it.
// Every pick is read off this build's own activity definitions, director
// nodes, item defs, progressions, vendors and bucket display rows. A flag the
// 40662 or 41375 flag tables share by name hash is noted as "40662: n" or
// "41375: n".

// Promo vendor offers: positive-only gates on the unlock lists of vendor
// e97aaa75's Ghost JYX (685), Ghost JYS-01 (684) and Vanguard Sparrow (2236).
// 40662: 1588, 1590, 1591.
export const VENDOR_OFFER_FLAGS: readonly number[] = [1333, 1335, 1336];

// Left clear among the offer slots: 1442 (40662: 1687, 41375: 1840) makes
// dlc_test_activity visible, and 1328..1332, 1334, 1337..1341 are read by
// nothing.

// The pre-alpha's own destination (4eb4c784): nodes adc05304, ece6d653,
// 59ad083e and 69abcba5 offer activities 238 (cosmo_portal_1), 239
// (cosmo_patrols_1), 240 (city_tower_default1) and 243 (the Crucible playlist
// of pvp_factory 241 and pvp_marsbattle 242), whose launch lists are this flag
// alone: the activities the packages hold a scenario for. Its nodes' states
// need nothing. No 40662 or 41375 flag has its name hash.
export const PREALPHA_FLAG = 1443;

export const UNLOCKED_CHARACTER_FLAGS: readonly number[] = [
  PREALPHA_FLAG,
  // Inventory bucket locks: a bucket shows as locked while its flag is clear;
  // the real server sets them as the new guardian finds each kind. 40662:
  // 1477..1487, 41375: 1630..1640. The pre-alpha has no shader slot, and no
  // row reads 1224 (41375: 1633, shaders).
  1221, // consumables
  1223, // materials
  1225, // ships
  1228, // vehicles
  1229, // heavy weapons
  1230, // primary weapons
  1231, // special weapons
];

// Left clear: 87, the Tower reveal (city_tower_default1 (0) launches on it and
// it lifts the main destination's Cosmodrome nodes, which the packages hold no
// scenario for; activity 240 is the pre-alpha's Tower); 1445 (picks
// dlc_test_activity 236 over the nameless 235); 54, the Crucible account flag
// (40662: 29, 41375: 70; its nodes also need a rotation flag, 1265..1282, no
// slot or clock sets); 1421, 1422 and 1436 (41375: 1829, 1830, 1841), which
// launch the test activities and the test copies of the Tower and Rusted
// Lands.

// Not set at all: universe flags (every pick has a slot, and nothing the
// loadable activities need reads a flag only the universe list could force),
// the prologue flag 1518 (40662: 1718, 41375: 1871; the unlock group table is
// bare) and subclass / progression flags (the equip lists are their class
// flags alone, 1213, 1220, 1238; the one progression flag read positively,
// 1300, 40662: 1548, 41375: 1701, has no slot). The Tower is the pre-alpha's
// node 59ad083e, offering activity 240 with no requirement; there are no Iron
// Banner or Queen states.
