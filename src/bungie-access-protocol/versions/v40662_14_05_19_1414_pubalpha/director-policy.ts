import { resolveDebugUnlock, resolveDirectorMode } from "../../../env";
import * as unlockPolicy from "./unlock-policy";
import {
  accountSlotValues,
  characterSlotValues,
  offerSlotValues,
  recommendedAccountSlots,
} from "./unlock-slots";

// What the orbit director shows (DIRECTOR_MODE): "unlock" is the unlock
// recipe, "reveal" (default) the recipe, the recommended account flags and the
// client's debug unlock, "locked" "reveal" without the debug unlock. The recipe
// already makes every node of the content this build can load available, so
// there is nothing to reveal past it and no ownership offer for "locked" to
// withhold. DEBUG_UNLOCK=0 turns the debug unlock off. TOWER_STATE does
// nothing here: the Tower node has one Tower.
type DirectorMode = "unlock" | "reveal" | "locked";

const DIRECTOR_MODE: DirectorMode = resolveDirectorMode();

const reveals = DIRECTOR_MODE !== "unlock";

// ServerObject.unknown5 bit 0 turns on the character's debug storage, and
// with self character member 6 also set, the launch checks pass every unlock
// list, the blacklist and the level gate; node state rows still read flags.
// Read off the 41375 client (its member 5, u32 @0xC4): this build's schemas
// carry both members, its reading of them is not checked.
export const DIRECTOR_DEBUG_UNLOCK =
  DIRECTOR_MODE === "reveal" && resolveDebugUnlock();

export function directorOfferSlotValues(): number[] {
  return offerSlotValues();
}

// Reveal also sends the recommended account set (subclass equip /
// progression gates 1463..1469, 1276 / 1297).
export function directorAccountSlotValues(): (number | undefined)[] {
  const slots = accountSlotValues();
  if (reveals) {
    for (const slot of recommendedAccountSlots()) {
      slots[slot] = 2;
    }
  }
  return slots;
}

export function directorCharacterSlotValues(
  prologuePending: boolean
): (number | undefined)[] {
  return characterSlotValues(prologuePending);
}

// Universe list (ServerObject.unknown3, {i16 flag, int2 value}, max 20),
// applied after every storage type except debug.
export function directorUniverseFlagList() {
  return {
    unknown0: unlockPolicy.UNIVERSE_UNLOCK_FLAGS.map((flag) => ({
      unknown0: flag,
      unknown1: 2,
    })),
  };
}

// ServerObject.unknown5: bit 0 = debug storage on. No
// forced flag spills into the debug list, so it is only on for the debug
// unlock.
export function directorServerObjectFlags(): number | undefined {
  return DIRECTOR_DEBUG_UNLOCK ? 1 : undefined;
}
