// The new-character defaults table (investment globals slot
// "new_character_defaults"): per class and race the flags a character is
// created with, and per class its starting gear.
import type { ContentReaders } from "../../content-build";
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
          // Intrinsic flags (storage 9): a row's unknown20.
          classFlags: row.unknown20.map(
            (entry: { value: number }) => entry.value
          ),
          flags: row.flags.map((entry: { flag: number; value: number }) => ({
            flag: entry.flag,
            value: entry.value,
          })),
        })),
        // The class's list of starting gear is the table's unknown04.
        startingGear: table.unknown0c.map((row: any) => ({
          class: row.class,
          items: row.unknown04.map((entry: { value: number }) => entry.value),
        })),
      };
    },
  };
}
