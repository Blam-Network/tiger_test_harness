import {
  buildInventoryResponseBody,
  e_server_message_network_id,
  parseInventoryItemSoid,
} from "../rsat";
import type { WorldServerHandler } from "./context";

const nid = e_server_message_network_id;

// inventory_equip_item / unequip_item / perform_item_action (402..404), and
// destroy_item (401) in a build that has it.
export const inventoryRequest: WorldServerHandler = async (
  ctx,
  message,
  networkId
) => {
  const soid = parseInventoryItemSoid(message.body, networkId);
  const loadout = ctx.character()?.loadout;
  let changed = false;
  let destroyed = false;
  let changedSoids: bigint[] = [];
  if (soid !== null && loadout) {
    const changes: { equipSlot: number | null; soid: bigint }[] = [];
    if (networkId === nid._server_message_network_id_inventory_destroy_item) {
      // The item leaves the bag for good; the client is told with a removal,
      // not a changed item.
      const item = loadout.item(soid);
      if (item) {
        loadout.unequip(soid);
        loadout.removeItem(soid);
        await ctx.store.removeItem(soid);
        destroyed = true;
      }
    } else if (
      networkId === nid._server_message_network_id_inventory_equip_item
    ) {
      const change = loadout.equip(soid);
      if (change) {
        changes.push(change.equipped);
        if (change.displaced) {
          changes.push(change.displaced);
        }
      }
    } else if (
      networkId === nid._server_message_network_id_inventory_unequip_item
    ) {
      const item = loadout.unequip(soid);
      if (item) {
        changes.push(item);
      }
    }
    if (changes.length > 0) {
      await ctx.store.setItemEquipSlots(changes);
      changed = true;
      changedSoids = changes.map((c) => c.soid);
    }
  }
  const ok = soid !== null && loadout !== undefined;
  ctx.reply(
    message,
    buildInventoryResponseBody(networkId, ok),
    `inventory nid ${networkId} ${ok ? "ok" : "FAILED"} ` +
      `soid=0x${(soid ?? 0n).toString(16)}${changed ? " loadout changed" : ""}`
  );
  if (changed) {
    ctx.pushLoadoutChange(changedSoids, `inventory nid ${networkId}`);
  }
  if (destroyed && soid !== null) {
    ctx.pushInventoryChange([], [soid], `inventory nid ${networkId}`);
  }
};
