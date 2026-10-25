import type { InvestmentBuild } from "../investment-build";
import { PrismaCharacterStore } from "./prisma-store";

export function loadInvestmentBuild(): InvestmentBuild {
  return {
    connectCharacterStore: (url) => PrismaCharacterStore.connect(url),
  };
}
