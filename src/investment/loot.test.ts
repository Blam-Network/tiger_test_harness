import { afterEach, describe, expect, it } from "vitest";
import { itemDef } from "../content/items";
import { describeWithPackages } from "../test-support/build";
import { MemoryCharacterStore } from "./character-store";
import { CharacterLoadout } from "./loadout";
import {
  applyLootPickup,
  LOOT_STATE_GROUND,
  LOOT_STATUS_OK,
  LOOT_STATUS_UNKNOWN_NONCE,
  LootTable,
  rollLootDrop,
} from "./loot";
import {
  dropChanceForValue,
  LOOT_DROP_CONFIG,
  lootPoolDefs,
} from "./stubs/loot-policy";
import { starterCurrencyDef } from "./stubs/starting-currency";
import { STUB_APPEARANCE } from "./stubs/stub-account";

describe("LootTable", () => {
  it("drops into a free slot with an incrementing ordinal", () => {
    const table = new LootTable();
    const first = table.drop(497, 1, 0x34fd, 0x0000000200000001n);
    const second = table.drop(498, 1, 0x34fd, 0x0000000200000001n);
    expect(first.index).toBe(0);
    expect(first.slot.nonce.ordinal).toBe(0);
    expect(second.index).toBe(1);
    expect(second.slot.nonce.ordinal).toBe(1);
    expect(first.slot.state).toBe(LOOT_STATE_GROUND);
    expect(table.hasPendingWire).toBe(true);
  });

  it("evicts the oldest slot once all 64 are used, instead of refusing", () => {
    const table = new LootTable();
    for (let i = 0; i < 64; i++) {
      table.drop(1, 1, i, 1n);
    }
    const evicted = table.drop(999, 1, 999, 1n);
    expect(evicted.index).toBe(0);
    expect(evicted.slot.itemDef).toBe(999);
    expect(table.at(0)?.itemDef).toBe(999);
    // Every other slot is untouched - only the oldest was overwritten.
    expect(table.at(1)?.itemDef).toBe(1);
  });

  it("finds a slot by its full nonce and misses on a wrong ordinal", () => {
    const table = new LootTable();
    const dropped = table.drop(497, 1, 0x34fd, 0x0000000200000001n);
    const nonce = dropped.slot.nonce;
    expect(table.findByNonce(LOOT_STATE_GROUND, nonce)?.index).toBe(
      dropped.index
    );
    expect(
      table.findByNonce(LOOT_STATE_GROUND, { ...nonce, ordinal: 9 })
    ).toBeUndefined();
  });

  it("collect frees the slot and arms a one-shot clear", () => {
    const table = new LootTable();
    const dropped = table.drop(497, 1, 1, 1n);
    table.collect(dropped.index);
    expect(table.at(dropped.index)).toBeUndefined();
    expect(table.isPendingClear(dropped.index)).toBe(true);
    // Consuming the clear (as the wire encoder does) drops hasPendingWire
    // back to false — the slot is fully free and unknown9 can go absent.
    table.consumePendingClear(dropped.index);
    expect(table.hasPendingWire).toBe(false);
    // Freed index is reusable for a new drop.
    const redropped = table.drop(498, 1, 2, 1n);
    expect(redropped?.index).toBe(dropped.index);
  });
});

// LOOT_DROP_CONFIG's chanceOverride is readonly for callers; the test
// mutates it directly (the config object itself is a plain, unfrozen
// object) to check the override without a second exported setter.
const config = LOOT_DROP_CONFIG as { chanceOverride?: number };

describe("dropChanceForValue", () => {
  afterEach(() => {
    config.chanceOverride = undefined;
  });

  it("is value/1000, clamped to [0, 1] - a dreg, a vandal, a strike boss", () => {
    expect(dropChanceForValue(50)).toBeCloseTo(0.05); // dreg
    expect(dropChanceForValue(75)).toBeCloseTo(0.075); // vandal
    expect(dropChanceForValue(1000)).toBe(1); // strike boss
    expect(dropChanceForValue(-10)).toBe(0);
    expect(dropChanceForValue(5000)).toBe(1);
  });

  it("chanceOverride replaces the formula outright", () => {
    config.chanceOverride = 0;
    expect(dropChanceForValue(1000)).toBe(0);
    config.chanceOverride = 1;
    expect(dropChanceForValue(0)).toBe(1);
  });
});

describeWithPackages("rollLootDrop", () => {
  it("never drops when chance is exhausted", () => {
    const drop = rollLootDrop(50, () => 1); // random() > chance
    expect(drop).toBeUndefined();
  });

  it("picks an item from the pool when the roll succeeds", () => {
    const drop = rollLootDrop(1000, () => 0);
    expect(drop).toBeDefined();
    expect(lootPoolDefs()).toContain(drop?.itemDef);
    expect(drop?.quantity).toBe(LOOT_DROP_CONFIG.quantity);
  });

  it("the pool only contains instanced, non-currency defs", () => {
    const pool = lootPoolDefs();
    expect(pool.length).toBeGreaterThan(0);
    expect(pool).not.toContain(starterCurrencyDef());
    for (const defIndex of pool) {
      expect(itemDef(defIndex)?.instanced).toBe(true);
    }
  });
});

describeWithPackages("applyLootPickup", () => {
  it("inserts a new instanced row for the rolled def", async () => {
    const store = new MemoryCharacterStore();
    const account = await store.accountForPlatformId(1n, "guardian");
    const character = await store.createCharacter(
      account.soid,
      "guardian",
      STUB_APPEARANCE
    );
    character.loadout = CharacterLoadout.fromItems([]);
    // Item 321 is a helmet.
    const item = await applyLootPickup(store, character, 321);
    expect(item.defIndex).toBe(321);
    expect(item.instanced).toBe(true);
    expect(item.quantity).toBe(1);
    expect(item.bucket).toBe(7);
    expect(character.loadout.item(item.soid)).toBeDefined();
  });
});

describe("loot status constants", () => {
  it("ok is 0, unknown nonce is 1", () => {
    expect(LOOT_STATUS_OK).toBe(0);
    expect(LOOT_STATUS_UNKNOWN_NONCE).toBe(1);
  });
});
