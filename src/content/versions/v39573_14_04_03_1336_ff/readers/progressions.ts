// Progressions and the character constants that name which of them is the
// character's level.
import type { ContentReaders } from "../../content-build";
import type { InvestmentGlobals } from "./investment-globals";
import type { GibbonApi } from "./package-set";

// A role that names no progression.
const NO_PROGRESSION = 0xff;

export function progressionReaders(
  g: GibbonApi,
  investment: InvestmentGlobals
): Pick<
  ContentReaders,
  "characterConstants" | "levelProgressionRole" | "progression"
> {
  let progressionTable: any;
  const table = () => {
    progressionTable ??= investment.table(
      "progressions",
      "s_progression_table"
    );
    return progressionTable;
  };

  let constantsTable: any;
  const constants = () => {
    constantsTable ??= investment.table(
      "character_constants",
      "s_character_constants"
    );
    return constantsTable;
  };
  const roles = () => Array.from(constants().progressions as ArrayLike<number>);
  const levelIndex = () => roles()[g.k_character_level_progression_role];
  // Role 0 names none (0xFF), so the list is the roles that name one.
  const progressions = () =>
    roles().filter((index) => index !== NO_PROGRESSION);

  return {
    progression(index) {
      const row = table().progressions[index];
      return row
        ? {
            index,
            nameHash: row.name_hash,
            clampAtMax: row.clamp_at_max !== 0,
            steps: row.steps.map((step: any) => ({
              xpRequired: step.xp_required,
              grantedItem: step.granted_item,
            })),
          }
        : undefined;
    },

    characterConstants() {
      const level = table().progressions[levelIndex()];
      return {
        // The constants have no level cap field. The level progression's
        // steps end the levels, as the live build's cap (20) is its level
        // progression's step count.
        levelCap: level.steps.length,
        progressions: progressions(),
        stats: Array.from(constants().stats as ArrayLike<number>),
      };
    },

    // The client reads the character's level from the progression at gibbon's
    // role; the list leaves out the roles before it that name none.
    levelProgressionRole: () => progressions().indexOf(levelIndex()),
  };
}
