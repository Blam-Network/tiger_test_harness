// Progressions and the character constants that name which of them is the
// character's level.
import type { ContentReaders } from "../../content-build";
import type { InvestmentGlobals } from "./investment-globals";
import type { GibbonApi } from "./package-set";

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
      const progressions = Array.from(
        constants.progressions as ArrayLike<number>
      );
      const level =
        table().progressions[
          progressions[g.k_character_level_progression_role]
        ];
      return {
        // The constants have no level cap field. The level progression's
        // steps end the levels, as the live build's cap (20) is its level
        // progression's step count.
        levelCap: level.steps.length,
        progressions,
        stats: Array.from(constants.stats as ArrayLike<number>),
      };
    },

    // The client reads the character's level from the progression at this
    // role.
    levelProgressionRole: () => g.k_character_level_progression_role,
  };
}
