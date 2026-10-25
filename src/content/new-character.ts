// What a new character starts with, per class, read off the disc packages on
// first use: the new-character defaults' item lists and flags.
import { newCharacterTable } from "./class-flags";
import { bucketIds } from "./inventory";
import { itemDef, itemDefs } from "./items";
import type {
  NewCharacterDefaults,
  NewCharacterFlag,
} from "./model/investment";
import { contentBuild } from "./versions";

export type {
  NewCharacterDefaults,
  NewCharacterFlag,
} from "./model/investment";

const defaults = new Map<number, NewCharacterDefaults | null>();

// The defaults of a wire class index (0 titan, 1 hunter, 2 warlock),
// undefined for another.
export function newCharacterDefaults(
  classIndex: number
): NewCharacterDefaults | undefined {
  if (!defaults.has(classIndex)) {
    const list = newCharacterTable().startingGear.find(
      (row) => row.class === classIndex
    );
    const subclass =
      contentBuild().ids.starterSubclass?.[classIndex] ??
      itemDefs().findIndex(
        (def) =>
          def.bucket === bucketIds().subclass && def.classIndex === classIndex
      );
    if (!list || subclass < 0) {
      defaults.set(classIndex, null);
    } else {
      const items: Record<number, number> = {};
      for (const value of list.items) {
        const slot = itemDef(value)?.equipSlot;
        if (slot !== null && slot !== undefined) {
          items[slot] = value;
        }
      }
      defaults.set(classIndex, { subclass, items });
    }
  }
  return defaults.get(classIndex) ?? undefined;
}

// The flags a character of this class and race (0 human, 1 awoken, 2 exo) is
// created with.
export function newCharacterFlags(
  classIndex: number,
  raceIndex: number
): NewCharacterFlag[] {
  const row = newCharacterTable().defaults.find(
    (entry) => entry.class === classIndex && entry.race === raceIndex
  );
  return (row?.flags ?? []).map(
    (entry): NewCharacterFlag => ({ flag: entry.flag, value: entry.value })
  );
}
