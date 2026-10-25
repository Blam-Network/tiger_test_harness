// An incident names itself by an 11-bit index into the client's incident
// registry, not by hash.
import type { ContentReaders } from "../../content-build";
import type { Packages } from "./package-set";

export function incidentNameReaders(
  packages: () => Packages
): Pick<ContentReaders, "incidentNames"> {
  return {
    incidentNames() {
      const { g, set } = packages();
      return g.read_client_incident_names(set) as number[];
    },
  };
}
