// The inventory buckets (investment globals slot "inventory").
import type { ContentReaders } from "../../content-build";
import type { InvestmentGlobals } from "./investment-globals";

// A bucket row whose first flag is set belongs to another scope than the
// character's bag (ids 21-24, 28, 29).
const FLAG_OTHER_SCOPE = 0;

export function inventoryReaders(
  investment: InvestmentGlobals
): Pick<ContentReaders, "inventoryTable"> {
  return {
    inventoryTable() {
      const raw = investment.table("inventory", "s_inventory_buckets");
      return {
        unequippable: raw.unequippable_buckets.slice(
          0,
          raw.unequippable_bucket_count
        ),
        rows: raw.buckets.slice(0, raw.bucket_count).map((row: any) => ({
          id: row.id,
          firstSlot: row.first_slot,
          slotCount: row.slot_count,
          otherScope: row.flags[FLAG_OTHER_SCOPE] === 1,
        })),
      };
    },
  };
}
