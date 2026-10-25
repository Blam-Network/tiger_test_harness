// The new-character defaults table, read off the disc packages on first use,
// and the class flags in it. Items names a class by one of these flags, so
// this module reads no item.
import type { NewCharacterTable } from "./model/investment";
import { contentBuild } from "./versions";

let table: NewCharacterTable | undefined;

export function newCharacterTable(): NewCharacterTable {
  table ??= contentBuild().readers.newCharacterTable();
  return table;
}

// [first flag, last flag, wire class index] (0 titan, 1 hunter, 2 warlock).
type ClassFlagRange = readonly [number, number, number];

let ranges: readonly ClassFlagRange[] | undefined;

// Class unlock flags (storage 9 intrinsic flags): the flags a new character
// of the class gets. Some are shared by every class; the rest, seven to a
// class, are consecutive and name the class.
export function classFlagRanges(): readonly ClassFlagRange[] {
  if (!ranges) {
    const byClass = new Map<number, Set<number>>();
    for (const row of newCharacterTable().defaults) {
      const flags = byClass.get(row.class) ?? new Set<number>();
      for (const flag of row.classFlags) {
        flags.add(flag);
      }
      byClass.set(row.class, flags);
    }
    const lists = [...byClass.values()];
    const shared = new Set(
      [...(lists[0] ?? [])].filter((flag) => lists.every((l) => l.has(flag)))
    );
    ranges = [...byClass.entries()]
      .sort(([a], [b]) => a - b)
      .map(([classIndex, flags]): ClassFlagRange => {
        const own = [...flags].filter((flag) => !shared.has(flag));
        return [Math.min(...own), Math.max(...own), classIndex];
      });
  }
  return ranges;
}
