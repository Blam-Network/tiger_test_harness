import { expect, it } from "vitest";
import { describeWithPackages } from "../test-support/build";
import {
  MemoryCharacterStore,
  SOID_TYPE_ITEM,
  soidFor,
} from "./character-store";
import {
  CharacterLoadout,
  emptyTalentNodes,
  type LoadoutItem,
} from "./loadout";
import { starterCurrencyDef } from "./stubs/starting-currency";
import { STUB_APPEARANCE } from "./stubs/stub-account";
import {
  applyPurchase,
  applySale,
  type PurchaseOk,
  planPurchase,
  planSale,
  type SaleOk,
  VENDOR_STATUS_INVALID_ARGUMENTS,
  VENDOR_STATUS_NO_FUNDS,
  VENDOR_STATUS_OK,
} from "./vendor";

function stackItem(
  soid: bigint,
  defIndex: number,
  bucket: number,
  quantity: number
): LoadoutItem & { soid: bigint } {
  return {
    soid,
    defIndex,
    bucket,
    equipSlot: null,
    instanced: false,
    quantity,
    artArrangement: 0,
    sandboxPattern: 0,
    power: 0,
    stats: [],
    talentXp: 0,
    talentNodes: [],
  };
}

const CURRENCY_SOID = soidFor(SOID_TYPE_ITEM, 1);
// Currency stacks live under the bag's currency alias, bucket 0.
const CURRENCY_BUCKET = 0;
// Vendor 3 sells a level 3 helmet (item 321, bucket 7) for 150 glimmer.
const ARMOUR_VENDOR = 3;
const HELMET = 321;
const HELMET_COST = 150;
// Vendor 4 gives the warlock subclasses away; vendor 6 sells item 1447
// (bucket 19, stacks to 10) for one of item 903 (a material, bucket 5).
const SUBCLASS_VENDOR = 4;
const STACK_VENDOR = 6;
const STACK_ITEM = 1447;
const STACK_BUCKET = 19;
const STACK_COST_ITEM = 903;
const MATERIAL_BUCKET = 5;

const glimmer = () => starterCurrencyDef() as number;

describeWithPackages("vendor purchase planning", () => {
  it("fails with invalid_arguments for a bad vendor/purchase index", () => {
    const loadout = CharacterLoadout.fromItems([
      stackItem(CURRENCY_SOID, glimmer(), CURRENCY_BUCKET, 100),
    ]);
    expect(planPurchase(loadout, 999, 0).status).toBe(
      VENDOR_STATUS_INVALID_ARGUMENTS
    );
    expect(planPurchase(loadout, ARMOUR_VENDOR, 9999).status).toBe(
      VENDOR_STATUS_INVALID_ARGUMENTS
    );
  });

  it("fails with no_funds when the currency stack is short", () => {
    const loadout = CharacterLoadout.fromItems([
      stackItem(CURRENCY_SOID, glimmer(), CURRENCY_BUCKET, HELMET_COST - 1),
    ]);
    expect(planPurchase(loadout, ARMOUR_VENDOR, 0).status).toBe(
      VENDOR_STATUS_NO_FUNDS
    );
  });

  it("plans an instanced purchase: room for a new row, funds available", () => {
    const loadout = CharacterLoadout.fromItems([
      stackItem(CURRENCY_SOID, glimmer(), CURRENCY_BUCKET, 200),
    ]);
    const plan = planPurchase(loadout, ARMOUR_VENDOR, 0);
    expect(plan.status).toBe(VENDOR_STATUS_OK);
    const ok = plan as PurchaseOk;
    expect(ok.action.kind).toBe("insert");
    expect(ok.cost?.quantity).toBe(HELMET_COST);
    expect(ok.cost?.item.soid).toBe(CURRENCY_SOID);
  });

  it("merges into an existing stack instead of inserting a new row", () => {
    const existingStackSoid = soidFor(SOID_TYPE_ITEM, 2);
    const loadout = CharacterLoadout.fromItems([
      stackItem(CURRENCY_SOID, STACK_COST_ITEM, MATERIAL_BUCKET, 10),
      stackItem(existingStackSoid, STACK_ITEM, STACK_BUCKET, 5),
    ]);
    const plan = planPurchase(loadout, STACK_VENDOR, 0);
    expect(plan.status).toBe(VENDOR_STATUS_OK);
    const ok = plan as PurchaseOk;
    expect(ok.action.kind).toBe("merge");
    if (ok.action.kind === "merge") {
      expect(ok.action.target.soid).toBe(existingStackSoid);
      expect(ok.action.addQuantity).toBe(1);
    }
  });
});

