import {
  applyLootPickup,
  LOOT_STATUS_OK,
  LOOT_STATUS_UNKNOWN_NONCE,
  lootTableForCharacter,
} from "../../investment/loot";
import {
  buildLootPickupItemResponseBody,
  parseLootPickupItemRequest,
} from "../rsat";
import type { WorldServerHandler } from "./context";

export const lootPickupItem: WorldServerHandler = async (ctx, message) => {
  const req = parseLootPickupItemRequest(message.body);
  const character = ctx.character();
  const found =
    req && character
      ? lootTableForCharacter(character.soid).findByNonce(req.state, req.nonce)
      : undefined;
  if (!(req && character && found)) {
    // Unknown nonce: logged only, the bauble stays dead client-side
    // until a future family update touches its record.
    ctx.reply(
      message,
      buildLootPickupItemResponseBody(
        LOOT_STATUS_UNKNOWN_NONCE,
        req?.nonce ?? { incidentNumber: 0, submitterSoid: 0n, ordinal: 0 }
      ),
      `loot_pickup_item FAILED unknown nonce state=${req?.state ?? -1}`
    );
    return;
  }
  const item = await applyLootPickup(ctx.store, character, found.slot.itemDef);
  lootTableForCharacter(character.soid).collect(found.index);
  ctx.reply(
    message,
    buildLootPickupItemResponseBody(LOOT_STATUS_OK, req.nonce),
    `loot_pickup_item ok itemDef=${found.slot.itemDef} slot=${found.index} ` +
      `soid=0x${item.soid.toString(16)}`
  );
  ctx.pushInventoryChange([item.soid], [], "loot_pickup_item");
};
