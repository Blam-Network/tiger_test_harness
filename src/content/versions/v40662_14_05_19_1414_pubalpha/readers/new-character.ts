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
          // Intrinsic flags (storage 9): a row's unknown40 (the live build's
          // unknown20).
          classFlags: row.unknown40.map(
            (entry: { value: number }) => entry.value
          ),
          flags: row.flags.map((entry: { flag: number; value: number }) => ({
            flag: entry.flag,
            value: entry.value,
          })),
        })),
        // The class's list of starting gear is the row's unknown08 (the live
        // build's unknown04). Its unknown18 holds unnamed armour and one
        // weapon, purpose unknown.
        startingGear: table.unknown18.map((row: any) => ({
          class: row.class,
          items: row.unknown08.map((entry: { value: number }) => entry.value),
        })),
      };
    },
  };
}
