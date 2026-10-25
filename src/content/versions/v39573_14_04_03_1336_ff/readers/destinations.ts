// The client's destination table. Its rows are the PS4 pre-alpha's 48-byte
// ones; an activity definition's destination_index does not index it.
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
      // The rows have no blocks: no destination names a progression.
      return table.destinations.map((_row: unknown, index: number) => ({
        index,
        progressions: [],
      }));
    },
  };
}
