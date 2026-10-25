import type { ActivityBundleItemTypes } from "@blamnetwork/bullshcript/destiny1/common";
import type { ContentReaders } from "../../content-build";
import { abilityReaders } from "./abilities";
import { activityReaders } from "./activities";
import { activityTableReaders } from "./activity-table";
import { commandScriptReaders } from "./command-scripts";
import { destinationReaders } from "./destinations";
import { incidentNameReaders } from "./incident-names";
import { inventoryReaders } from "./inventory";
import { investmentGlobals } from "./investment-globals";
import { itemReaders } from "./items";
import { newCharacterReaders } from "./new-character";
import { packageHeaderReaders } from "./package-header";
import { type GibbonApi, packageSetOf } from "./package-set";
import { progressionReaders } from "./progressions";
import { serverMessageReaders } from "./server-messages";
import { statCurveReaders } from "./stat-curves";
import { talentGridReaders } from "./talent-grids";
import { unlockFlagReaders } from "./unlock-flags";
import { vendorReaders } from "./vendors";

// The readers over gibbon's build. The package set opens, in the directory
// `packagesDir` names, when one first reads.
export function createReaders(
  g: GibbonApi,
  itemType: ActivityBundleItemTypes,
  packagesDir: () => string
): ContentReaders {
  const packages = packageSetOf(g, packagesDir);
  const investment = investmentGlobals(packages);
  return {
    ...abilityReaders(investment),
    ...activityReaders(packages, investment),
    ...activityTableReaders(packages, itemType),
    ...commandScriptReaders(packages, itemType),
    ...destinationReaders(packages),
    ...incidentNameReaders(packages),
    ...inventoryReaders(investment),
    ...itemReaders(packages, investment),
    ...newCharacterReaders(investment),
    ...packageHeaderReaders(g),
    ...progressionReaders(g, investment),
    ...serverMessageReaders(investment),
    ...statCurveReaders(g, investment),
    ...talentGridReaders(investment),
    ...unlockFlagReaders(g, investment),
    ...vendorReaders(investment),
  };
}
