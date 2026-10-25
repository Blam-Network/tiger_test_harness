// Which unlock flags the server sets, by flag index. The flags are numbered,
// not named (their name hashes are not cracked). Which slot sets a flag, and
// which flags the time table owns, come from the packages
// (content/unlock-flags.ts). A slot value of 2 sets its flag; 0/1 clear it.

// Ownership and platform offers. Every activity unlock group needs these.
export const OWNED_OFFER_FLAGS: readonly number[] = [
  1745, // owns release 1 (base game), group 1cd8f77d = 248 && 1745
  1746, // owns release 2 (The Dark Below), group 1cd8f77e = 250 && 1746
  1747, // owns release 3 (House of Wolves), group 1cd8f77f = 252 && 1747
  1748, // same hash family (release 4), no reader
  1749, // same hash family (release 5), no reader
  270, // platform exclusive content, group 862b3c2a = 270 || 254 (Exodus Blue, Dust Palace)
  271, // group 99ca0b68 = 271 || (270 && !267), gates 280 activities
  272, // an activity (hash 6e92b4a0, true name unknown)
];

// Promo / pre-order vendor offers: positive-only gates on vendor sale items
// (class 8080171C) and two item defs (1743/1744). Setting them adds the items,
// nothing reads them negated.
export const VENDOR_OFFER_FLAGS: readonly number[] = [
  ...range(1329, 1371),
  ...range(1726, 1735),
  1741,
  1743,
  1744,
];

// Left clear: ban flags (offer flags 215..220, read negated by the unlock
// groups), announcement triggers (offer flags 1262..1328), 267 (read negated in
// group 99ca0b68), 269 (UI table 808033A6 only), 1840 (dlc_test_activity), and
// flags with no expression reader in data (264..266, 1372..1393, 1736..1740,
// 1742, 1847, 1938..1962).

export const UNLOCKED_ACCOUNT_FLAGS: readonly number[] = [
  70, // Crucible group 52f220e1 (also director orbit nodes)
];

// Story / destination reveal flags pushed by activity reveal lists. None of
// them is negated in an activity gate.
export const UNLOCKED_CHARACTER_FLAGS: readonly number[] = [
  111,
  112, // also the Vault of Glass completion flag and achievement 40 "Epic Raider": may award it
  115, // Tower (city_tower_*) reveal
  116,
  118,
  120,
  129,
  133,
  137,
  143,
  144,
  148,
  150,
  155,
  157,
  158,
  164,
  166,
  168,
  170,
  214, // cosmo_portal_1 reveal
  277,
  // Inventory bucket locks: a bucket shows as locked ("You have not yet found
  // a Primary Weapon.") while its flag is clear; the real server sets them as
  // the new guardian finds each kind.
  1630, // consumables
  1632, // materials
  1633, // shaders
  1634, // ships
  1637, // vehicles
  1638, // heavy weapons
  1639, // primary weapons
  1640, // special weapons
  1830,
];

// Flags no slot table carries (source "none": the time table, progression
// levels, true source unknown). The universe list (ServerObject.unknown3, max
// 20, applied after every other storage type except debug) forces them. Value 2
// = set.
export const UNIVERSE_UNLOCK_FLAGS: readonly number[] = [
  248, // launch (time table 2014-09-09); already set by a launch-week clock
  250, // The Dark Below release date (2014-12-02)
  252, // House of Wolves release date (2015-03-10 in this table)
  254, // exclusivity end (2015-09-08), alternative to offer flag 270
  244, // weekly window (2014-09-23..), 27 activities (244 || 245)
  274, // 2 activities
  1444, // 1 activity
  1853, // 18 activities, source unknown
  1854, // 7 activities (1854 && !1721 / !1722), source unknown
  1670, // character level progression 6650c0f9 row 11
  1672, // row 13
  1677, // row 18 (57 activities)
  1683, // row 5
  1685, // row 7
  1687, // row 9
];

// Reveal toggle. The orbit director draws nodes from their own state rows
// (the destination tables), not from the activity A/B lists, so "reveal"
// means: make node rows pass, on top of the unlock recipe above.
export const REVEAL_ACCOUNT_FLAGS: readonly number[] = [];
export const REVEAL_OFFER_FLAGS: readonly number[] = [];
export const REVEAL_CHARACTER_FLAGS: readonly number[] = [
  141, // tower node 2cdf5377 (hidden without it), mars patrol teaser -> available
];

// Universe entries the reveal needs on top of UNIVERSE_UNLOCK_FLAGS
// (15 + 5 = 20, exactly the cap).
export const REVEAL_UNIVERSE_FLAGS: readonly number[] = [
  249, // TDB-window variants: activity list C (73..91 && 249), 80 defs with 251
  251, // HoW-window variants
  247, // launch-window variants; the launch-week clock sets it, "now" does not
  1675, // character level row 15 (node fdd4c129)
  1680, // character level row 19: strike nodes go from teaser (2) to available (3)
];

