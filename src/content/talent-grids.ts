// Talent grids and the subclasses' starting builds, read off the disc
// packages on first use.

import { bucketIds } from "./inventory";
import { itemDefs } from "./items";
import type {
  AbilityGrant,
  SubclassBuild,
  TalentGrid,
} from "./model/investment";
import { contentBuild } from "./versions";

export type {
  SubclassBuild,
  TalentGrid,
  TalentGridNode,
  TalentGridStep,
} from "./model/investment";

const ABILITY_SLOT_COUNT = 5;

const grids = new Map<number, TalentGrid | null>();

// The talent grid at a grid table row, undefined past the table.
export function talentGrid(index: number): TalentGrid | undefined {
  if (!grids.has(index)) {
    grids.set(index, contentBuild().readers.talentGrid(index) ?? null);
  }
  return grids.get(index) ?? undefined;
}

// The starting build the server hands the client in the gear block: per
// ability slot the auto-granted node, else the one with the lowest level
// requirement, and the perks of every node picked.
function subclassBuildOf(gridIndex: number): SubclassBuild {
  const { grants, nodes: gridNodes } =
    contentBuild().readers.talentGridBuildSource(gridIndex);
  const picked: AbilityGrant[] = [];
  const abilities: number[] = [];
  for (let slot = 0; slot < ABILITY_SLOT_COUNT; slot++) {
    const best = grants
      .filter((grant) => grant.slot === slot)
      .sort((a, b) => Number(b.auto) - Number(a.auto) || a.level - b.level)[0];
    abilities.push(best ? best.ability : -1);
    if (best) {
      picked.push(best);
    }
  }
  // Auto-granted nodes without an ability carry the subclass's base perks.
  const perks = new Set<number>();
  const nodes: number[] = [];
  gridNodes.forEach((node, index) => {
    if (!(node.autoGranted || picked.some((p) => p.node === index))) {
      return;
    }
    nodes.push(index);
    for (const perk of node.perks) {
      perks.add(perk);
    }
  });
  return { grid: gridIndex, abilities, perks: [...perks], nodes };
}

let builds: ReadonlyMap<number, SubclassBuild> | undefined;

// The starting build of every subclass def (bucket 6), by def index.
export function subclassBuilds(): ReadonlyMap<number, SubclassBuild> {
  if (!builds) {
    const found = new Map<number, SubclassBuild>();
    itemDefs().forEach((def, index) => {
      if (def.bucket === bucketIds().subclass && def.gridIndex !== null) {
        found.set(index, subclassBuildOf(def.gridIndex));
      }
    });
    builds = found;
  }
  return builds;
}
