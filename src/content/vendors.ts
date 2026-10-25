// Vendors, read off the disc packages on first use. A vendor's index is
// its row in the vendor table, a purchase's its row in the vendor's list: the
// indices the client sends in vendor_buy_item / vendor_sell_item.
import type { Vendor } from "./model/investment";
import { contentBuild } from "./versions";

export type { Vendor, VendorPurchase } from "./model/investment";

let vendors: readonly Vendor[] | undefined;

export function vendorDefs(): readonly Vendor[] {
  if (!vendors) {
    vendors = contentBuild().readers.vendors();
  }
  return vendors ?? [];
}
