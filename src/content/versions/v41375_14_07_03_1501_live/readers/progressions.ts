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

  return {
    progression(index) {
      progressionTable ??= investment.table(
        "progressions",
        "s_progression_table"
      );
      const row = progressionTable.progressions[index];
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
      const table = investment.table(
        "character_constants",
        "s_character_constants"
      );
      return {
        levelCap: table.level_cap,
        progressions: Array.from(table.progressions as ArrayLike<number>),
        stats: Array.from(table.stats as ArrayLike<number>),
      };
    },

    // The client reads the character's level from the progression at this
    // role.
    levelProgressionRole: () => g.k_character_level_progression_role,
  };
}
