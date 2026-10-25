import { equipSlotIds } from "../../content/inventory";
import { contentBuild } from "../../content/versions";

// The starting kit's server picks: items the new-character defaults don't
// name, so the packages have no source for them. Keyed by the equip slot they
// fill.
export function serverPicks(): Readonly<Record<number, number>> {
  const slots = equipSlotIds();
  return Object.fromEntries(
    Object.entries(contentBuild().ids.starterPicks).map(([slot, defIndex]) => [
      slots[slot as keyof typeof slots],
      defIndex,
    ])
  );
}
