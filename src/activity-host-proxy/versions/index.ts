import { forBuild } from "../../builds";
import type { ActivityHostBuild } from "./activity-host-build";
import { loadActivityHostBuild as v36735_13_12_02_1953_alpha } from "./v36735_13_12_02_1953_alpha";
import { loadActivityHostBuild as v38464_14_02_28_1027_betath } from "./v38464_14_02_28_1027_betath";
import { loadActivityHostBuild as v39573_14_04_03_1336_ff } from "./v39573_14_04_03_1336_ff";
import { loadActivityHostBuild as v40662_14_05_19_1414_pubalpha } from "./v40662_14_05_19_1414_pubalpha";
import { loadActivityHostBuild as v41375_14_07_03_1501_live } from "./v41375_14_07_03_1501_live";

export type * from "./activity-host-build";

const loaders = {
  v36735_13_12_02_1953_alpha,
  v38464_14_02_28_1027_betath,
  v39573_14_04_03_1336_ff,
  v40662_14_05_19_1414_pubalpha,
  v41375_14_07_03_1501_live,
};

// The active build's activity host structures, loaded on first use.
export function activityHostBuild(): ActivityHostBuild {
  return forBuild<ActivityHostBuild>(loaders);
}
