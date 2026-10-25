import { forBuild } from "../../builds";
import type { ContentBuild } from "./content-build";
import { loadContentBuild as v36735_13_12_02_1953_alpha } from "./v36735_13_12_02_1953_alpha";
import { loadContentBuild as v38464_14_02_28_1027_betath } from "./v38464_14_02_28_1027_betath";
import { loadContentBuild as v39573_14_04_03_1336_ff } from "./v39573_14_04_03_1336_ff";
import { loadContentBuild as v40662_14_05_19_1414_pubalpha } from "./v40662_14_05_19_1414_pubalpha";
import { loadContentBuild as v41375_14_07_03_1501_live } from "./v41375_14_07_03_1501_live";

export type {
  ContentBuild,
  ContentReaders,
  ScriptRuntimeInstance,
} from "./content-build";

const loaders = {
  v36735_13_12_02_1953_alpha,
  v38464_14_02_28_1027_betath,
  v39573_14_04_03_1336_ff,
  v40662_14_05_19_1414_pubalpha,
  v41375_14_07_03_1501_live,
};

// The active build's readers and bullshcript bindings, loaded on first use.
export function contentBuild(): ContentBuild {
  return forBuild(loaders);
}
