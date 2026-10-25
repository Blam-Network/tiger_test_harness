// The incident registry (investment globals slot "incident_registry"). The
// alpha wire names an incident by its u32 hash, not by registry index.
import type { ContentReaders } from "../../content-build";
import type { Packages } from "./package-set";

export function incidentNameReaders(
  packages: () => Packages
): Pick<ContentReaders, "incidentNames"> {
  return {
    incidentNames() {
      const { g, set } = packages();
      return g.read_incident_names(set) as number[];
    },
  };
}
