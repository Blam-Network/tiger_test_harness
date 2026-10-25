import { existsSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { scriptFolder } from "../activity-host-proxy/script-host/compiled-scripts";
import { embedded } from "../assets";
import { activeBuild, type build_folder, buildFolder } from "../builds";
import { requirePackagesDir, resolveDictionaryDir } from "../env";
import { scriptDebugger } from "./script-debugger";

// tiger/server: what a debugger needs to read this server's game data itself
// - the build (which tag and bullshcript definitions apply), the
// packages it serves, the scripts it runs and tiger's dictionary.

// tiger's dictionary package sits beside bullshcript's in the checkout. A
// build it has no names for yet gets none: the debugger shows hashes.
export function dictionaryDir(folder: string): string | undefined {
  if (embedded()) {
    return;
  }
  const bullshcript = realpathSync(
    require.resolve("@blamnetwork/bullshcript/destiny1/common")
  );
  const packages = resolve(dirname(bullshcript), "../../../..");
  const dir = join(packages, "dictionary", "destiny1", folder, "hashes");
  return existsSync(dir) ? dir : undefined;
}

// The console each build ran on, which decides its packages' byte order and
// pointer width.
const PLATFORMS: Record<build_folder, "ps4" | "x360"> = {
  v36735_13_12_02_1953_alpha: "x360",
  v38464_14_02_28_1027_betath: "ps4",
  v39573_14_04_03_1336_ff: "ps4",
  v40662_14_05_19_1414_pubalpha: "ps4",
  v41375_14_07_03_1501_live: "x360",
};

export function debugServerInfo() {
  const build = activeBuild();
  const folder = buildFolder(build);
  return {
    // The build's folder name in the tag definitions, bullshcript and the dictionary.
    build: folder,
    buildLabel: build,
    game: "destiny1",
    platform: PLATFORMS[folder],
    dictionaryDir: resolveDictionaryDir() ?? dictionaryDir(folder),
    packagesDir: resolve(requirePackagesDir()),
    scriptsDir: embedded() ? undefined : scriptFolder(),
  };
}

scriptDebugger.registerRequest("tiger/server", () => debugServerInfo());
