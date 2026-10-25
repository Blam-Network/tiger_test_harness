import { incidentNames } from "../../../content/incident-names";
import { readBits } from "../../mission/read-bits";
import type { IncidentWire } from "../activity-host-build";

// An incident names itself by 11-bit indices into its incident registry
// (80805481: a 4-bit count, then the indices), then an optional list of plain
// name hashes (808047A0: a presence bit, a 4-bit count, u32s), then a 9-bit
// metadata length. player_spawned is index 214.
export function createIncidentWire(): IncidentWire {
  return {
    readNames(payload) {
      const totalBits = payload.length * 8;
      const n = readBits(payload, 0, 4);
      let bit = 4 + 11 * n;
      if (n < 1 || bit + 1 > totalBits) {
        return;
      }
      const names: number[] = [];
      for (let i = 0; i < n; i++) {
        const name = incidentNames()[readBits(payload, 4 + 11 * i, 11)];
        if (name === undefined) {
          return;
        }
        names.push(name);
      }
      if (readBits(payload, bit, 1) === 1) {
        const hashes = readBits(payload, bit + 1, 4);
        for (let i = 0; i < hashes; i++) {
          names.push(readBits(payload, bit + 5 + 32 * i, 32) >>> 0);
        }
        bit += 4 + 32 * hashes;
      }
      const metadataBit = bit + 1 + 9;
      if (metadataBit > totalBits) {
        return;
      }
      return { metadataBit, names };
    },
  };
}
