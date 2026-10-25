import { BitWriter } from "@blamnetwork/rsat";
import { expect, it } from "vitest";
import { e_build } from "../../../builds";
import { buildPackagesDir, describeBuild } from "../../../test-support/build";

const packages = buildPackagesDir(e_build.v39573_14_04_03_1336_ff);

// An incident as the client's schema lays it out: a 4-bit count, 10-bit
// registry indices, then the 9-bit metadata length.
function incident(indices: readonly number[], metadataBytes: number) {
  const bw = new BitWriter(64);
  bw.write(indices.length, 4);
  for (const index of indices) {
    bw.write(index, 10);
  }
  bw.write(metadataBytes, 9);
  for (let i = 0; i < metadataBytes; i++) {
    bw.write(0, 8);
  }
  return bw.finish();
}

describeBuild(e_build.v39573_14_04_03_1336_ff, "39573 incident names", () => {
  it.skipIf(!packages)("reads player_spawned by its 10-bit index", async () => {
    const { incidentNames } = await import("../../../content/incident-names");
    const { INCIDENT_PLAYER_SPAWNED, parseIncident } = await import(
      "../../mission/incident"
    );
    const registry = incidentNames();
    expect(registry.length).toBeLessThanOrEqual(1 << 10);
    const spawned = registry.indexOf(INCIDENT_PLAYER_SPAWNED);
    expect(spawned).toBeGreaterThanOrEqual(0);
    const parsed = parseIncident(incident([spawned, 0], 2), []);
    expect(parsed?.names).toEqual([INCIDENT_PLAYER_SPAWNED, registry[0]]);
    expect(parsed?.metadataBit).toBe(4 + 2 * 10 + 9);
  });
});
