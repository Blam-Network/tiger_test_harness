// The activity table (investment globals slot "activities"): each id's
// definition with its name and, for a playlist, the ids it picks from.
import type { ContentReaders } from "../../content-build";
import type { InvestmentGlobals } from "./investment-globals";
import type { Packages } from "./package-set";

export function activityReaders(
  packages: () => Packages,
  investment: InvestmentGlobals
): Pick<ContentReaders, "activityDefinitions"> {
  return {
    activityDefinitions() {
      const { g, set } = packages();
      return g
        .read_activity_table(set)
        .activities.map((entry: { definition: number }) => {
          const { definition } = investment.readTag(
            entry.definition,
            "s_activity_definition_tag"
          );
          const picks: { activity_index: number; weight: number }[] =
            definition.playlist?.entries ?? [];
          return {
            // The definition names itself, or only a fallback (action_mock's
            // other ids).
            name: definition.name || definition.fallback_name || "",
            playlist: picks.map((pick) => pick.activity_index),
            playlistWeights: picks.map((pick) => pick.weight),
          };
        });
    },
  };
}
