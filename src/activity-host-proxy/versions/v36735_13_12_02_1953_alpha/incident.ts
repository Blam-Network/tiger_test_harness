import { readBits } from "../../mission/read-bits";
import type { IncidentWire } from "../activity-host-build";

// An incident names itself by a 4-bit count and that many u32 name hashes,
// then a 9-bit metadata byte length.
export function createIncidentWire(): IncidentWire {
  return {
    readNames(payload) {
      const totalBits = payload.length * 8;
      if (totalBits < 4) {
        return;
      }
      const n = readBits(payload, 0, 4);
      const namesEnd = 4 + 32 * n;
      if (n < 1 || namesEnd + 9 > totalBits) {
        return;
      }
      const names: number[] = [];
      for (let i = 0; i < n; i++) {
        names.push(readBits(payload, 4 + 32 * i, 32) >>> 0);
      }
      return { metadataBit: namesEnd + 9, names };
    },
  };
}
