import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { e_build, resetActiveBuildForTest } from "../builds";
import { buildPackagesDir } from "../test-support/build";
import { debugServerInfo, dictionaryDir } from "./debug-server-info";

// tiger/server's dictionaryDir: the data service reads every CSV in it, so a
// folder that is not there fails the debugger's slice list.
describe("debug server info dictionary", () => {
  it("names a build's dictionary folder", () => {
    const dir = dictionaryDir("v41375_14_07_03_1501_live");
    expect(dir).toMatch(
      /dictionary[\\/]destiny1[\\/]v41375_14_07_03_1501_live/
    );
    expect(existsSync(dir ?? "")).toBe(true);
  });

  it("gives none for a build the dictionary has no folder for", () => {
    expect(dictionaryDir("v00000_00_00_00_0000_none")).toBeUndefined();
  });
});

// The debugger reads a PS4 build's slices with that build's gibbon from the
// packages tiger/server names.
const betathPackagesDir = buildPackagesDir(e_build.v38464_14_02_28_1027_betath);

describe.skipIf(!betathPackagesDir)(
  "debug server info on the PS4 pre-alpha",
  () => {
    afterEach(() => {
      vi.unstubAllEnvs();
      resetActiveBuildForTest();
    });

    it("names the build, its platform and its packages", () => {
      vi.stubEnv("TIGER_GAME_BUILD", "38464.14.02.28.1027.betath");
      vi.stubEnv("TIGER_PACKAGES_DIR", betathPackagesDir);
      vi.stubEnv("TIGER_DICTIONARY_DIR", undefined);
      resetActiveBuildForTest();
      const info = debugServerInfo();
      expect(info.build).toBe("v38464_14_02_28_1027_betath");
      expect(info.buildLabel).toBe("38464.14.02.28.1027.betath");
      expect(info.platform).toBe("ps4");
      expect(info.packagesDir).toBe(resolve(betathPackagesDir ?? ""));
      // no names for it yet: the debugger shows hashes
      expect(info.dictionaryDir).toBeUndefined();
      expect(info.scriptsDir).toMatch(/v38464_14_02_28_1027_betath$/);
    });
  }
);
