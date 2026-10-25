// Vendor buy / sell (NIDs 901/903). Planning is pure (validate the request
// against the vendor table and the loadout, and decide what has to change)
// so it can be unit tested without a store; apply* performs the store writes
// and mutates the loadout in place.

import { itemDef } from "../content/items";
import { vendorDefs } from "../content/vendors";
import type { CharacterRecord, CharacterStore } from "./character-store";
import {
  bagBucketFor,
  bucketSlotCounts,
  CURRENCY_BUCKET,
} from "./inventory-layout";
import type { CharacterLoadout, LoadoutItem, LoadoutSeed } from "./loadout";

// 80801A2B status values the client only logs on failure (0 or 6 = ok); the
// exact non-zero value doesn't matter to it, so we reuse the client's own
// can_purchase result codes for logging.
export const VENDOR_STATUS_OK = 0 as const;
const VENDOR_STATUS_NO_ROOM = 2 as const;
export const VENDOR_STATUS_NO_FUNDS = 3 as const;
export const VENDOR_STATUS_INVALID_ARGUMENTS = 4 as const;

interface PurchaseCost {
  item: LoadoutItem;
  quantity: number;
}

type PurchaseAction =
  | { kind: "insert"; seed: LoadoutSeed }
  | { kind: "merge"; target: LoadoutItem; addQuantity: number };

export interface PurchaseOk {
  action: PurchaseAction;
  cost: PurchaseCost | null;
  status: typeof VENDOR_STATUS_OK;
}

interface PurchaseFailure {
  status:
    | typeof VENDOR_STATUS_INVALID_ARGUMENTS
    | typeof VENDOR_STATUS_NO_FUNDS
    | typeof VENDOR_STATUS_NO_ROOM;
}

// A union of literal statuses (not PurchaseOk | { status: number }) so
// `plan.status === VENDOR_STATUS_OK` narrows plan to PurchaseOk.
type PurchasePlan = PurchaseFailure | PurchaseOk;

// The bucket a def's stacks live in (the currency alias for the currencies).
function storageBucket(defIndex: number): number {
  const def = itemDef(defIndex);
  return def ? bagBucketFor(def.bucket) : CURRENCY_BUCKET;
}

// A purchase's level override: 0 and 0x80000000 keep the definition's.
const KEEP_DEFINITION_LEVEL = -0x80_00_00_00;

// vendor_buy_item (901). Mirrors the client's can_purchase:
// funds, then room. Only explicit-cost offers are priced — the item
// definition value list that prices the rest isn't loaded, so those offers
// come out free.
export function planPurchase(
  loadout: CharacterLoadout,
  vendorIndex: number,
  purchaseIndex: number
): PurchasePlan {
  const purchase = vendorDefs()[vendorIndex]?.purchases[purchaseIndex];
  const def = purchase && itemDef(purchase.itemDef);
  if (!(purchase && def)) {
    return { status: VENDOR_STATUS_INVALID_ARGUMENTS };
  }

  let cost: PurchaseCost | null = null;
  if (purchase.explicitCost && purchase.costQuantity > 0) {
    const have = loadout.stackAt(
      purchase.costDef,
      storageBucket(purchase.costDef)
    );
    if ((have?.quantity ?? 0) < purchase.costQuantity) {
      return { status: VENDOR_STATUS_NO_FUNDS };
    }
    cost = { item: have as LoadoutItem, quantity: purchase.costQuantity };
  }

  const bucket = bagBucketFor(def.bucket);
  const seed: LoadoutSeed = {
    defIndex: purchase.itemDef,
    bucket,
    equipSlot: null,
    instanced: def.instanced,
    quantity: def.instanced ? 1 : purchase.quantity,
    artArrangement: def.artArrangement,
    sandboxPattern: def.sandboxPattern,
    // Has no authored power on an offer; the owned item takes the
    // character's level (itemPower) and, if the offer sets one, its level.
    power: 0,
    ...(purchase.level !== 0 && purchase.level !== KEEP_DEFINITION_LEVEL
      ? { level: purchase.level }
      : {}),
  };

  if (!def.instanced) {
    const existing = loadout.stackAt(purchase.itemDef, bucket);
    if (existing && existing.quantity + purchase.quantity <= def.maxStack) {
      return {
        status: VENDOR_STATUS_OK,
        action: {
          kind: "merge",
          target: existing,
          addQuantity: purchase.quantity,
        },
        cost,
      };
    }
  }

  const slotCount = bucketSlotCounts()[bucket] ?? 0;
  if (loadout.bucketCount(bucket) >= slotCount) {
    return { status: VENDOR_STATUS_NO_ROOM };
  }
  return { status: VENDOR_STATUS_OK, action: { kind: "insert", seed }, cost };
}

