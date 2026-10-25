import { e_server_message_network_id as nid } from "../../rsat/constants";
import type { WorldServerRoute } from "../../world-server/context";
import { directorEnterOrbit } from "../../world-server/director";
import { fetchFamily } from "../../world-server/fetch";
import { inventoryRequest } from "../../world-server/inventory";
import {
  loginAccount,
  loginCharacter,
  loginCreateCharacter,
  loginDeleteCharacter,
  signoutCharacter,
} from "../../world-server/login";
import { lootPickupItem } from "../../world-server/loot";
import {
  profileSetAccountProfile,
  profileSetCharacterProfile,
} from "../../world-server/profile";
import { talentGridRequest } from "../../world-server/talent-grid";
import { vendorBuyItem, vendorSellItem } from "../../world-server/vendor";
import { directorCompleteBinkActivity, fetchUniverse } from "./world-server";

// The world-server requests this build's client sends and the server handles,
// built when the build loads (the handlers import this build's accessors).
export function betathRoutes(): ReadonlyMap<number, WorldServerRoute> {
  return new Map<number, WorldServerRoute>([
    [nid._server_message_network_id_login_account, { handler: loginAccount }],
    [
      nid._server_message_network_id_login_create_character,
      { handler: loginCreateCharacter },
    ],
    [
      nid._server_message_network_id_login_character,
      { handler: loginCharacter },
    ],
    [
      nid._server_message_network_id_login_delete_character,
      { handler: loginDeleteCharacter },
    ],
    [
      nid._server_message_network_id_inventory_perform_item_action,
      { handler: inventoryRequest },
    ],
    [
      nid._server_message_network_id_inventory_equip_item,
      { handler: inventoryRequest },
    ],
    [
      nid._server_message_network_id_inventory_unequip_item,
      { handler: inventoryRequest },
    ],
    [
      nid._server_message_network_id_vendor_buy_item,
      { handler: vendorBuyItem },
    ],
    [
      nid._server_message_network_id_vendor_sell_item,
      { handler: vendorSellItem },
    ],
    [
      nid._server_message_network_id_loot_pickup_item,
      { handler: lootPickupItem },
    ],
    [
      nid._server_message_network_id_signout_character,
      { handler: signoutCharacter },
    ],
    [
      nid._server_message_network_id_fetch_family,
      { absorb: "fetch_family rsp", handler: fetchFamily },
    ],
    [
      nid._server_message_network_id_director_enter_orbit,
      { absorb: "director_enter_orbit ack", handler: directorEnterOrbit },
    ],
    [
      nid._server_message_network_id_profile_set_account_profile,
      {
        absorb: "profile_set_account_profile ack",
        handler: profileSetAccountProfile,
      },
    ],
    [
      nid._server_message_network_id_profile_set_character_profile,
      {
        absorb: "profile_set_character_profile ack",
        handler: profileSetCharacterProfile,
      },
    ],
    [
      nid._server_message_network_id_talent_grid_activate_step,
      { handler: talentGridRequest },
    ],
    [
      nid._server_message_network_id_talent_grid_binary_swap,
      { handler: talentGridRequest },
    ],
    [nid._server_message_network_id_fetch_universe, { handler: fetchUniverse }],
    [
      nid._server_message_network_id_director_complete_bink_activity,
      { handler: directorCompleteBinkActivity },
    ],
  ]);
}
