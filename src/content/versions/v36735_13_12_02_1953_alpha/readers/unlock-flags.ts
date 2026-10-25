// The unlock flags' tables: which flag each wire slot sets, where a flag comes
// from and when the time table flips it. The flags are numbered, not named:
// their name hashes aren't cracked. The alpha has no unlock value table, and
// its records are slot 0, the achievements (the live build lists achievements
// and grimoire cards there).
import type { UnlockFlagSource, UnlockScope } from "../../../model/investment";
import type { ContentReaders } from "../../content-build";
import type { InvestmentGlobals } from "./investment-globals";
import type { GibbonApi } from "./package-set";

const SCOPES: readonly UnlockScope[] = ["account", "offer", "character"];

export function unlockFlagReaders(
  g: GibbonApi,
  investment: InvestmentGlobals
): Pick<ContentReaders, "recordFlags" | "unlockTables"> {
  return {
    unlockTables() {
      const slotTable = investment.table("unlock_slots", "s_unlock_slot_table");
      const flagOfSlot = {} as Record<UnlockScope, number[]>;
      for (const scope of SCOPES) {
        flagOfSlot[scope] = slotTable[scope].map(
          (row: { flag: number }) => row.flag
        );
      }
      const sourceNames = Object.fromEntries(
        Object.entries(g.e_unlock_flag_source).map(([name, id]) => [id, name])
      ) as Record<number, UnlockFlagSource>;
      const sources = investment
        .table("unlock_flag_names", "s_unlock_flag_name_table")
        .flags.map((row: { source: number }) => sourceNames[row.source]);
      const timeTable = investment.table("unlock_times", "s_unlock_time_table");
      return {
        flagOfSlot,
        sources,
        times: timeTable.times.map(
          (row: { flag: number; time: bigint; value: number }) => ({
            flag: row.flag,
            time: row.time,
            value: row.value,
          })
        ),
      };
    },

    recordFlags() {
      return investment
        .table("achievements", "s_achievement_table")
        .achievements.map((row: { flag: number }) => row.flag);
    },
  };
}
