import type { ContentBuild } from "../content-build";
import { IDS } from "./ids";
import { createReaders } from "./readers";

// require, not import: gibbon's ESM build pulls in cstruct's, whose
// extensionless imports Node can't resolve; its CommonJS build loads fine.
// Nothing loads until the build is chosen.
export function loadContentBuild(): ContentBuild {
  const bullshcript = require("@blamnetwork/bullshcript/destiny1/v41375_14_07_03_1501_live");
  const gibbon = require("@blamnetwork/gibbon/destiny1/v41375_14_07_03_1501_live");
  return {
    bullshcript: {
      ActivityBundleItemType: bullshcript.ActivityBundleItemType,
      entryModule: require.resolve(
        "@blamnetwork/bullshcript/destiny1/v41375_14_07_03_1501_live"
      ),
      ScriptRuntime: bullshcript.ScriptRuntime,
    },
    ids: IDS,
    readers: createReaders(gibbon, bullshcript.ActivityBundleItemType),
  };
}