// "Visible but locked": send the reveal flags but leave these offer flags
// clear. No node row reads 1745..1749, so nodes stay drawn while every activity
// under the release groups (1cd8f77d/e/f, c6cd9e47) fails list B. 13 of 86
// activity nodes stay launchable (groups without an ownership term).
export const LOCK_OFFER_FLAGS: readonly number[] = [
  1745, 1746, 1747, 1748, 1749,
];

// Set: flag 1616 is the equip requirement of Bladedancer, Defender and
// Sunsinger (item def equip list). Flags 1617..1622 each gate one
// progression's rows (ce10ecdf, 25c481f4, 49a1865b, e29d4abf, 77169be3,
// 817f749e), probably the subclass progressions (true meaning unknown).
export const SUBCLASS_ACCOUNT_FLAGS: readonly number[] = range(1616, 1622);

// Set (test first): "(1438 OR 1417)" appears in the rows of 56 progressions
// (character level, Vanguard / Crucible / faction reputation) and 8080176F.
// Positive only, true meaning unknown. Flag 1418 (Speaker "Infusion of Light")
// is left out.
export const PROGRESSION_ACCOUNT_FLAGS: readonly number[] = [1417, 1438];

// The prologue-pending flag: world state 23 (character:prologue) only
// launches the Cosmodrome prologue while it is set.
export const PROLOGUE_CHARACTER_FLAG = 1871;
// The prologue's mission, act_cosmo_m0_highway (activity 126): the flag
// comes off when a character finishes it.
export const PROLOGUE_MISSION_ACTIVITY = 126;

// The Tower the orbit's Tower node launches (set with TOWER_STATE): the flags
// the node's three requirements read, and which of them each state sets.
export const TOWER_STATE_FLAGS: readonly number[] = [243, 244, 245];
export const TOWER_STATE_SET: Readonly<
  Record<"default" | "iron_banner" | "queen", readonly number[]>
> = {
  default: [],
  iron_banner: [243],
  queen: [244],
};

// Character flags the reveal clears again (sent absent = 0). Both are
// "earlier story state" flags that node rows read as the LAST row:
// - 277: new-guardian state. Tower, Earth patrol and the first Earth missions
//   drop to teaser state 2 and the Crucible node hides. Only two unnamed
//   activities (7, 8) need it.
// - 157: hides the act_cinematic_queen_101 node.
export const DIRECTOR_CLEARED_CHARACTER_FLAGS: readonly number[] = [277, 157];

// Only safe with the debug unlock, which skips the unlock lists that read them:
// - 115 (Tower reveal) hides the new-player Earth node (dest 8 46775164).
//   Without the debug unlock the Tower needs it (list A).
// - 170 hides act_cinematic_queen_102; Venus patrol and act_mars_m01_valley
//   read it for state 3, so 96 (Venus patrol completed) keeps the patrol node
//   at state 4 (129 already does Mars).
export const DEBUG_CLEARED_CHARACTER_FLAGS: readonly number[] = [115, 170];
export const DEBUG_SET_CHARACTER_FLAGS: readonly number[] = [96];

// The release flags the time table owns. The clock past their time sets them
// for good, so the forced lists drop them then.
export const RELEASE_FLAGS: readonly number[] = [250, 252];

// Flags only the universe list (max 20), the debug list (max 5) or the clock
// can set: the time table owns them and no progression, item or cooldown row
// reaches them. In priority order, by nodes revealed per flag:
// - 250 / 252: The Dark Below / House of Wolves nodes (7 / 5). Dropped once the
//   clock is past their release, which sets them for good.
// - 75..91 odd, 73: strike playlist windows, 3 nodes in each of destinations
//   0 and 6 per flag.
// - 244: weekly Queen's Wrath node. Then the daily heroic story copies in
//   destination 0, one node each, and 1444 (moon_portal_2 Summoning Pits).
// A clock inside a rotation window sets that flag too, so a slot can be
// wasted on a flag that is already set; the list does not track the rotation.
export const DIRECTOR_FLAG_PRIORITY: readonly number[] = [
  250, 252, 75, 77, 79, 81, 83, 85, 87, 89, 91, 73, 244, 117, 119, 121, 125,
  130, 134, 138, 140, 142, 145, 147, 149, 151, 153, 156, 159, 165, 167, 169,
  199, 201, 203, 208, 210, 212, 1444,
];

function range(first: number, last: number): number[] {
  return Array.from({ length: last - first + 1 }, (_, i) => first + i);
}
