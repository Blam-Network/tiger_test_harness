import { fnv1 } from "@blamnetwork/bullshcript/destiny1/common";
import { vendorDefs } from "../../content/vendors";

// Starting currency: glimmer (not instanced, in a bucket outside the character
// scope, so stored under the currency alias). A new guardian starts with
// exactly 500 and nothing else; other currencies show "no_funds" until earned.
const STARTER_CURRENCY_QUANTITY = 500;
const CURRENCY_VENDOR_HASH = fnv1("currency_vendor");

export function starterCurrencyDef(): number | undefined {
  return vendorDefs().find((v) => v.nameHash === CURRENCY_VENDOR_HASH)
    ?.currencyDef;
}

export function starterCurrencies(): { defIndex: number; quantity: number }[] {
  const defIndex = starterCurrencyDef();
  return defIndex === undefined
    ? []
    : [{ defIndex, quantity: STARTER_CURRENCY_QUANTITY }];
}
