// The activity table (investment globals slot "activities"): each id's
// definition with its name and, for a playlist, the ids it picks from.
import type { ContentReaders } from "../../content-build";
import type { InvestmentGlobals } from "./investment-globals";

export function activityReaders(
  investment: InvestmentGlobals
): Pick<ContentReaders, "activityDefinitions"> {
  return {
    activityDefinitions() {
      const { activities } = investment.table("activities", "s_activity_table");
      return activities.map((entry: { definition: number }) => {
        const { definition } = investment.readTag(
          entry.definition,
          "s_activity_definition_tag"
        );
        const picks: { activity_index: number }[] =
          definition.playlist?.entries ?? [];
        return {
          name: definition.name ?? "",
          playlist: picks.map((pick) => pick.activity_index),
        };
      });
    },
  };
}
