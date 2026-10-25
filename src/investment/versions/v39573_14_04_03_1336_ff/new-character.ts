import { xpForLevel } from "../../character-level";

// The level cap, 21; at least 8, the level of the strike its destination
// offers (cosmo_portal_1, activity 303): the activity gate refuses difficulty
// tier 7 above the power level, which below the cap is the level from XP.
export const NEW_CHARACTER_LEVEL = 21;

// The least XP on the level progression that reads as that level.
export function newCharacterXp(): number {
  return xpForLevel(NEW_CHARACTER_LEVEL);
}
