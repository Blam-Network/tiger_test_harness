// The inventory buckets (investment globals slot "inventory"). Every row of
// the alpha's table is in the character's bag: it has no other-scope flag.
import type { ContentReaders } from "../../content-build";
import type { InvestmentGlobals } from "./investment-globals";

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
          otherScope: false,
        })),
      };
    },
  };
}
