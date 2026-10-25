// The incident registry's name hashes. The 41375 wire names an incident by an
// 11-bit index into it; the alpha wire sends the hashes themselves.
import { contentBuild } from "./versions";

let names: readonly number[] | undefined;

export function incidentNames(): readonly number[] {
  if (!names) {
    names = contentBuild().readers.incidentNames();
  }
  return names;
}
