import { xpForLevel } from "../../character-level";

// Level 6, so the level 6 strike (cosmo_portal_1, activity 183) can launch:
// the activity gate (sub_1794400) refuses difficulty tier 7 above the power
// level, which below the cap is the level from XP.
export const NEW_CHARACTER_LEVEL = 6;

// The least XP on the level progression that reads as that level.
export function newCharacterXp(): number {
  return xpForLevel(NEW_CHARACTER_LEVEL);
}