// Persists a PurchaseOk plan and mutates character.loadout to match.
// Returns the new instanced item's soid, or null when the purchase only
// changed a stack (no 80801A25 object to push).
export async function applyPurchase(
  store: CharacterStore,
  character: CharacterRecord,
  plan: PurchaseOk
): Promise<bigint | null> {
  const { loadout } = character;
  if (plan.cost) {
    plan.cost.item.quantity -= plan.cost.quantity;
    await store.setItemQuantity(plan.cost.item.soid, plan.cost.item.quantity);
  }
  if (plan.action.kind === "merge") {
    plan.action.target.quantity += plan.action.addQuantity;
    await store.setItemQuantity(
      plan.action.target.soid,
      plan.action.target.quantity
    );
    return null;
  }
  const item = await store.addItem(character.soid, plan.action.seed);
  loadout.addItem(item);
  return item.instanced ? item.soid : null;
}

interface VendorItemReference {
  defIndex: number;
  hasInstance: boolean;
  itemSoid: bigint;
}

type SaleAction =
  | { kind: "remove"; target: LoadoutItem }
  | { kind: "decrement"; quantity: number; target: LoadoutItem };

export interface SaleOk {
  action: SaleAction;
  creditDef: number | undefined;
  creditQuantity: number;
  status: typeof VENDOR_STATUS_OK;
}

interface SaleFailure {
  status: typeof VENDOR_STATUS_INVALID_ARGUMENTS;
}

type SalePlan = SaleFailure | SaleOk;

// vendor_sell_item (903). There is no sold-item value list either: credit
// is the explicit cost of the first vendor offer that sells the same def, or
// nothing.
export function planSale(
  loadout: CharacterLoadout,
  vendorIndex: number,
  item: VendorItemReference,
  requestedQuantity: number
): SalePlan {
  const vendor = vendorDefs()[vendorIndex];
  if (!vendor) {
    return { status: VENDOR_STATUS_INVALID_ARGUMENTS };
  }
  const target = item.hasInstance
    ? loadout.item(item.itemSoid)
    : loadout.stackByDef(item.defIndex);
  if (!target) {
    return { status: VENDOR_STATUS_INVALID_ARGUMENTS };
  }

  const offer = vendor.purchases.find((p) => p.itemDef === target.defIndex);
  const creditPerUnit = offer?.explicitCost ? offer.costQuantity : 0;

  if (target.instanced) {
    return {
      status: VENDOR_STATUS_OK,
      action: { kind: "remove", target },
      creditDef: vendor.currencyDef,
      creditQuantity: creditPerUnit,
    };
  }

  const sellQuantity = Math.max(
    1,
    Math.min(requestedQuantity, target.quantity)
  );
  const action: SaleAction =
    sellQuantity >= target.quantity
      ? { kind: "remove", target }
      : { kind: "decrement", target, quantity: sellQuantity };
  return {
    status: VENDOR_STATUS_OK,
    action,
    creditDef: vendor.currencyDef,
    creditQuantity: creditPerUnit * sellQuantity,
  };
}

// Persists a SaleOk plan and mutates character.loadout to match. Returns
// the removed instanced item's soid (for the wire deletion, removedItemSoids in
// queuez/family-push.ts pushInventoryChange) or null when only a stack changed.
export async function applySale(
  store: CharacterStore,
  character: CharacterRecord,
  plan: SaleOk
): Promise<bigint | null> {
  const { loadout } = character;
  let removedInstancedSoid: bigint | null = null;
  if (plan.action.kind === "remove") {
    const { target } = plan.action;
    await store.removeItem(target.soid);
    loadout.removeItem(target.soid);
    removedInstancedSoid = target.instanced ? target.soid : null;
  } else {
    const { target, quantity } = plan.action;
    target.quantity -= quantity;
    await store.setItemQuantity(target.soid, target.quantity);
  }

  if (plan.creditDef !== undefined && plan.creditQuantity > 0) {
    const bucket = storageBucket(plan.creditDef);
    const existing = loadout.stackAt(plan.creditDef, bucket);
    if (existing) {
      existing.quantity += plan.creditQuantity;
      await store.setItemQuantity(existing.soid, existing.quantity);
    } else {
      const seed: LoadoutSeed = {
        defIndex: plan.creditDef,
        bucket,
        equipSlot: null,
        instanced: false,
        quantity: plan.creditQuantity,
        artArrangement: 0,
        sandboxPattern: 0,
        power: 0,
      };
      const credited = await store.addItem(character.soid, seed);
      loadout.addItem(credited);
    }
  }

  return removedInstancedSoid;
}
