// Which unlock flags the server sets, by flag index. The flags are numbered,
// not named (their name hashes are not cracked). Which slot sets a flag, and
// which flags the time table owns, come from the packages
// (content/unlock-flags.ts). A slot value of 2 sets its flag; 0/1 clear it.
// Every pick is read off this build's own activity definitions, director
// nodes, item defs, progressions, vendors, unlock group table and bucket
// display rows. A flag the 41375 flag table shares by name hash is noted as
// "41375: n".

// Promo / pre-order vendor offers: positive-only gates on sale items of
// vendor e97aaa75 (1214..1256 both lists, 1588 / 1590 / 1591 the unlock list)
// and of vendors e97aaa75, d745f67c, 6c94ed20 and 6bc7a0f5 (1573..1581, the
// purchase list). Setting them adds the items; nothing reads them negated.
// 41375: 1329..1371 and 1726..1734.
export const VENDOR_OFFER_FLAGS: readonly number[] = [
  ...range(1214, 1256),
  ...range(1573, 1581),
  1588,
  1590,
  1591,
];

// No ownership offers: the unlock group table has no groups, and nothing
// reads the release offers 1592..1596 (41375: 1745..1749, which its groups
// read).

// Left clear: 216 / 217 (41375: 270 / 271, platform offers). Every strike and
// Crucible map and playlist launches on (!216 || 217), and 216 picks the
// playlist variants with the platform-exclusive pvp_colony_ship ((216 ||
// 200)); with both clear the alpha's own playlist and maps launch. Also
// clear: 1582 (read negated by vendor 9f13dc06), 177 (Iron Banner playlist
// 20), 191 / 192 (orbit node 36dffc41), 1687 (dlc_test_activity), and the
// offer flags no expression reads (173..176, 178..190, 208..213, 215, 218,
// 1181..1213, 1583..1587, 1589, 1592..1596, 1694).

// Crucible: the launch list of every pvp map and playlist, and the alpha
// Crucible node 3585ff22 (available on it). 41375: 70.
export const UNLOCKED_ACCOUNT_FLAGS: readonly number[] = [29];

// Story progress the loadable activities' gates read. None of them is
// negated in an activity gate.
export const UNLOCKED_CHARACTER_FLAGS: readonly number[] = [
  71, // Tower reveal: city_tower_default1's launch list (41375: 115)
  72, // act_cosmo_m0_5_hangar done: act_cosmo_m1_dome_a's launch list (72 || 219) (41375: 116)
  74, // act_cosmo_m1_dome_a done (its completion flag): cosmo_patrols_1's launch list (41375: 118)
  165, // cosmo_portal_1's launch list, its node 881eb920 teaser -> available (41375: 214)
  // Inventory bucket locks: a bucket shows as locked ("You have not yet found
  // a Primary Weapon.") while its flag is clear; the real server sets them as
  // the new guardian finds each kind. 41375: 1630..1640.
  1477, // consumables
  1479, // materials
  1480, // shaders
  1481, // ships
  1484, // vehicles
  1485, // heavy weapons
  1486, // primary weapons
  1487, // special weapons
];

// Not set: 221 (41375: 277), the new-guardian state. It drops the alpha
// Cosmodrome nodes (destination 2c3447f2) and the Tower node to teaser 2 and
// swaps the alpha Crucible node to playlist 6; 219 opens playlist 5 instead.
// 1677 (41375: 1830) opens only the test nodes (destination 2372d36d:
// transition_test_activity, perf_warp_ruins, dlc_test_activity, takehome_map).

// Flags no slot table carries and the time table never sets are forced by the
// universe list (ServerObject.unknown3, max 20, applied after every other
// storage type except debug). Value 2 = set.
// - 219: the alpha trial (41375: 273). The prologue picks activity 2 (then
//   act_cosmo_m1_dome_a) over activity 82 (then act_cosmo_m0_highway) on it,
//   act_cosmo_m1_dome_a and Crucible playlist 5 launch on it, and it hides
//   the Cosmodrome story activities this build has no bundles for
//   (act_cosmo_m0_highway, cine_reveal, the hangar, cine_speaker, the dome_c
//   missions: visible list !219).
export const UNIVERSE_UNLOCK_FLAGS: readonly number[] = [219];

// Set: flag 1463 is the equip requirement of Bladedancer, Defender and
// Sunsinger (defs 648 / 651 / 652, equip list beside the class flag). Flags
// 1464..1469 each gate one subclass progression's row 3 (ce10ecdf, 25c481f4,
// 49a1865b, e29d4abf, 77169be3, 817f749e = progressions 98..103). 41375:
// 1616..1622.
export const SUBCLASS_ACCOUNT_FLAGS: readonly number[] = range(1463, 1469);

// Set: "(1297 || 1276)" is a row of 52 progressions (character level,
// subclasses, reputations). Positive only, true meaning unknown. 41375:
// 1438 / 1417. Its neighbour 1277 (41375: 1418, a character flag) is left
// out.
export const PROGRESSION_ACCOUNT_FLAGS: readonly number[] = [1276, 1297];

// The prologue-pending flag: every new-character defaults row sets it, and
// the unlock group table's prologue picks all need it (41375: 1871).
export const PROLOGUE_CHARACTER_FLAG = 1718;
// With 219 set the prologue picks activity 2, which has no bundle (as
// 41375's 4, its pick on 273) and names act_cosmo_m1_dome_a (91) next: the
// flag comes off when a character finishes that mission.
export const PROLOGUE_MISSION_ACTIVITY = 91;

// What else the 41375 policy forces has no use here: the release flags and
// rotation windows it reveals belong to activities this build cannot load,
// and its Tower states (Iron Banner, Queen's Wrath) are absent: the Tower
// node 6796a864 offers city_tower_default1 alone, with no requirement.

function range(first: number, last: number): number[] {
  return Array.from({ length: last - first + 1 }, (_, i) => first + i);
}