describeWithPackages("vendor purchase / sale against a store", () => {
  async function characterWithLoadout(
    items: (LoadoutItem & { soid: bigint })[]
  ) {
    const store = new MemoryCharacterStore();
    const account = await store.accountForPlatformId(1n, "guardian");
    const character = await store.createCharacter(
      account.soid,
      "guardian",
      STUB_APPEARANCE
    );
    character.loadout = CharacterLoadout.fromItems(items);
    return { store, character };
  }

  it("buys an instanced item: decrements currency and inserts a new row", async () => {
    const { store, character } = await characterWithLoadout([
      stackItem(CURRENCY_SOID, glimmer(), CURRENCY_BUCKET, 200),
    ]);
    const plan = planPurchase(character.loadout, ARMOUR_VENDOR, 0);
    expect(plan.status).toBe(VENDOR_STATUS_OK);
    const newSoid = await applyPurchase(store, character, plan as PurchaseOk);
    expect(newSoid).not.toBeNull();
    const item = character.loadout.item(newSoid as bigint);
    expect(item?.defIndex).toBe(HELMET);
    expect(item?.bucket).toBe(7);
    expect(item?.instanced).toBe(true);
    expect(item?.quantity).toBe(1);
    expect(
      character.loadout.stackAt(glimmer(), CURRENCY_BUCKET)?.quantity
    ).toBe(200 - HELMET_COST);
  });

  // The offer's level overrides the definition's level block for the new
  // instance (it is 3 on this one).
  it("carries the offer's level onto the purchased item", async () => {
    const { store, character } = await characterWithLoadout([
      stackItem(CURRENCY_SOID, glimmer(), CURRENCY_BUCKET, 200),
    ]);
    const plan = planPurchase(character.loadout, ARMOUR_VENDOR, 0);
    const newSoid = await applyPurchase(store, character, plan as PurchaseOk);
    expect(character.loadout.item(newSoid as bigint)?.level).toBe(3);
  });

  // addItem must not push the new row onto character.loadout itself
  // (applyPurchase does), or the item lands twice in loadout.items. A
  // purchased item's talentXp/talentNodes come out fresh (0 / all zero).
  it("buys a talent-gridded item: exactly one row, fresh (untouched) talent state", async () => {
    const { store, character } = await characterWithLoadout([]);
    // The subclass offers are free (cost 0), so no currency stack is needed.
    const plan = planPurchase(character.loadout, SUBCLASS_VENDOR, 0);
    expect(plan.status).toBe(VENDOR_STATUS_OK);
    const newSoid = await applyPurchase(store, character, plan as PurchaseOk);
    expect(newSoid).not.toBeNull();
    expect(
      character.loadout.items.filter((i) => i.soid === newSoid)
    ).toHaveLength(1);
    const item = character.loadout.item(newSoid as bigint);
    expect(item?.talentXp).toBe(0);
    expect(item?.talentNodes).toEqual(emptyTalentNodes());
  });

  it("sells an instanced item back: credits currency and removes the row", async () => {
    const itemSoid = soidFor(SOID_TYPE_ITEM, 3);
    const { store, character } = await characterWithLoadout([
      stackItem(CURRENCY_SOID, glimmer(), CURRENCY_BUCKET, 100),
      {
        soid: itemSoid,
        defIndex: HELMET,
        bucket: 7,
        equipSlot: null,
        instanced: true,
        quantity: 1,
        artArrangement: 0,
        sandboxPattern: 0,
        power: 0,
        stats: [],
        talentXp: 0,
        talentNodes: [],
      },
    ]);
    const plan = planSale(
      character.loadout,
      ARMOUR_VENDOR,
      { hasInstance: true, itemSoid, defIndex: HELMET },
      1
    );
    expect(plan.status).toBe(VENDOR_STATUS_OK);
    const removedSoid = await applySale(store, character, plan as SaleOk);
    expect(removedSoid).toBe(itemSoid);
    expect(character.loadout.item(itemSoid)).toBeUndefined();
    // The vendor sells the helmet for 150, so selling credits 150 back.
    expect(
      character.loadout.stackAt(glimmer(), CURRENCY_BUCKET)?.quantity
    ).toBe(100 + HELMET_COST);
  });
});
