// The client's destination table. A row's index is the activity definition's
// destination_index.
import type { ContentReaders } from "../../content-build";
import type { InvestmentGlobals } from "./investment-globals";

export function destinationReaders(
  investment: InvestmentGlobals
): Pick<ContentReaders, "clientDestinations"> {
  return {
    clientDestinations() {
      const table = investment.clientTable(
        "destinations",
        "s_client_destination_table"
      );
      return table.destinations.map((row: any, index: number) => ({
        index,
        progressions: row.progressions.map(
          (entry: { progression: number }) => entry.progression
        ),
      }));
    },
  };
}
