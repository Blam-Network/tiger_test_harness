import { incidentNames } from "../../../content/incident-names";
import { readBits } from "../../mission/read-bits";
import type { IncidentWire } from "../activity-host-build";

// The incident (80800B15) is its names (80805424: a 4-bit count, then up to
// 15 10-bit indices into the incident registry, 80805420) and the metadata
// (808042AC: a 9-bit byte length, then the bytes). Unlike 40662 the indices
// are 10 bits (the registry has 661 names) and there is no list of plain name
// hashes. player_spawned is index 99.
const NAME_INDEX_BITS = 10;
const METADATA_LENGTH_BITS = 9;

export function createIncidentWire(): IncidentWire {
  return {
    readNames(payload) {
      const totalBits = payload.length * 8;
      const n = readBits(payload, 0, 4);
      const metadataBit = 4 + NAME_INDEX_BITS * n + METADATA_LENGTH_BITS;
      if (n < 1 || metadataBit > totalBits) {
        return;
      }
      const names: number[] = [];
      for (let i = 0; i < n; i++) {
        const index = readBits(
          payload,
          4 + NAME_INDEX_BITS * i,
          NAME_INDEX_BITS
        );
        const name = incidentNames()[index];
        if (name === undefined) {
          return;
        }
        names.push(name);
      }
      return { metadataBit, names };
    },
  };
}
