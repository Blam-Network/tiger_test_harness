import { forBuild } from "../../builds";
import type { InvestmentBuild } from "./investment-build";
import { loadInvestmentBuild as v36735_13_12_02_1953_alpha } from "./v36735_13_12_02_1953_alpha";
import { loadInvestmentBuild as v38464_14_02_28_1027_betath } from "./v38464_14_02_28_1027_betath";
import { loadInvestmentBuild as v39573_14_04_03_1336_ff } from "./v39573_14_04_03_1336_ff";
import { loadInvestmentBuild as v40662_14_05_19_1414_pubalpha } from "./v40662_14_05_19_1414_pubalpha";
import { loadInvestmentBuild as v41375_14_07_03_1501_live } from "./v41375_14_07_03_1501_live";

export type { InvestmentBuild } from "./investment-build";

const loaders = {
  v36735_13_12_02_1953_alpha,
  v38464_14_02_28_1027_betath,
  v39573_14_04_03_1336_ff,
  v40662_14_05_19_1414_pubalpha,
  v41375_14_07_03_1501_live,
};

// The active build's database mapping, loaded on first use.
export function investmentBuild(): InvestmentBuild {
  return forBuild(loaders);
}
