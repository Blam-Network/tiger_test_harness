import {
  applyPurchase,
  applySale,
  planPurchase,
  planSale,
  VENDOR_STATUS_INVALID_ARGUMENTS,
  VENDOR_STATUS_OK,
} from "../../investment/vendor";
import {
  buildVendorBuyItemResponseBody,
  buildVendorSellItemResponseBody,
  parseVendorBuyItemRequest,
  parseVendorSellItemRequest,
} from "../rsat";
import type { WorldServerHandler } from "./context";

export const vendorBuyItem: WorldServerHandler = async (ctx, message) => {
  const req = parseVendorBuyItemRequest(message.body);
  const character = ctx.character();
  const loadout = character?.loadout;
  const plan =
    req && loadout
      ? planPurchase(loadout, req.vendorIndex, req.purchaseIndex)
      : { status: VENDOR_STATUS_INVALID_ARGUMENTS };
  let newItemSoid: bigint | null = null;
  if (plan.status === VENDOR_STATUS_OK && character) {
    newItemSoid = await applyPurchase(ctx.store, character, plan);
  }
  ctx.reply(
    message,
    buildVendorBuyItemResponseBody(plan.status),
    `vendor_buy_item vendor=${req?.vendorIndex ?? -1} ` +
      `purchase=${req?.purchaseIndex ?? -1} status=${plan.status}`
  );
  if (plan.status === VENDOR_STATUS_OK) {
    ctx.pushInventoryChange(
      newItemSoid ? [newItemSoid] : [],
      [],
      "vendor_buy_item"
    );
  }
};

export const vendorSellItem: WorldServerHandler = async (ctx, message) => {
  const req = parseVendorSellItemRequest(message.body);
  const character = ctx.character();
  const loadout = character?.loadout;
  const plan =
    req && loadout
      ? planSale(loadout, req.vendorIndex, req, req.quantity)
      : { status: VENDOR_STATUS_INVALID_ARGUMENTS };
  let removedItemSoid: bigint | null = null;
  if (plan.status === VENDOR_STATUS_OK && character) {
    removedItemSoid = await applySale(ctx.store, character, plan);
  }
  ctx.reply(
    message,
    buildVendorSellItemResponseBody(plan.status),
    `vendor_sell_item vendor=${req?.vendorIndex ?? -1} ` +
      `soid=0x${(req?.itemSoid ?? 0n).toString(16)} status=${plan.status}`
  );
  if (plan.status === VENDOR_STATUS_OK) {
    ctx.pushInventoryChange(
      [],
      removedItemSoid ? [removedItemSoid] : [],
      "vendor_sell_item"
    );
  }
};
