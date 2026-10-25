import { vi } from "vitest";
import { e_build } from "../builds";

// Build-specific modules load through lazy accessors, so importing any
// service with no usable build must not throw; only using one may.
export const MODULES: Readonly<Record<string, () => Promise<unknown>>> = {
  "./bungie-access-protocol/session": () =>
    import("../bungie-access-protocol/session"),
  "./activity-host-proxy/session": () =>
    import("../activity-host-proxy/session"),
  "./content/index": () => import("../content/index"),
  "./demonware/auth": () => import("../demonware/auth"),
  "./signon/services/signon.service": () =>
    import("../signon/services/signon.service"),
  "./investment/investment.module": () =>
    import("../investment/investment.module"),
};

// Schema ids that mark a build loaded. 36735's and 41375's (the BAP self
// primary, a BAP request and an activity host schema) are not each other's;
// 40662 defines 41375's too, so its own are two self character members no
// other build has, 38464's are its self character and character unlock
// slots, and 39573's its character unlock slots and the self character's
// 129-entry list.
export const BUILD_SCHEMA_IDS: Readonly<Record<e_build, readonly number[]>> = {
  [e_build.v41375_14_07_03_1501_live]: [
    0x80_80_18_03, 0x80_80_0b_1a, 0x80_80_40_5e,
  ],
  [e_build.v40662_14_05_19_1414_pubalpha]: [0x80_80_47_0e, 0x80_80_47_ac],
  [e_build.v38464_14_02_28_1027_betath]: [0x80_80_16_d1, 0x80_80_46_85],
  [e_build.v39573_14_04_03_1336_ff]: [0x80_80_46_63, 0x80_80_46_9b],
  [e_build.v36735_13_12_02_1953_alpha]: [
    0x80_80_17_d0, 0x80_80_4a_43, 0x80_80_05_2c,
  ],
};

// Imports every module with the build set, then returns what loads the
// build's accessors. Paths are relative to src.
export async function importAll(build: e_build) {
  vi.stubEnv("TIGER_GAME_BUILD", build);
  vi.resetModules();
  const { findByHash } = await import("@blamnetwork/rsat");
  for (const load of Object.values(MODULES)) {
    await load();
  }
  const loadAccessors = async () => {
    const { bapBuild } = await import("../bungie-access-protocol/versions");
    const { activityHostBuild } = await import(
      "../activity-host-proxy/versions"
    );
    bapBuild();
    activityHostBuild();
  };
  return { findByHash, loadAccessors };
}
