import { expect, it } from "vitest";
import { e_build } from "../../../builds";
import { buildPackagesDir, describeBuild } from "../../../test-support/build";

const packages = buildPackagesDir(e_build.v38464_14_02_28_1027_betath);

// The client's first Tower incident (PS4 run 2026-10-22, 53 bytes): two
// 10-bit registry indices, 99 and 598, then 48 metadata bytes.
const SPAWN = Buffer.from(
  "218e561831b7859920000000200000002200000004000000041cce7fd8c8a7613f1880000000000000000400000000000000002000",
  "hex"
);

describeBuild(
  e_build.v38464_14_02_28_1027_betath,
  "betath incident names",
  () => {
    it.skipIf(!packages)(
      "reads the Tower spawn as player_spawned",
      async () => {
        const { incidentNames } = await import(
          "../../../content/incident-names"
        );
        const { INCIDENT_PLAYER_SPAWNED, parseIncident } = await import(
          "../../mission/incident"
        );
        const registry = incidentNames();
        expect(registry).toHaveLength(661);
        const incident = parseIncident(SPAWN, []);
        expect(incident?.names).toEqual([
          INCIDENT_PLAYER_SPAWNED,
          registry[598],
        ]);
        // 4 + 2 x 10 bits of names, then the 9-bit length, which reads 48.
        expect(incident?.metadataBit).toBe(33);
        expect(SPAWN.readUInt16BE(3) >> 7).toBe(48);
      }
    );
  }
);
