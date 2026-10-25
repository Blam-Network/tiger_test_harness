import { resolveDebugUnlock, resolveDirectorMode } from "../../../env";
import {
  accountSlotValues,
  characterSlotValues,
  offerSlotValues,
} from "./unlock-slots";

// What the orbit director shows (DIRECTOR_MODE): "unlock" is the unlock
// recipe, "reveal" (default) the recipe plus the client's debug unlock,
// "locked" the recipe alone. The recipe already makes every node of the
// content this build can load available, so there are no recommended account
// flags to reveal past it and no ownership offer for "locked" to withhold.
// DEBUG_UNLOCK=0 turns the debug unlock off. TOWER_STATE does nothing here:
// the Tower node has one Tower.
type DirectorMode = "unlock" | "reveal" | "locked";

const DIRECTOR_MODE: DirectorMode = resolveDirectorMode();

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

export function directorAccountSlotValues(): (number | undefined)[] {
  return accountSlotValues();
}

export function directorCharacterSlotValues(): (number | undefined)[] {
  return characterSlotValues();
}

// Universe list (ServerObject.unknown3, {i16 flag, int2 value}, max 20),
// applied after every storage type except debug. The policy forces no flag
// (unlock-policy.ts).
export function directorUniverseFlagList() {
  return { unknown0: [] };
}

// ServerObject.unknown5: bit 0 = debug storage on. No
// forced flag spills into the debug list, so it is only on for the debug
// unlock.
export function directorServerObjectFlags(): number | undefined {
  return DIRECTOR_DEBUG_UNLOCK ? 1 : undefined;
}
