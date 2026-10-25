import { requirePackagesDir } from "../../../env";
import type { ContentBuild } from "../content-build";
import { IDS } from "./ids";
import { createReaders } from "./readers";

// require, not import: gibbon's ESM build pulls in cstruct's, whose
// extensionless imports Node can't resolve; its CommonJS build loads fine.
// Nothing loads until the build is chosen; the packages are TIGER_PACKAGES_DIR
// unless a directory is given.
export function loadContentBuild(packagesDir?: string): ContentBuild {
  const bullshcript = require("@blamnetwork/bullshcript/destiny1/v39573_14_04_03_1336_ff");
  const gibbon = require("@blamnetwork/gibbon/destiny1/v39573_14_04_03_1336_ff");
  return {
    bullshcript: {
      ActivityBundleItemType: bullshcript.ActivityBundleItemType,
      entryModule: require.resolve(
        "@blamnetwork/bullshcript/destiny1/v39573_14_04_03_1336_ff"
      ),
      ScriptRuntime: bullshcript.ScriptRuntime,
    },
    ids: IDS,
    readers: createReaders(
      gibbon,
      bullshcript.ActivityBundleItemType,
      () => packagesDir ?? requirePackagesDir()
    ),
  };
}
