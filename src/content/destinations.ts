// The client's destination table, read off the disc packages on first use.
// A row's index is the activity definition's destination_index.
import type { ClientDestination } from "./model/investment";
import { contentBuild } from "./versions";

export type { ClientDestination } from "./model/investment";

let rows: readonly ClientDestination[] | undefined;

export function clientDestinations(): readonly ClientDestination[] {
  if (!rows) {
    rows = contentBuild().readers.clientDestinations();
  }
  return rows ?? [];
}

// Every progression any destination advances, ascending.
export function destinationProgressions(): number[] {
  return [
    ...new Set(clientDestinations().flatMap((row) => row.progressions)),
  ].sort((a, b) => a - b);
}
