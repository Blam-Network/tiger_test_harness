import { flagSetTime } from "../../../content/unlock-flags";
import {
  resolveDebugUnlock,
  resolveDirectorMode,
  resolveTowerState,
} from "../../../env";
import { universeTime } from "../../stubs/universe-clock";
import * as unlockPolicy from "./unlock-policy";
import {
  accountSlotValues,
  characterSlotValues,
  offerSlotValues,
  recommendedAccountSlots,
  slotsFor,
  UNIVERSE_FLAG_CAP,
} from "./unlock-slots";

// What the orbit director shows (DIRECTOR_MODE):
// - "unlock": the minimal unlock recipe.
// - "reveal" (default): the client's debug unlock plus forced flags for node
//   visibility.
// - "locked": the reveal flags without the debug unlock or the release offers
//   (slots 165..169), so the nodes draw but release content doesn't launch.
// DEBUG_UNLOCK=0 keeps the reveal flags but turns the debug unlock off.
type DirectorMode = "unlock" | "reveal" | "locked";

const DIRECTOR_MODE: DirectorMode = resolveDirectorMode();

const reveals = DIRECTOR_MODE !== "unlock";

// Which Tower the orbit's Tower node launches (TOWER_STATE). The node lists
// three, each behind a requirement: city_tower_default1 !(244 || 245) && !243,
// city_tower_iron_banner 243, city_tower_queen 244 || 245. The time table
// sets 243 for Iron Banner weeks and 244 / 245 for Queen's Wrath weeks (2.3.1
// capture). Unset, 244 is forced and the node launches the first, default1,
// which only works with the debug unlock on. Any state turns the debug unlock
// off. A cleared flag is sent as 1, which beats the time table's own value
// (first nonzero wins).
type TowerState = "default" | "iron_banner" | "queen";

const TOWER_STATE: TowerState | undefined = resolveTowerState();

// The universe entries for the Tower state: its own flag set, the others
// cleared.
export function towerStateFlagValues(
  state = TOWER_STATE
): { flag: number; value: number }[] {
  if (state === undefined) {
    return [];
  }
  const { TOWER_STATE_FLAGS, TOWER_STATE_SET } = unlockPolicy;
  return TOWER_STATE_FLAGS.map((flag) => ({
    flag,
    value: TOWER_STATE_SET[state].includes(flag) ? 2 : 1,
  }));
}

// ServerObject.unknown5 bit 0 (read by the unlock context, 0x831B18E8) turns on
// the character's debug storage (type 0: self character member 5, 5 x {flag,
// value}, applied after every other storage). With member 6 also set,
// activity_status_bitsets_build and the launch checks pass every unlock list,
// the blacklist and the level gate. Node state rows still read flags. It also
// skips the requirement on each of a node's activities, so a node launches its
// first one: a Tower state needs it off.
export const DIRECTOR_DEBUG_UNLOCK =
  DIRECTOR_MODE === "reveal" &&
  resolveDebugUnlock() &&
  TOWER_STATE === undefined;

function withSlots(
  slots: (number | undefined)[],
  setSlots: readonly number[],
  value: number
): (number | undefined)[] {
  for (const slot of setSlots) {
    slots[slot] = value;
  }
  return slots;
}

export function directorOfferSlotValues(): (number | undefined)[] {
  const { LOCK_OFFER_FLAGS, REVEAL_OFFER_FLAGS } = unlockPolicy;
  const slots = offerSlotValues() as (number | undefined)[];
  if (reveals) {
    withSlots(slots, slotsFor("offer", REVEAL_OFFER_FLAGS), 2);
  }
  return DIRECTOR_MODE === "locked"
    ? withSlots(slots, slotsFor("offer", LOCK_OFFER_FLAGS), 0)
    : slots;
}

// Reveal also sends the flag catalogue's recommended account set (Crucible 70,
// subclass equip / progression gates 1616..1622, 1417/1438).
export function directorAccountSlotValues(): (number | undefined)[] {
  const slots = accountSlotValues();
  if (!reveals) {
    return slots;
  }
  withSlots(slots, recommendedAccountSlots(), 2);
  return withSlots(
    slots,
    slotsFor("account", unlockPolicy.REVEAL_ACCOUNT_FLAGS),
    2
  );
}

export function directorCharacterSlotValues(
  prologuePending = false
): (number | undefined)[] {
  const slots = characterSlotValues(prologuePending);
  if (!reveals) {
    return slots;
  }
  const policy = unlockPolicy;
  withSlots(slots, slotsFor("character", policy.REVEAL_CHARACTER_FLAGS), 2);
  const cleared = DIRECTOR_DEBUG_UNLOCK
    ? [
        ...policy.DIRECTOR_CLEARED_CHARACTER_FLAGS,
        ...policy.DEBUG_CLEARED_CHARACTER_FLAGS,
      ]
    : policy.DIRECTOR_CLEARED_CHARACTER_FLAGS;
  for (const slot of slotsFor("character", cleared)) {
    slots[slot] = undefined;
  }
  if (DIRECTOR_DEBUG_UNLOCK) {
    withSlots(
      slots,
      slotsFor("character", policy.DEBUG_SET_CHARACTER_FLAGS),
      2
    );
  }
  return slots;
}

export const DEBUG_FLAG_CAP = 5;

// Release flags the time table already holds at `now`.
function releasedBy(now: bigint): number[] {
  return unlockPolicy.RELEASE_FLAGS.filter((flag) => {
    const time = flagSetTime(flag);
    return time !== undefined && now >= time;
  });
}

export function directorForcedFlags(now = universeTime()): number[] {
  const released = releasedBy(now);
  return unlockPolicy.DIRECTOR_FLAG_PRIORITY.filter(
    (flag) => !released.includes(flag)
  ).slice(0, UNIVERSE_FLAG_CAP + DEBUG_FLAG_CAP);
}

// What the forced lists may carry: every flag but the Tower state's own.
function withoutTowerFlags(flags: readonly number[]): number[] {
  return TOWER_STATE === undefined
    ? [...flags]
    : flags.filter((flag) => !unlockPolicy.TOWER_STATE_FLAGS.includes(flag));
}

function flagList(
  flags: readonly number[],
  first: readonly { flag: number; value: number }[] = []
) {
  return {
    unknown0: [
      ...first.map(({ flag, value }) => ({ unknown0: flag, unknown1: value })),
      ...flags.map((flag) => ({ unknown0: flag, unknown1: 2 })),
    ],
  };
}

// Universe list (ServerObject.unknown3, {i16 flag, int2 value}, max 20),
// applied after every storage type except debug. The Tower state's entries go
// first so the cap never drops them.
export function directorUniverseFlagList() {
  const tower = towerStateFlagValues();
  const room = UNIVERSE_FLAG_CAP - tower.length;
  const flags = withoutTowerFlags(
    reveals ? directorForcedFlags() : unlockPolicy.UNIVERSE_UNLOCK_FLAGS
  ).slice(0, room);
  return flagList(flags, tower);
}

// Debug list (self character member 5, max 5), only read while
// ServerObject.unknown5 bit 0 is set. Takes the forced flags the universe list
// had no room for.
export function directorDebugFlagList() {
  if (!reveals) {
    return;
  }
  const room = UNIVERSE_FLAG_CAP - towerStateFlagValues().length;
  return flagList(
    withoutTowerFlags(directorForcedFlags()).slice(room, room + DEBUG_FLAG_CAP)
  );
}

// ServerObject.unknown5: bit 0 = debug storage on.
export function directorServerObjectFlags(): number | undefined {
  return reveals ? 1 : undefined;
}
