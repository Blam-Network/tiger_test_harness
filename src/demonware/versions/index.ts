import { forBuild } from "../../builds";
import type { DemonwareBuild } from "./demonware-build";
import { loadDemonwareBuild as v36735_13_12_02_1953_alpha } from "./v36735_13_12_02_1953_alpha";
import { loadDemonwareBuild as v38464_14_02_28_1027_betath } from "./v38464_14_02_28_1027_betath";
import { loadDemonwareBuild as v39573_14_04_03_1336_ff } from "./v39573_14_04_03_1336_ff";
import { loadDemonwareBuild as v40662_14_05_19_1414_pubalpha } from "./v40662_14_05_19_1414_pubalpha";
import { loadDemonwareBuild as v41375_14_07_03_1501_live } from "./v41375_14_07_03_1501_live";

export type { DemonwareAuth, DemonwareBuild } from "./demonware-build";

const loaders = {
  v36735_13_12_02_1953_alpha,
  v38464_14_02_28_1027_betath,
  v39573_14_04_03_1336_ff,
  v40662_14_05_19_1414_pubalpha,
  v41375_14_07_03_1501_live,
};

// The active build's Demonware auth values, loaded on first use.
export function demonwareBuild(): DemonwareBuild {
  return forBuild(loaders);
}
