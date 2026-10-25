// The new-character defaults table (investment globals slot
// "new_character_defaults"): per class and race the flags a character is
// created with, and per class its starting gear (the table's own class and
// race numbers).
import type { ContentReaders } from "../../content-build";
import { IDS } from "../ids";
import type { InvestmentGlobals } from "./investment-globals";

export function newCharacterReaders(
  investment: InvestmentGlobals
): Pick<ContentReaders, "newCharacterTable"> {
  return {
    newCharacterTable() {
      const table = investment.table(
        "new_character_defaults",
        "s_new_character_defaults"
      );
      return {
        defaults: table.defaults.map((row: any) => ({
          class: row.class,
          race: row.race,
          // The alpha lists its class flags with the rest.
          classFlags: [],
          flags: row.flags.map((entry: { flag: number }) => ({
            flag: entry.flag,
            value: IDS.unlockFlagSet,
          })),
        })),
        startingGear: table.kits.map((row: any) => ({
          class: row.class,
          items: row.items.map((entry: { item: number }) => entry.item),
        })),
      };
    },
  };
}
