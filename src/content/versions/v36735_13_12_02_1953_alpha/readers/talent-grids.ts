// Talent grids, read off the disc packages.
import { k_empty_name_hash } from "../../../../utils/name-hash";
import type { AbilityGrant } from "../../../model/investment";
import type { ContentReaders } from "../../content-build";
import type { InvestmentGlobals } from "./investment-globals";

// What a step's ability index, a grid's progression and a step's perk hold
// when they have none.
const NO_ABILITY = 0xff;
const NO_PROGRESSION = 0xff;
const NO_PERK = -1;

// Every ability grant in the grid: a step that names an ability puts it in a
// button slot.
function abilityGrants(grid: any): AbilityGrant[] {
  const found: AbilityGrant[] = [];
  grid.nodes.forEach((node: any, index: number) => {
    for (const step of node.steps) {
      if (step.ability_index !== NO_ABILITY) {
        found.push({
          node: index,
          level: step.level_requirement,
          auto: node.auto_granted !== 0,
          ability: step.ability_index,
          slot: step.button_slot,
        });
      }
    }
  });
  return found;
}

export function talentGridReaders(
  investment: InvestmentGlobals
): Pick<ContentReaders, "talentGrid" | "talentGridBuildSource"> {
  let gridTable: any;

  function rawGrid(index: number): any {
    gridTable ??= investment.table("talent_grids", "s_talent_grid_table");
    const row = gridTable.grids[index];
    return row && investment.readTag(row.tag, "s_talent_grid");
  }

  return {
    talentGrid(index) {
      const grid = rawGrid(index);
      return grid
        ? {
            index,
            progression:
              grid.progression === NO_PROGRESSION ? -1 : grid.progression,
            nodes: grid.nodes.map((node: any, nodeIndex: number) => ({
              index: nodeIndex,
              nameHash: node.name_hash,
              binaryPairHash: node.binary_pair_hash,
              autoGranted: node.auto_granted !== 0,
              prerequisiteNodes: node.prerequisites.map((p: any) => p.node),
              steps: node.steps.map((step: any) => ({
                levelRequirement: step.level_requirement,
                // The alpha's steps name no required node.
                requiredNodeHash: k_empty_name_hash,
              })),
            })),
          }
        : undefined;
    },

    talentGridBuildSource(index) {
      const grid = rawGrid(index);
      if (!grid) {
        throw new Error(`no talent grid at table row ${index}`);
      }
      return {
        grants: abilityGrants(grid),
        nodes: grid.nodes.map((node: any) => ({
          autoGranted: node.auto_granted !== 0,
          perks: node.steps
            .map((step: { perk: number }) => step.perk)
            .filter((perk: number) => perk !== NO_PERK),
        })),
      };
    },
  };
}
