// The ability table (investment globals slot "abilities", mirrored by the
// client's own table). A subclass's gear block names its abilities by index
// into it.
import type { ContentReaders } from "../../content-build";
import type { InvestmentGlobals } from "./investment-globals";

export function abilityReaders(
  investment: InvestmentGlobals
): Pick<ContentReaders, "abilities"> {
  return {
    abilities() {
      return investment
        .table("abilities", "s_ability_table")
        .abilities.map((ability: { name_hash: number }) => ({
          nameHash: ability.name_hash,
        }));
    },
  };
}
