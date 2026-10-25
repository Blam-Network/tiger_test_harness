import { afterEach, expect, it, vi } from "vitest";
import { e_build } from "./builds";
import { describeEachBuild } from "./test-support/build";
import { BUILD_SCHEMA_IDS, importAll } from "./test-support/import-safety";

// rsat's schema registry is process-wide and outlives module resets, so each
// build's registration is checked in a process of its own: vitest.config.ts
// runs a *.builds.test.ts file once per build, as a project.

// The builds whose ids must not appear. 40662 defines 41375's too, and the
// middle builds share some of each other's, so only the clear ones are named.
const OTHERS: Readonly<Record<e_build, readonly e_build[]>> = {
  [e_build.v36735_13_12_02_1953_alpha]: [e_build.v41375_14_07_03_1501_live],
  [e_build.v38464_14_02_28_1027_betath]: [e_build.v36735_13_12_02_1953_alpha],
  [e_build.v39573_14_04_03_1336_ff]: [e_build.v36735_13_12_02_1953_alpha],
  [e_build.v40662_14_05_19_1414_pubalpha]: [e_build.v36735_13_12_02_1953_alpha],
  [e_build.v41375_14_07_03_1501_live]: [
    e_build.v36735_13_12_02_1953_alpha,
    e_build.v40662_14_05_19_1414_pubalpha,
    e_build.v38464_14_02_28_1027_betath,
    e_build.v39573_14_04_03_1336_ff,
  ],
};

describeEachBuild("schema registration", (BUILD) => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("registers no build schema on import, only when the build loads", async () => {
    const { findByHash, loadAccessors } = await importAll(BUILD);
    for (const id of BUILD_SCHEMA_IDS[BUILD]) {
      expect(findByHash(id)).toBeUndefined();
    }

    await loadAccessors();
    for (const id of BUILD_SCHEMA_IDS[BUILD]) {
      expect(findByHash(id)).toBeDefined();
    }
  });

  it("registers none of the other builds' ids", async () => {
    const { findByHash, loadAccessors } = await importAll(BUILD);
    await loadAccessors();
    for (const other of OTHERS[BUILD]) {
      for (const id of BUILD_SCHEMA_IDS[other]) {
        expect(findByHash(id)).toBeUndefined();
      }
    }
  });
});
