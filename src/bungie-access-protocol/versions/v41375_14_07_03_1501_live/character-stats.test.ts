import { expect, it } from "vitest";
import { equipSlotIds } from "../../../content/inventory";
import { itemDef } from "../../../content/items";
import {
  type CharacterRecord,
  MemoryCharacterStore,
} from "../../../investment/character-store";
import { armourDefense, weaponAttack } from "../../../investment/primary-stat";
import { STUB_APPEARANCE } from "../../../investment/stubs/stub-account";
import { describeWithPackages } from "../../../test-support/build";
import { characterStats, itemStat, weaponStats } from "./character-stats";

async function guardian(): Promise<CharacterRecord> {
  const store = new MemoryCharacterStore();
  const account = await store.accountForPlatformId(1n, "guardian");
  return store.createCharacter(account.soid, "guardian", STUB_APPEARANCE);
}

// Every equipped item at the dev grants' level 20 / quality 62.
async function granted(): Promise<CharacterRecord> {
  const character = await guardian();
  for (const item of character.loadout.items) {
    item.level = 20;
    item.quality = 62;
  }
  return character;
}

const ITEM = { level: 20, quality: 62 };

describeWithPackages("gear block stats", () => {
  it("weighs the armour curves by equip slot", () => {
    // stat_defense at x = 20 + 6.2: 1043.2, chest 36 / 120 of it.
    expect(itemStat(1, 0, 3, ITEM)).toBe(312);
    expect(itemStat(1, 0, 3, ITEM)).toBe(armourDefense(3, 20, 62));
    // light: (21, 20)..(30, 120) at 26.2 is 77.8, a quarter per piece.
    expect(itemStat(0, 0, 1, ITEM)).toBe(19);
    // A slot the weights leave out gets none; an authored value is kept.
    expect(itemStat(1, 0, 5, ITEM)).toBe(0);
    expect(itemStat(12, 80, 6, ITEM)).toBe(80);
  });

  it("sums Defense, light and the rolls over the armour", async () => {
    const character = await granted();
    const stats = new Map(characterStats(character));
    let defense = 0;
    for (let slot = 0; slot < 20; slot++) {
      const def = itemDef(character.loadout.equipped(slot)?.defIndex ?? -1);
      defense += (def?.equipSlot && armourDefense(def.equipSlot, 20, 62)) || 0;
    }
    expect(defense).toBeGreaterThan(0);
    expect(stats.get(1)).toBe(defense);
    for (const stat of [5, 6, 7]) {
      expect(stats.get(stat)).toBeGreaterThan(0);
    }
  });

  it("gives Armor / Agility / Recovery from the subclass", async () => {
    const stats = new Map(characterStats(await granted()));
    // The stub character is a warlock: Voidwalker 1 / 1 / 5.
    expect([stats.get(2), stats.get(3), stats.get(4)]).toEqual([1, 1, 5]);
  });

  it("lets the light override win and packs in stat order", async () => {
    const pairs = characterStats(await granted());
    expect(pairs.map(([stat]) => stat)).toEqual(
      [...pairs.map(([stat]) => stat)].sort((a, b) => a - b)
    );
    expect(pairs.every(([, value]) => value > 0)).toBe(true);
  });

  it("sends a weapon's Attack off the curve", async () => {
    const character = await granted();
    const stats = new Map(weaponStats(character, equipSlotIds().primary));
    expect(stats.get(10)).toBe(weaponAttack(20, 62));
    expect(weaponAttack(20, 62)).toBe(365);
  });
});
