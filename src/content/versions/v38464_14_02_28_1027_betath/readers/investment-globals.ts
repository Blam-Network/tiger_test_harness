// Reads of the investment globals' tables off the disc packages: each global
// slot points at a tag, read as the struct that table is.
import type { GibbonApi, Packages } from "./package-set";

type InvestmentSlot = keyof GibbonApi["e_investment_global"];
type InvestmentClientSlot = keyof GibbonApi["e_investment_client_global"];
type StructName = Extract<keyof GibbonApi, `s_${string}`>;

export interface InvestmentGlobals {
  // The table a slot of the client's globals (the investment_globals root's
  // own data) points at.
  clientTable(slot: InvestmentClientSlot, struct: StructName): any;
  readTag(tag: number, struct: StructName): any;
  // The table a slot of the investment globals points at.
  table(slot: InvestmentSlot, struct: StructName): any;
}

export function investmentGlobals(packages: () => Packages): InvestmentGlobals {
  const readTag = (tag: number, struct: StructName): any => {
    const { g, set } = packages();
    return g.read_definition(set.read_tag(tag), g[struct] as any);
  };
  return {
    readTag,
    table(slot, struct) {
      const { g, set } = packages();
      return readTag(
        g.investment_global_tag(set, g.e_investment_global[slot]),
        struct
      );
    },
    clientTable(slot, struct) {
      const { g, set } = packages();
      return readTag(
        g.investment_client_global_tag(set, g.e_investment_client_global[slot]),
        struct
      );
    },
  };
}
