// The client's destination table (client globals slot "destinations"). A row's
// index is the activity definition's destination_index. The alpha rows carry
// no progression lists, so none are given.
import type { ContentReaders } from "../../content-build";
import type { Packages } from "./package-set";

// The row count follows the tag's size word (a tag block's count).
const ROW_COUNT_OFFSET = 4;

export function destinationReaders(
  packages: () => Packages
): Pick<ContentReaders, "clientDestinations"> {
  return {
    clientDestinations() {
      const { g, set } = packages();
      const table: Buffer = set.read_tag(
        g.investment_client_global_tag(
          set,
          g.e_investment_client_global.destinations
        )
      );
      const count = table.readUInt32BE(ROW_COUNT_OFFSET);
      return Array.from({ length: count }, (_, index) => ({
        index,
        progressions: [],
      }));
    },
  };
}
