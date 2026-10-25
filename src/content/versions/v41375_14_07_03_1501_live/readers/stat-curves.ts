// Stat curves (investment globals slot "stat_curves"). A curve's index is its
// stat's index.
import type { StatCurvePoint } from "../../../model/investment";
import type { ContentReaders } from "../../content-build";
import type { InvestmentGlobals } from "./investment-globals";

// The low byte of a slot weight's key is the equip slot; bit 0x100 is set on
// some rows, meaning unknown.
const EQUIP_SLOT_MASK = 0xff;

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
          points: (curve?.points ?? []).map(({ x, y }: StatCurvePoint) => ({
            x,
            y,
          })),
          qualityPoints: (curve?.quality_points ?? []).map(
            ({ x, y }: StatCurvePoint) => ({ x, y })
          ),
          damageWeights: [],
          slotWeights: (curve?.slot_weights ?? []).map(
            (row: { equip_slot: number; weight: number }) => ({
              equipSlot: row.equip_slot & EQUIP_SLOT_MASK,
              weight: row.weight,
            })
          ),
        }));
    },
  };
}
