// Progressions and the character constants that name which of them is the
// character's level.
import type { ContentReaders } from "../../content-build";
import type { InvestmentGlobals } from "./investment-globals";
import type { GibbonApi } from "./package-set";

// The alpha's constants hold the level progression alone, so the role list
// is that one and its role is 0.
const LEVEL_ROLE = 0;

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
      const constants = investment.table(
        "character_constants",
        "s_character_constants"
      );
      const levelIndex = g.character_level_progression(constants);
      return {
        // No cap field was found; the level progression's steps end it.
        levelCap: table().progressions[levelIndex].steps.length,
        progressions: [levelIndex],
        stats: Array.from(constants.stats as ArrayLike<number>),
      };
    },

    levelProgressionRole: () => LEVEL_ROLE,
  };
}
