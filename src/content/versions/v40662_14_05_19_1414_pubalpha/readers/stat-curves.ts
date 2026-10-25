// Stat curves (investment globals slot "stat_curves"). A curve's index is its
// stat's index. Each of a curve's lists is a count and room for 20 rows, not
// a block.
import type { StatCurvePoint } from "../../../model/investment";
import type { ContentReaders } from "../../content-build";
import type { InvestmentGlobals } from "./investment-globals";

export function statCurveReaders(
  investment: InvestmentGlobals
): Pick<ContentReaders, "statCurves"> {
  return {
    statCurves() {
      return investment
        .table("stat_curves", "s_stat_curve_table")
        .curves.map(({ name_hash, curve }: any, index: number) => ({
          index,
          nameHash: name_hash,
          // A stat can have no curve struct.
          points: (curve?.points.slice(0, curve.point_count) ?? []).map(
            ({ x, y }: StatCurvePoint) => ({ x, y })
          ),
          qualityPoints: (
            curve?.quality_points.slice(0, curve.quality_point_count) ?? []
          ).map(({ x, y }: StatCurvePoint) => ({ x, y })),
          damageWeights: [],
          slotWeights: (
            curve?.slot_weights.slice(0, curve.slot_weight_count) ?? []
          ).map((row: { equip_slot: number; weight: number }) => ({
            equipSlot: row.equip_slot,
            weight: row.weight,
          })),
        }));
    },
  };
}
