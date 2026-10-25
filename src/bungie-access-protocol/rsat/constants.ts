// The network ids of the server messages the build-neutral code routes on. A
// message has the same id in every build that has it; each build's own table
// (versions/<build>/server-message-ids.ts) is checked against these.
export enum e_server_message_network_id {
  _server_message_network_id_director_enter_orbit = 104,
  _server_message_network_id_director_complete_bink_activity = 105,
  _server_message_network_id_fetch_universe = 205,
  _server_message_network_id_fetch_family = 206,
  _server_message_network_id_inventory_destroy_item = 401,
  _server_message_network_id_inventory_perform_item_action = 402,
  _server_message_network_id_inventory_equip_item = 403,
  _server_message_network_id_inventory_unequip_item = 404,
  _server_message_network_id_login_create_character = 501,
  _server_message_network_id_login_delete_character = 502,
  _server_message_network_id_login_account = 503,
  _server_message_network_id_login_character = 504,
  _server_message_network_id_signout_character = 505,
  _server_message_network_id_loot_pickup_item = 601,
  _server_message_network_id_profile_set_account_profile = 701,
  _server_message_network_id_profile_set_character_profile = 702,
  _server_message_network_id_talent_grid_activate_step = 801,
  _server_message_network_id_talent_grid_binary_swap = 802,
  _server_message_network_id_vendor_buy_item = 901,
  _server_message_network_id_vendor_sell_item = 903,
  _server_message_network_id_activity_host_get_activity_host_startup_options = 1303,
}
