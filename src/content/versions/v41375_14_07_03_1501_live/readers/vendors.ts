// Vendors (investment globals slot "vendors"). A vendor's index is its row in
// the vendor table, a purchase's its row in the vendor's list: the indices the
// client sends in vendor_buy_item / vendor_sell_item.
import type { ContentReaders } from "../../content-build";
import type { InvestmentGlobals } from "./investment-globals";

// An unset i16 item reference.
const NO_ITEM = -1;

export function vendorReaders(
  investment: InvestmentGlobals
): Pick<ContentReaders, "vendors"> {
  return {
    vendors() {
      const table = investment.table("vendors", "s_vendor_table");
      return table.vendors.map((row: { name_hash: number; tag: number }) => {
        const vendor = investment.readTag(row.tag, "s_vendor");
        return {
          nameHash: row.name_hash,
          currencyDef:
            vendor.currency_item === NO_ITEM ? undefined : vendor.currency_item,
          purchases: vendor.purchases.map((purchase: any) => ({
            itemDef: purchase.item,
            quantity: purchase.quantity,
            explicitCost: purchase.explicit_cost !== 0,
            costDef: purchase.cost_item,
            costQuantity: purchase.cost_quantity,
            level: purchase.level,
          })),
        };
      });
    },
  };
}
