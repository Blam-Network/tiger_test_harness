// Stat curves (investment globals slot "stat_curves"). A curve's index is its
// stat's index. Only the power and weapon power stats have one.
import type { ContentReaders } from "../../content-build";
import type { InvestmentGlobals } from "./investment-globals";
import type { GibbonApi } from "./package-set";

export function statCurveReaders(
  g: GibbonApi,
  investment: InvestmentGlobals
): Pick<ContentReaders, "statCurves"> {
  return {
    statCurves() {
      return investment
        .table("stat_curves", "s_stat_curve_table")
        .curves.map(({ name_hash, scaling }: any, index: number) => ({
          index,
          nameHash: name_hash,
          points: scaling ? g.stat_curve_points(scaling.curve) : [],
          // The pre-curve plays the quality curve's part: an item's bias runs
          // through it before it is added to the value on the curve.
          qualityPoints: scaling ? g.stat_curve_points(scaling.pre_curve) : [],
          // The alpha weights by damage type, not by equip slot.
          slotWeights: [],
          damageWeights: scaling
            ? scaling.damage_weights.weights
                .slice(0, scaling.damage_weights.count)
                .map((row: { damage_type: number; weight: number }) => ({
                  damageType: row.damage_type,
                  weight: row.weight,
                }))
            : [],
        }));
    },
  };
}
