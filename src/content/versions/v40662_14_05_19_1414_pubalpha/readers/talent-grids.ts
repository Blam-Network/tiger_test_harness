// Talent grids, read off the disc packages.
import type { AbilityGrant } from "../../../model/investment";
import type { ContentReaders } from "../../content-build";
import type { InvestmentGlobals } from "./investment-globals";

const NONE = 0xff;

// Every ability grant in the grid. A step link is the step's ability record: a
// grant is {empty hash, 255, 255, 255, 255, ability index (unknown0b), slot
// (unknown0c's first byte)}, a mod {mod hash, target ability, 255, ...}. Read
// little endian, the word is the slot.
function abilityGrants(grid: any): AbilityGrant[] {
  const found: AbilityGrant[] = [];
  grid.nodes.forEach((node: any, index: number) => {
    for (const step of node.steps) {
      for (const link of step.links) {
        if (link.node === NONE && link.unknown0b !== NONE) {
          found.push({
            node: index,
            level: step.level_requirement,
            auto: node.auto_granted !== 0,
            ability: link.unknown0b,
            slot: link.unknown0c & 0xff,
          });
        }
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
            progression: grid.progression,
            nodes: grid.nodes.map((node: any, nodeIndex: number) => ({
              index: nodeIndex,
              nameHash: node.name_hash,
              binaryPairHash: node.binary_pair_hash,
              autoGranted: node.auto_granted !== 0,
              prerequisiteNodes: node.prerequisites.map((p: any) => p.node),
              steps: node.steps.map((step: any) => ({
                levelRequirement: step.level_requirement,
                requiredNodeHash: step.required_node_hash,
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
          perks: node.steps.flatMap((step: any) =>
            step.perks.map((perk: { perk: number }) => perk.perk)
          ),
        })),
      };
    },
  };
}
