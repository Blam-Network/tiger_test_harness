# Script (hs) functions with execute bodies, 38464.14.02.28.1027.betath

Source: the hs function table in the eboot, 913 entries of 0x50 bytes from 0x2ADCA50 (name at +0x00, parse function at +0x10, evaluate at +0x18, parameter count and types at +0x30, return type at +0x48). Pointers come from the ELF's relative relocations (the IDB has none). Each evaluate was read in IDA (headless, eboot-ida.elf).

How a body is judged:
- **implemented**: the evaluate calls code outside the hs framework (parameter fetch sub_DAF930, return sub_DA8D20, thread/script lookups, string id lookup sub_D8C1D0, logging and assert helpers).
- **special form**: its own parse function (not sub_D8FBE0) or no evaluate; the evaluator handles it (begin, if, set, sleep, wake, arithmetic, ...).
- **empty implementation**: calls out, but every callee is a one- or two-instruction function (ret, or return a constant).
- **stub**: only fetches its parameters and returns (590 of them are the 3-instruction `mov edi, esi; xor esi, esi; jmp sub_DA8D20`).

Totals: 225 implemented, 28 special forms, 59 empty implementations, 601 stubs.

The signature column is the Xbox 36735 alpha's (web-tiger docs/hs-functions-available.txt) where the name matches; betath's own parameter types are not decoded here.

## Implemented (225)

| Function | Params | Evaluate | Xbox alpha signature |
|---|---|---|---|
| `activity_client_request_zombie_ah` | 1 | `0xd91de0` | `(<void> activity_client_request_zombie_ah <boolean>)` |
| `activity_client_set_replay_capture_size_for_fah_startup` | 1 | `0xd91ac0` | `(<void> activity_client_set_replay_capture_size_for_fah_startup <string>)` |
| `activity_client_set_replay_capture_size_for_gah_startup` | 1 | `0xd91a80` | `(<void> activity_client_set_replay_capture_size_for_gah_startup <string>)` |
| `activity_client_set_replay_filename_for_fah_startup` | 1 | `0xd91b40` | `(<void> activity_client_set_replay_filename_for_fah_startup <string>)` |
| `activity_client_set_replay_filename_for_gah_startup` | 1 | `0xd91b00` | `(<void> activity_client_set_replay_filename_for_gah_startup <string>)` |
| `activity_client_use_oopah` | 1 | `0xd91e20` | `(<void> activity_client_use_oopah <boolean>)` |
| `activity_fireteam_host_set_advertised_port` | 1 | `0xd91ea0` | `(<void> activity_fireteam_host_set_advertised_port <int32>)` |
| `activity_group_host_set_advertised_port` | 1 | `0xd91e60` | `(<void> activity_group_host_set_advertised_port <int32>)` |
| `activity_host_enable_zombie` | 1 | `0xd91da0` | `(<void> activity_host_enable_zombie <boolean>)` |
| `activity_host_enforce_client_restrictions` | 1 | `0xd91d60` | `(<void> activity_host_enforce_client_restrictions <boolean>)` |
| `activity_host_set_ambassador_revocation_ack_timeout` | 1 | `0xd91c60` | `(<void> activity_host_set_ambassador_revocation_ack_timeout <int32>)` |
| `activity_host_set_client_inactivity_timeout` | 1 | `0xd91ce0` | `(<void> activity_host_set_client_inactivity_timeout <int32>)` |
| `activity_host_set_inactivity_timeout` | 1 | `0xd91d20` | `(<void> activity_host_set_inactivity_timeout <int32>)` |
| `activity_host_set_session_lock_timeout` | 1 | `0xd91ca0` | `(<void> activity_host_set_session_lock_timeout <int32>)` |
| `activity_host_set_session_migration_timeout` | 1 | `0xd91c20` | `(<void> activity_host_set_session_migration_timeout <int32>)` |
| `activity_host_set_suspiciously_inactive_timeout` | 1 | `0xd91be0` | `(<void> activity_host_set_suspiciously_inactive_timeout <int32>)` |
| `add_startup_globals` | 1 | `0xd9d920` | `(<void> add_startup_globals <string>)` |
| `any_local_player_has_spawned_in_game` | 0 | `0xda6810` | `(<boolean> any_local_player_has_spawned_in_game)` |
| `assert_ignore` | 2 | `0xd98d60` | `(<void> assert_ignore <string> <int32>)` |
| `attract_mode_set_seconds` | 1 | `0xd9d790` |  |
| `bink_time` | 0 | `0xd99aa0` | `(<int32> bink_time)` |
| `breakpoint` | 1 | `0xda7300` |  |
| `bs_prototype_mode_is_enabled` | 1 | `0xd95b80` | `(<boolean> bs_prototype_mode_is_enabled <int32>)` |
| `bs_prototype_mode_set` | 2 | `0xd95b40` | `(<void> bs_prototype_mode_set <int32> <boolean>)` |
| `content_build_string` | 1 | `0xd92980` | `(<void> content_build_string <string>)` |
| `core_load_name` | 1 | `0xd9c9f0` | `(<void> core_load_name <string>)` |
| `core_save` | 0 | `0xd9c6d0` | `(<void> core_save)` |
| `core_save_name` | 1 | `0xd9c690` | `(<void> core_save_name <string>)` |
| `crash` | 1 | `0xd9dd30` | `(<void> crash <string>)` |
| `crash_report_clean_on_upload` | 0 | `0xd98a30` | `(<void> crash_report_clean_on_upload)` |
| `crash_report_enable` | 1 | `0xd99190` | `(<void> crash_report_enable <boolean>)` |
| `datamine_enable` | 1 | `0xd99740` | `(<void> datamine_enable <boolean>)` |
| `datamine_flush` | 0 | `0xd993e0` | `(<void> datamine_flush)` |
| `datamine_set_header_content_type` | 1 | `0xd99360` |  |
| `datamine_set_header_flag` | 1 | `0xd993a0` |  |
| `datamine_upload` | 0 | `0xd99780` | `(<void> datamine_upload)` |
| `datamine_upload_enable` | 1 | `0xd99700` | `(<void> datamine_upload_enable <boolean>)` |
| `debug_scripting` | 1 | `0xda7410` | `(<void> debug_scripting <boolean>)` |
| `debug_scripting_globals` | 1 | `0xda73d0` | `(<void> debug_scripting_globals <boolean>)` |
| `debug_scripting_variable_all` | 1 | `0xda7340` | `(<void> debug_scripting_variable_all <boolean>)` |
| `designer_mode` | 1 | `0xd95ef0` | `(<void> designer_mode <boolean>)` |
| `designer_mode_is_active` | 0 | `0xd95bc0` | `(<boolean> designer_mode_is_active)` |
| `determinism_allow_out_of_sync` | 1 | `0xd97a90` |  |
| `deterministic_end_game` | 0 | `0xd98550` | `(<void> deterministic_end_game)` |
| `disable_hi_mips` | 0 | `0xd905a0` | `(<void> disable_hi_mips)` |
| `dlc_set_enabled` | 1 | `0xd9cd80` | `(<void> dlc_set_enabled <int32>)` |
| `dump_native_schemas` | 0 | `0xd92950` |  |
| `enable_hi_mips` | 0 | `0xd908c0` | `(<void> enable_hi_mips)` |
| `events_category_custom_log` | 2 | `0xd9a230` | `(<void> events_category_custom_log <string> <event>)` |
| `events_category_datamine` | 2 | `0xd9a170` | `(<void> events_category_datamine <string> <event>)` |
| `events_category_debugger` | 2 | `0xd9a1f0` | `(<void> events_category_debugger <string> <event>)` |
| `events_category_debugger_break` | 2 | `0xd9a1b0` | `(<void> events_category_debugger_break <string> <event>)` |
| `events_category_display` | 2 | `0xd9a2f0` | `(<void> events_category_display <string> <event>)` |
| `events_category_force_display` | 2 | `0xd9a2b0` | `(<void> events_category_force_display <string> <event>)` |
| `events_category_log` | 2 | `0xd9a270` | `(<void> events_category_log <string> <event>)` |
| `events_enabled` | 1 | `0xd9ab30` | `(<void> events_enabled <boolean>)` |
| `events_flush` | 0 | `0xd9a430` | `(<void> events_flush)` |
| `events_global_datamine` | 1 | `0xd9a330` | `(<void> events_global_datamine <event>)` |
| `events_global_debugger` | 1 | `0xd9a370` | `(<void> events_global_debugger <event>)` |
| `events_global_display` | 1 | `0xd9a3f0` | `(<void> events_global_display <event>)` |
| `events_global_log` | 1 | `0xd9a3b0` | `(<void> events_global_log <event>)` |
| `events_list_categories` | 1 | `0xd9aa70` | `(<void> events_list_categories <string>)` |
| `events_logs_snapshot` | 0 | `0xd9a750` | `(<void> events_logs_snapshot)` |
| `events_suppress_display` | 1 | `0xd9aaf0` | `(<void> events_suppress_display <boolean>)` |
| `events_suppress_timestamps` | 1 | `0xd9aab0` |  |
| `exit_game` | 0 | `0xd95770` | `(<void> exit_game)` |
| `exit_game_after_n_frames` | 1 | `0xd95730` | `(<void> exit_game_after_n_frames <int32>)` |
| `game_award_level_complete_achievements` | 0 | `0xd9d110` |  |
| `game_difficulty_get` | 0 | `0xda5bf0` | `(<game_difficulty> game_difficulty_get)` |
| `game_difficulty_get_real` | 0 | `0xda58d0` | `(<game_difficulty> game_difficulty_get_real)` |
| `game_is_cooperative` | 0 | `0xd9cde0` | `(<boolean> game_is_cooperative)` |
| `game_lost` | 1 | `0xd9d430` | `(<void> game_lost <boolean>)` |
| `game_rate` | 3 | `0xd9d7f0` | `(<void> game_rate <real> <real> <real>)` |
| `game_tick_get` | 0 | `0xd97220` | `(<int32> game_tick_get)` |
| `game_won` | 0 | `0xd9d470` | `(<void> game_won)` |
| `get_executing_running_thread` | 0 | `0xda6cc0` | `(<int32> get_executing_running_thread)` |
| `hard_wipe` | 0 | `0xd91150` |  |
| `hide_loot` | 1 | `0xd92350` | `(<void> hide_loot <boolean>)` |
| `in_debugger` | 0 | `0xd92620` | `(<boolean> in_debugger)` |
| `input_suppress_rumble` | 1 | `0xd9b5a0` | `(<void> input_suppress_rumble <boolean>)` |
| `kill_active_scripts` | 0 | `0xda6fe0` | `(<void> kill_active_scripts)` |
| `kill_thread` | 1 | `0xda6c80` | `(<void> kill_thread <int32>)` |
| `lod_gear_set` | 3 | `0xd91570` | `(<void> lod_gear_set <string> <string> <real>)` |
| `log_print` | 1 | `0xda7460` | `(<void> log_print <string>)` |
| `loop_clear` | 0 | `0xd97200` |  |
| `mp_allegiance` | 2 | `0xd984d0` | `(<void> mp_allegiance <mp_team> <mp_team>)` |
| `mp_game_won` | 1 | `0xd98510` | `(<void> mp_game_won <mp_team>)` |
| `mp_round_end` | 0 | `0xd97e00` | `(<void> mp_round_end)` |
| `mp_round_end_with_winning_player` | 1 | `0xd98160` | `(<void> mp_round_end_with_winning_player <player>)` |
| `mp_round_end_with_winning_team` | 1 | `0xd98120` | `(<void> mp_round_end_with_winning_team <mp_team>)` |
| `mp_round_started` | 0 | `0xd981a0` | `(<boolean> mp_round_started)` |
| `mp_scripts_reset` | 0 | `0xd97ae0` | `(<void> mp_scripts_reset)` |
| `net_allow_out_of_sync` | 1 | `0xd97a50` |  |
| `net_log_channel_message_queue_state` | 2 | `0xd96190` | `(<void> net_log_channel_message_queue_state <int32> <boolean>)` |
| `net_set_datamine_server` | 4 | `0xd90100` | `(<void> net_set_datamine_server <string> <string> <int16> <http_security_type>)` |
| `net_set_signon_server_url` | 1 | `0xd92d10` | `(<void> net_set_signon_server_url <string>)` |
| `net_set_ticket_server` | 4 | `0xd90170` | `(<void> net_set_ticket_server <string> <string> <int16> <http_security_type>)` |
| `not` | 1 | `0xda7530` | `(<boolean> not <boolean>)` |
| `on_target_platform` | 0 | `0xd96ed0` | `(<boolean> on_target_platform)` |
| `output_lod_gear` | 0 | `0xd91250` | `(<void> output_lod_gear)` |
| `output_render_features_ids` | 0 | `0xd915d0` | `(<void> output_render_features_ids)` |
| `override_slice_set_is_public` | 3 | `0xd922a0` |  |
| `owc_activity_manifest_mapping_enable` | 1 | `0xd91f40` | `(<void> owc_activity_manifest_mapping_enable <boolean>)` |
| `owc_end_game` | 0 | `0xd91f80` | `(<void> owc_end_game)` |
| `owc_matchmaking_enable` | 1 | `0xd91f00` | `(<void> owc_matchmaking_enable <boolean>)` |
| `phase_transition` | 1 | `0xd94f70` | `(<void> phase_transition <string>)` |
| `pin` | 3 | `0xda74f0` | `(<real> pin <real> <real> <real>)` |
| `play_bink_movie_from_tag` | 1 | `0xd9a0e0` |  |
| `play_credits_skip_to_menu` | 0 | `0xd99dc0` |  |
| `player0_looking_down` | 0 | `0xd9ede0` | `(<boolean> player0_looking_down)` |
| `player0_looking_up` | 0 | `0xd9f110` | `(<boolean> player0_looking_up)` |
| `player_action_test_accept` | 0 | `0xda2820` | `(<boolean> player_action_test_accept)` |
| `player_action_test_action` | 0 | `0xda2b50` | `(<boolean> player_action_test_action)` |
| `player_action_test_back` | 0 | `0xda0840` | `(<boolean> player_action_test_back)` |
| `player_action_test_cancel` | 0 | `0xda24f0` | `(<boolean> player_action_test_cancel)` |
| `player_action_test_cinematic_skip` | 0 | `0xda0ea0` | `(<boolean> player_action_test_cinematic_skip)` |
| `player_action_test_context_primary` | 0 | `0xda3810` | `(<boolean> player_action_test_context_primary)` |
| `player_action_test_dpad_down` | 0 | `0xda01e0` | `(<boolean> player_action_test_dpad_down)` |
| `player_action_test_dpad_left` | 0 | `0xd9feb0` | `(<boolean> player_action_test_dpad_left)` |
| `player_action_test_dpad_right` | 0 | `0xd9fb80` | `(<boolean> player_action_test_dpad_right)` |
| `player_action_test_dpad_up` | 0 | `0xda0510` | `(<boolean> player_action_test_dpad_up)` |
| `player_action_test_grenade_trigger` | 0 | `0xda4800` | `(<boolean> player_action_test_grenade_trigger)` |
| `player_action_test_jump` | 0 | `0xda3b40` | `(<boolean> player_action_test_jump)` |
| `player_action_test_look_relative_all_directions` | 0 | `0xda1500` | `(<boolean> player_action_test_look_relative_all_directions)` |
| `player_action_test_look_relative_down` | 0 | `0xda1e90` | `(<boolean> player_action_test_look_relative_down)` |
| `player_action_test_look_relative_left` | 0 | `0xda1b60` | `(<boolean> player_action_test_look_relative_left)` |
| `player_action_test_look_relative_right` | 0 | `0xda1830` | `(<boolean> player_action_test_look_relative_right)` |
| `player_action_test_look_relative_up` | 0 | `0xda21c0` | `(<boolean> player_action_test_look_relative_up)` |
| `player_action_test_lookstick_backward` | 0 | `0xd9e740` | `(<boolean> player_action_test_lookstick_backward)` |
| `player_action_test_lookstick_forward` | 0 | `0xd9ea70` | `(<boolean> player_action_test_lookstick_forward)` |
| `player_action_test_melee` | 0 | `0xda2e80` | `(<boolean> player_action_test_melee)` |
| `player_action_test_move_relative_all_directions` | 0 | `0xda11d0` | `(<boolean> player_action_test_move_relative_all_directions)` |
| `player_action_test_primary_trigger` | 0 | `0xda4b30` | `(<boolean> player_action_test_primary_trigger)` |
| `player_action_test_reset` | 0 | `0xda4e60` | `(<void> player_action_test_reset)` |
| `player_action_test_rotate_grenades` | 0 | `0xda3e70` | `(<boolean> player_action_test_rotate_grenades)` |
| `player_action_test_rotate_weapons` | 0 | `0xda41a0` | `(<boolean> player_action_test_rotate_weapons)` |
| `player_action_test_start` | 0 | `0xda0b70` | `(<boolean> player_action_test_start)` |
| `player_action_test_vehicle_trick_primary` | 0 | `0xda34e0` | `(<boolean> player_action_test_vehicle_trick_primary)` |
| `player_action_test_vehicle_trick_secondary` | 0 | `0xda31b0` | `(<boolean> player_action_test_vehicle_trick_secondary)` |
| `player_action_test_vision_trigger` | 0 | `0xda44d0` | `(<boolean> player_action_test_vision_trigger)` |
| `player_active_camouflage_on` | 0 | `0xda51c0` | `(<boolean> player_active_camouflage_on)` |
| `player_camera_control` | 1 | `0xda5180` | `(<boolean> player_camera_control <boolean>)` |
| `player_control_fade_in_all_input` | 1 | `0xd96bc0` | `(<void> player_control_fade_in_all_input <real>)` |
| `player_control_fade_out_all_input` | 1 | `0xd96c00` | `(<void> player_control_fade_out_all_input <real>)` |
| `player_control_scale_all_input` | 2 | `0xd96b80` | `(<void> player_control_scale_all_input <real> <real>)` |
| `player_disable_movement` | 1 | `0xda5530` | `(<void> player_disable_movement <boolean>)` |
| `player_disable_weapon_pickup` | 1 | `0xda54f0` | `(<void> player_disable_weapon_pickup <boolean>)` |
| `player_enable_input` | 1 | `0xda5570` | `(<void> player_enable_input <boolean>)` |
| `player_has_spawned_in_game` | 1 | `0xda6b40` | `(<boolean> player_has_spawned_in_game <player>)` |
| `player_invert_look` | 1 | `0xd9b810` | `(<void> player_invert_look <player>)` |
| `player_is_in_game` | 1 | `0xda6b80` | `(<boolean> player_is_in_game <player>)` |
| `player_set_pitch` | 3 | `0xd9eda0` | `(<void> player_set_pitch <player> <real> <int32>)` |
| `players_unzoom_all` | 0 | `0xda55b0` | `(<void> players_unzoom_all)` |
| `postprocess_nan_replacement_color` | 3 | `0xd92ee0` |  |
| `quit` | 0 | `0xd9da10` |  |
| `rasterizer_bloom_override_max_factor_alpha` | 1 | `0xd98870` |  |
| `register_package` | 1 | `0xd9e020` | `(<void> register_package <string>)` |
| `register_package_set` | 1 | `0xd9dfd0` | `(<void> register_package_set <string>)` |
| `relax_bundle_memory_limits` | 0 | `0xd90e30` |  |
| `script_finished` | 1 | `0xda6c00` | `(<boolean> script_finished <string_id>)` |
| `script_started` | 1 | `0xda6c40` | `(<boolean> script_started <string_id>)` |
| `set_visibility_debug_path` | 1 | `0xda5f10` |  |
| `slice_set_transition` | 1 | `0xd94fb0` | `(<void> slice_set_transition <string>)` |
| `sobjects_prephysics_timeslice_print` | 0 | `0xd901e0` | `(<void> sobjects_prephysics_timeslice_print)` |
| `sobjects_prephysics_timeslice_set_interval_salience_threshold` | 2 | `0xd90500` | `(<void> sobjects_prephysics_timeslice_set_interval_salience_threshold <int32> <int32>)` |
| `sobjects_prephysics_timeslice_set_interval_update_quota` | 2 | `0xd90540` | `(<void> sobjects_prephysics_timeslice_set_interval_update_quota <int32> <int32>)` |
| `speedtree_lod_set` | 4 | `0xda6000` | `(<void> speedtree_lod_set <real> <real> <real> <real>)` |
| `status_lines_dump` | 0 | `0xd97540` |  |
| `tiger_autoexposure_set` | 1 | `0xd931a0` | `(<void> tiger_autoexposure_set <real>)` |
| `tiger_bloom_level16_color` | 3 | `0xd93060` | `(<void> tiger_bloom_level16_color <real> <real> <real>)` |
| `tiger_bloom_level16_kernel` | 5 | `0xd92f20` | `(<void> tiger_bloom_level16_kernel <real> <real> <real> <real> <real>)` |
| `tiger_bloom_level2_color` | 3 | `0xd93120` | `(<void> tiger_bloom_level2_color <real> <real> <real>)` |
| `tiger_bloom_level2_kernel` | 5 | `0xd93010` | `(<void> tiger_bloom_level2_kernel <real> <real> <real> <real> <real>)` |
| `tiger_bloom_level4_color` | 3 | `0xd930e0` | `(<void> tiger_bloom_level4_color <real> <real> <real>)` |
| `tiger_bloom_level4_kernel` | 5 | `0xd92fc0` | `(<void> tiger_bloom_level4_kernel <real> <real> <real> <real> <real>)` |
| `tiger_bloom_level8_color` | 3 | `0xd930a0` | `(<void> tiger_bloom_level8_color <real> <real> <real>)` |
| `tiger_bloom_level8_kernel` | 5 | `0xd92f70` | `(<void> tiger_bloom_level8_kernel <real> <real> <real> <real> <real>)` |
| `tiger_bloom_line_color` | 3 | `0xd93160` | `(<void> tiger_bloom_line_color <real> <real> <real>)` |
| `tiger_game_start_package_name` | 1 | `0xd95a90` |  |
| `tiger_increment_seconds_per_game_day` | 1 | `0xd93350` | `(<void> tiger_increment_seconds_per_game_day <real>)` |
| `tiger_lock_time_of_day` | 1 | `0xd93290` | `(<void> tiger_lock_time_of_day <boolean>)` |
| `tiger_multiply_seconds_per_game_day` | 1 | `0xd93310` | `(<void> tiger_multiply_seconds_per_game_day <real>)` |
| `tiger_particle_deselect` | 1 | `0xd92de0` | `(<void> tiger_particle_deselect <boolean>)` |
| `tiger_particle_next_closest` | 1 | `0xd92e60` | `(<void> tiger_particle_next_closest <boolean>)` |
| `tiger_particle_previous_closest` | 1 | `0xd92e20` | `(<void> tiger_particle_previous_closest <boolean>)` |
| `tiger_particle_select_closest` | 1 | `0xd92ea0` | `(<void> tiger_particle_select_closest <boolean>)` |
| `tiger_seconds_per_game_day` | 1 | `0xd932d0` | `(<void> tiger_seconds_per_game_day <real>)` |
| `toggle_render_feature` | 2 | `0xd918f0` | `(<void> toggle_render_feature <int32> <boolean>)` |
| `toggle_transparent_submit` | 1 | `0xd911d0` | `(<void> toggle_transparent_submit <boolean>)` |
| `unit_action_test_accept` | 1 | `0xd9f840` | `(<boolean> unit_action_test_accept <player>)` |
| `unit_action_test_action` | 1 | `0xd9f880` | `(<boolean> unit_action_test_action <player>)` |
| `unit_action_test_back` | 1 | `0xd9f5c0` | `(<boolean> unit_action_test_back <player>)` |
| `unit_action_test_cancel` | 1 | `0xd9f800` | `(<boolean> unit_action_test_cancel <player>)` |
| `unit_action_test_cinematic_skip` | 1 | `0xd9f640` | `(<boolean> unit_action_test_cinematic_skip <player>)` |
| `unit_action_test_context_primary` | 1 | `0xd9f980` | `(<boolean> unit_action_test_context_primary <player>)` |
| `unit_action_test_dpad_down` | 1 | `0xd9f540` | `(<boolean> unit_action_test_dpad_down <player>)` |
| `unit_action_test_dpad_left` | 1 | `0xd9f500` | `(<boolean> unit_action_test_dpad_left <player>)` |
| `unit_action_test_dpad_right` | 1 | `0xd9f4c0` | `(<boolean> unit_action_test_dpad_right <player>)` |
| `unit_action_test_dpad_up` | 1 | `0xd9f580` | `(<boolean> unit_action_test_dpad_up <player>)` |
| `unit_action_test_grenade_trigger` | 1 | `0xd9fac0` | `(<boolean> unit_action_test_grenade_trigger <player>)` |
| `unit_action_test_jump` | 1 | `0xd9f9c0` | `(<boolean> unit_action_test_jump <player>)` |
| `unit_action_test_look_relative_all_directions` | 1 | `0xd9f6c0` | `(<boolean> unit_action_test_look_relative_all_directions <player>)` |
| `unit_action_test_look_relative_down` | 1 | `0xd9f780` | `(<boolean> unit_action_test_look_relative_down <player>)` |
| `unit_action_test_look_relative_left` | 1 | `0xd9f740` | `(<boolean> unit_action_test_look_relative_left <player>)` |
| `unit_action_test_look_relative_right` | 1 | `0xd9f700` | `(<boolean> unit_action_test_look_relative_right <player>)` |
| `unit_action_test_look_relative_up` | 1 | `0xd9f7c0` | `(<boolean> unit_action_test_look_relative_up <player>)` |
| `unit_action_test_melee` | 1 | `0xd9f8c0` | `(<boolean> unit_action_test_melee <player>)` |
| `unit_action_test_move_relative_all_directions` | 1 | `0xd9f680` | `(<boolean> unit_action_test_move_relative_all_directions <player>)` |
| `unit_action_test_primary_trigger` | 1 | `0xd9fb00` | `(<boolean> unit_action_test_primary_trigger <player>)` |
| `unit_action_test_reset` | 1 | `0xd9fb40` | `(<void> unit_action_test_reset <player>)` |
| `unit_action_test_rotate_grenades` | 1 | `0xd9fa00` | `(<boolean> unit_action_test_rotate_grenades <player>)` |
| `unit_action_test_rotate_weapons` | 1 | `0xd9fa40` | `(<boolean> unit_action_test_rotate_weapons <player>)` |
| `unit_action_test_start` | 1 | `0xd9f600` | `(<boolean> unit_action_test_start <player>)` |
| `unit_action_test_vehicle_trick_primary` | 1 | `0xd9f940` | `(<boolean> unit_action_test_vehicle_trick_primary <player>)` |
| `unit_action_test_vehicle_trick_secondary` | 1 | `0xd9f900` | `(<boolean> unit_action_test_vehicle_trick_secondary <player>)` |
| `unit_action_test_vision_trigger` | 1 | `0xd9fa80` | `(<boolean> unit_action_test_vision_trigger <player>)` |
| `unit_confirm_cancel_message` | 1 | `0xd9f440` | `(<void> unit_confirm_cancel_message <player>)` |
| `unit_confirm_message` | 1 | `0xd9f480` | `(<void> unit_confirm_message <player>)` |
| `user_interface_controller_get_last_level_played` | 1 | `0xd9b7d0` | `(<int32> user_interface_controller_get_last_level_played <int16>)` |
| `world_controller_enable_crash_on_state_change_reason` | 2 | `0xd90be0` |  |
| `world_launch` | 1 | `0xd956f0` | `(<void> world_launch <string>)` |
| `world_launch_bubble` | 2 | `0xd95690` | `(<void> world_launch_bubble <string> <string>)` |
| `world_launch_phase` | 2 | `0xd95630` | `(<void> world_launch_phase <string> <string>)` |
| `world_reload` | 0 | `0xd95310` | `(<void> world_reload)` |
| `world_unload` | 0 | `0xd94ff0` | `(<void> world_unload)` |

## Special forms (28)

| Function | Params | Evaluate | Xbox alpha signature |
|---|---|---|---|
| `!=` | 0 | `0xdaa530` | `(<boolean> != <expression> <expression>)` |
| `%` | 0 | `0xdaa080` | `(<real> % <number> <number>)` |
| `*` | 0 | `0xdaa080` | `(<real> * <number(s)>)` |
| `+` | 0 | `0xdaa080` | `(<real> + <number(s)>)` |
| `-` | 0 | `0xdaa080` | `(<real> - <number> <number>)` |
| `/` | 0 | `0xdaa080` | `(<real> / <number> <number>)` |
| `<` | 0 | `0xdaaa10` | `(<boolean> < <number> <number>)` |
| `<=` | 0 | `0xdaaa10` | `(<boolean> <= <number> <number>)` |
| `=` | 0 | `0xdaa530` | `(<boolean> = <expression> <expression>)` |
| `>` | 0 | `0xdaaa10` | `(<boolean> > <number> <number>)` |
| `>=` | 0 | `0xdaaa10` | `(<boolean> >= <number> <number>)` |
| `and` | 0 | `0xda9eb0` | `(<boolean> and <boolean(s)>)` |
| `begin` | 0 | `0xda8440` | `(<passthrough> begin <expression(s)>)` |
| `begin_count` | 0 | `0xda8f70` | `(<passthrough> begin_count <expression(s)>)` |
| `begin_random` | 0 | `0xda92a0` | `(<passthrough> begin_random <expression(s)>)` |
| `begin_random_count` | 0 | `0xda8f70` | `(<passthrough> begin_random_count <expression(s)>)` |
| `branch` | 0 | `0xdac660` | `(<void> branch <condition> <script>)` |
| `cond` | 0 | `0x0` | `(<passthrough> cond (<boolean1> <result1>) [(<boolean2> <result2>) [...]])` |
| `if` | 0 | `0xda9580` | `(<passthrough> if <boolean> <then> [<else>])` |
| `inspect` | 0 | `0xdac280` | `(<void> inspect <expression>)` |
| `max` | 0 | `0xdaa080` | `(<real> max <number(s)>)` |
| `min` | 0 | `0xdaa080` | `(<real> min <number(s)>)` |
| `or` | 0 | `0xda9eb0` | `(<boolean> or <boolean(s)>)` |
| `set` | 0 | `0xda97c0` | `(<passthrough> set <variable name> <expression>)` |
| `sleep` | 0 | `0xdaae40` | `(<void> sleep <int16> [<script>])` |
| `sleep_forever` | 0 | `0xdaaca0` | `(<void> sleep_forever [<script>])` |
| `sleep_until` | 0 | `0xdab190` | `(<boolean> sleep_until <boolean> [<int16>])` |
| `wake` | 0 | `0xdab560` | `(<void> wake <script name>)` |

## Empty implementations (59)

`achievements_finish_test`, `activity_client_test_disconnection`, `activity_option_set_bool`, `activity_option_set_integer`, `activity_option_set_real`, `activity_option_set_string`, `animation_suspend_solve`, `animation_suspend_update`, `background_active`, `bubble_transition_test`, `cinematic_layer`, `core_load`, `debug_scripting_variable`, `director_cycle_debug_camera`, `dump_full_memory_in_bugs_enable`, `editor_mode`, `evaluate`, `force_debugger_always_present`, `game_coop_player_count`, `input_mouse_enabled`, `job_set_graph_output_directory`, `map_info`, `map_reset`, `net_sos_skip_user_actions`, `play_bink_movie`, `play_credits_unskippable`, `player_has_mad_secret_skills`, `player_has_skills`, `player_in_game_get`, `player_set_profile`, `player_set_profile`, `player_swap`, `predict_bink_movie`, `predict_bink_movie_from_tag`, `print`, `ragdoll_cheat`, `resourcerer_async_loading_enabled`, `set_user`, `stop_bink_movie`, `telemetry_disable_context_switch_profiling`, `telemetry_disable_lock_profiling`, `telemetry_disable_verbose_context_switch_profiling`, `telemetry_enable_context_switch_profiling`, `telemetry_enable_lock_profiling`, `telemetry_enable_team_zones`, `telemetry_enable_team_zones_by_name`, `telemetry_enable_verbose_context_switch_profiling`, `telemetry_end`, `telemetry_hdd`, `telemetry_ip`, `telemetry_level`, `telemetry_start`, `test_create_content_item_screenshot`, `test_set_runscript_id`, `tiger_set_cascade_shadow_map_sharpness_array`, `toggle_render_stage`, `workbench_add`, `workbench_add_silent`, `world_reset`

## Stubs (601)

`abort_matchmaking`, `achievements_run_full_test`, `achievements_run_quick_test`, `activity_incident_submit`, `activity_mode_set`, `activity_revoke_ambassadorship`, `activity_teleport`, `activity_to_launch_from_orbit`, `apply_quick_patch`, `async_set_thread_work_delay_milliseconds`, `async_test_hang`, `attract_mode_start`, `audio_test_post_event`, `audio_test_set_parameter`, `audio_test_set_state`, `audio_test_stop_all`, `bandwidth_profiler_enable`, `bandwidth_profiler_set_context`, `bug_now`, `bug_now_auto`, `bug_now_full`, `bug_now_lite`, `bug_now_ur`, `cheat_active_camouflage`, `cheat_active_camouflage_by_player`, `cheat_all_vehicles`, `cheat_all_weapons`, `cheat_teleport_to_camera`, `cheats_load`, `cinematic_reset_environment_map_bitmap`, `cinematic_reset_environment_map_tint`, `cinematic_screen_effect_set_crossfade`, `cinematic_screen_effect_set_crossfade2`, `cinematic_screen_effect_start`, `cinematic_screen_effect_stop`, `cinematic_set_environment_map_attenuation`, `cinematic_set_environment_map_tint`, `cinematic_set_far_clip_distance`, `cinematic_set_near_clip_distance`, `clear_all_global_channel_overrides`, `clear_global_channel_override`, `clear_script_crash`, `clear_script_crashes_all`, `cls`, `content_system_set_task_event_display_enabled`, `content_test_set_active`, `content_test_set_active_test_pass`, `controller_display_storage_device_selection`, `controller_invert_look`, `controller_look_speed`, `controller_set_auto_center_look`, `controller_set_button_preset`, `controller_set_clench_protection`, `controller_set_crouch_lock`, `controller_set_custom_button`, `controller_set_flight_stick_aircraft_controls`, `controller_set_joystick_preset`, `controller_set_look_inverted`, `controller_set_look_sensitivity`, `controller_set_southpaw`, `controller_set_unsignedin_user`, `controller_set_voice_output_setting`, `controller_temporary_users_always_attached`, `cpu_trace`, `cpu_trace_fiber_by_name`, `crash_dump_enable`, `crash_folder_set_maximum_count`, `crash_report_keyboard_timeout`, `create_secure_test_file`, `cui_debug_add_animation_watch`, `cui_debug_add_binding_watch`, `cui_debug_add_global_animation_watch`, `cui_debug_add_global_binding_watch`, `cui_debug_add_global_property_watch`, `cui_debug_add_property_watch`, `cui_debug_clear`, `cui_debug_clear_animation_watches`, `cui_debug_clear_binding_watches`, `cui_debug_clear_global`, `cui_debug_clear_global_animation_watches`, `cui_debug_clear_global_binding_watches`, `cui_debug_clear_global_property_watches`, `cui_debug_clear_property_watches`, `cui_debug_remove_animation_watch`, `cui_debug_remove_binding_watch`, `cui_debug_remove_global_animation_watch`, `cui_debug_remove_global_binding_watch`, `cui_debug_remove_global_property_watch`, `cui_debug_remove_property_watch`, `cui_debug_show_user_survey`, `cui_screen_manager_dump_memory`, `debug_button_action_mapping_set`, `debug_camera_load`, `debug_camera_load_name`, `debug_camera_load_simple_name`, `debug_camera_load_text`, `debug_camera_print_command`, `debug_camera_save`, `debug_camera_save_name`, `debug_camera_save_simple_name`, `debug_camera_save_simple_name_silent`, `debug_character_sheet_override_investment`, `debug_character_sheet_set_ability_mod`, `debug_character_sheet_set_ability_mod_count`, `debug_character_sheet_set_armor_perk`, `debug_character_sheet_set_build_perk`, `debug_character_sheet_set_class`, `debug_character_sheet_set_power_level`, `debug_character_sheet_set_preset_build`, `debug_character_sheet_set_weapon`, `debug_character_sheet_set_weapon_perk`, `debug_color0`, `debug_color1`, `debug_color2`, `debug_color3`, `debug_color4`, `debug_color5`, `debug_color6`, `debug_color7`, `debug_globals_set_path`, `debug_incident_submit`, `debug_lock_enforcement`, `debug_pause_game_toggle`, `debug_registry_set_enum`, `debug_registry_set_integer`, `debug_registry_set_integer64`, `debug_registry_set_real`, `debug_registry_set_toggle`, `debug_script_thread`, `debug_single_tag`, `debug_tags`, `decorators_split`, `determinism_debug_manager_dump_all_items`, `determinism_debug_manager_enable_game_state_checksum`, `determinism_debug_manager_enable_log_file_comparison_on_oos`, `determinism_debug_manager_enable_logging`, `determinism_debug_manager_enable_trace`, `determinism_debug_manager_set_consumer_sample_level`, `determinism_debug_manager_set_trace_flag`, `determinism_debug_manager_set_trace_flags`, `determinism_log_compare_log_files`, `director_debug_camera`, `director_print_camera_transform`, `director_print_deterministic_camera_transform`, `display_video_standard`, `drop`, `drop_batch`, `drop_dye`, `drop_gear`, `drop_gear_dye`, `drop_on`, `drop_on_variant`, `drop_variant`, `dummy_function`, `dump_all_memory_reports`, `dump_content_budgets`, `dump_content_by_schema`, `dump_content_memory`, `dump_content_state`, `dump_content_summary`, `dump_cortex_allocators`, `dump_cortex_budgets`, `dump_cortex_containers`, `dump_cortex_memory`, `dump_cortex_summary`, `dump_engine_allocators`, `dump_engine_budgets`, `dump_engine_containers`, `dump_engine_memory`, `dump_engine_summary`, `dump_hi_mips`, `dump_loaded_tags`, `dump_resourcerer_budgets`, `dump_resourcerer_by_schema`, `dump_resourcerer_memory`, `dump_resourcerer_state`, `dump_resourcerer_summary`, `dump_wwise_memory`, `e3_allow_deathless_toggle`, `e3_set_ability_orbs_disabled`, `e3_set_main_player`, `e3_set_player_identifier`, `e3_set_spawn_bubble`, `e3_set_spawn_transition`, `e3_set_special_spawn_effect`, `e3_set_special_spawn_time`, `e3_set_special_spawn_time_and_effect`, `ee_access_asserts_enabled`, `ee_access_checks_enabled`, `ee_asserts_enabled`, `ee_overlap_asserts_enabled`, `ee_overlap_filter`, `ee_overlap_filter_by_id`, `ee_overlap_verbose`, `enable_defrag_log`, `enable_limbo_mode`, `error_geometry_hide`, `error_geometry_hide_all`, `error_geometry_list`, `error_geometry_show`, `error_geometry_show_all`, `execute_on_activity_host`, `execute_on_fah`, `execute_on_gah`, `execute_on_target_gah`, `f10_profiler_on`, `f7_profiler_off`, `f7_profiler_on`, `f9_profiler_on`, `find`, `fireteam_leave_and_recall`, `fireteam_recall`, `fireteam_set_activity`, `fireteam_set_activity_by_index`, `floating_point_exceptions_enable`, `force_debugger_not_present`, `game_set_random_holiday`, `game_start_when_joined`, `game_state_report`, `game_time_step`, `gear_dye_display_mode`, `generate_rsa_2048_key_pair`, `get_report_folder_path`, `get_screenshot_memory_address`, `gui_load_screen`, `gui_reset`, `hdao_reset`, `hdao_set`, `help`, `hs_help`, `hs_make_interactive_scripts_deterministic`, `incidents_force_campaign`, `incidents_force_coop`, `incidents_force_custom_games`, `incidents_force_firefight`, `incidents_force_four_player_coop`, `incidents_force_matchmaking`, `incidents_force_multiplayer`, `incidents_force_solo`, `input_disable_claw_button_combos`, `input_remap_gamepad`, `input_require_focus`, `investment_activity_debug`, `investment_activity_print_list`, `investment_character_activate_talent_step`, `investment_character_add_progression`, `investment_character_clear_all_debug_stats`, `investment_character_clear_debug_stat`, `investment_character_clear_debug_weapon_stat`, `investment_character_clear_progression_limits`, `investment_character_debug_difficulty_delta`, `investment_character_equip_item`, `investment_character_set_debug_always_drop_loot`, `investment_character_set_debug_mock_shots_per_input`, `investment_character_set_debug_stat`, `investment_character_set_debug_weapon_stat`, `investment_character_set_progression`, `investment_character_swap_talent_node`, `investment_load_all_item_definitions`, `investment_server_failure_rate`, `investment_server_latency`, `jitter_gpu_memory`, `jitter_physics_memory`, `jitter_tag_memory`, `ktl_now`, `kto_now`, `language_set`, `loop_it`, `main_enable_block_detection`, `main_enable_block_detection_no_halt`, `main_enable_block_detection_with_assert`, `main_halt`, `map_reset_random`, `map_reset_to_current_phase_always`, `matchmaking_override_latency`, `meter_stick_clear`, `meter_stick_create`, `meter_stick_set_height`, `meter_stick_set_width`, `movie`, `net_allow_content_build_mismatch`, `net_banhammer_dump_repeated_play_list`, `net_banhammer_dump_strings`, `net_banhammer_set_controller_ban_flags`, `net_banhammer_set_controller_cheat_flags`, `net_banhammer_set_locality_override`, `net_bap_force_disable_xetrov`, `net_bap_set_ah_to_client_debug_latency`, `net_bap_set_client_to_ah_debug_latency`, `net_bap_set_debug_latency`, `net_bap_set_ip_address`, `net_bap_set_port`, `net_bap_set_unencrypted`, `net_bap_test_disconnection`, `net_build_network_config`, `net_disconnect`, `net_disconnect_and_reconnect_all_channels`, `net_dump_network_statistics`, `net_dump_online_session`, `net_enable_block_detection`, `net_enable_e3`, `net_fail_join_at_state`, `net_force_host`, `net_force_host_group`, `net_force_host_posse`, `net_force_host_squad`, `net_get_game_id`, `net_host`, `net_invite`, `net_join`, `net_join_direct`, `net_join_direct_get_key`, `net_join_fireteam`, `net_join_fireteam_to_friend`, `net_join_fireteam_to_local_posse`, `net_join_friend`, `net_join_platform_account_id`, `net_join_with_ui`, `net_leaderboard_fake_result`, `net_leaderboard_refresh`, `net_load_machine_file`, `net_lsp_disable_server`, `net_lsp_disable_service`, `net_lsp_dump_services_and_servers`, `net_lsp_force_server`, `net_lsp_set_service_sg_domain_override`, `net_lsp_set_sg_domain_override`, `net_quality_clear`, `net_quality_dump`, `net_quality_set_connection_badness_history`, `net_quality_set_group_bridging_badness_history`, `net_quality_set_group_client_badness_history`, `net_quality_set_group_host_badness_history`, `net_quality_set_group_speculative_migration_badness_history`, `net_quality_set_squad_bridging_badness_history`, `net_quality_set_squad_client_badness_history`, `net_quality_set_squad_host_badness_history`, `net_quality_set_squad_speculative_migration_badness_history`, `net_reauth`, `net_session_dump_qos_stats`, `net_session_test_abort_join`, `net_session_test_accept_join`, `net_session_test_clear_all_session_parameters`, `net_session_test_clear_pending_operations`, `net_session_test_clear_session_parameters`, `net_session_test_create`, `net_session_test_create_with_ambassador_reservation`, `net_session_test_define_loop`, `net_session_test_enable_outgoing_fireteam_joins`, `net_session_test_exit_game`, `net_session_test_force_disconnect_session`, `net_session_test_host_abandon_hosting`, `net_session_test_host_assume_leadership`, `net_session_test_host_boot_peer`, `net_session_test_host_delegate_hosting`, `net_session_test_join_fireteam`, `net_session_test_join_fireteam_local_only`, `net_session_test_join_group_as_ambassador`, `net_session_test_join_group_as_citizen`, `net_session_test_join_local_fireteam_to_local_posse`, `net_session_test_join_posse_to_remote_posse`, `net_session_test_leader_delegate_leadership`, `net_session_test_leader_request_boot_peer`, `net_session_test_leave_and_reestablish_session`, `net_session_test_leave_session`, `net_session_test_list_pending_operations`, `net_session_test_set_fireteam_user_join_controls`, `net_session_test_slice_set_transition`, `net_session_test_swap_with_target`, `net_session_test_wait`, `net_session_test_wait_until_button_pressed`, `net_session_test_wait_until_established`, `net_session_test_wait_until_host`, `net_session_test_wait_until_peer_state`, `net_session_test_wait_until_peers_established`, `net_session_test_wait_until_session_state`, `net_session_test_wait_until_wc_state`, `net_simulation_set_stream_bandwidth`, `net_status_filter`, `net_test_channel_delete`, `net_test_clear_group_session_parameter`, `net_test_clear_squad_session_parameter`, `net_test_delegate_host`, `net_test_delegate_leader`, `net_test_disconnect_group`, `net_test_disconnect_squad`, `net_test_fatal_error`, `net_test_ping`, `net_test_reset_objects`, `network_invitation_invite_other`, `network_invitation_invite_self`, `network_log_dynamic_flags`, `network_log_heap`, `network_session_security_disable_challenges`, `network_session_security_set_challenge_failure_on_timeout`, `network_session_security_set_challenge_force_fail`, `network_session_security_set_challenge_response`, `network_team_picker_unit_test`, `network_time_get`, `output_window_add_category`, `output_window_list_categories`, `output_window_remove_category`, `overlapped_display_task_descriptions`, `overlapped_task_inject_error`, `overlapped_task_pause`, `owc_matchmaking_pool`, `phase_advance`, `phase_change`, `phase_change_initial_bubble`, `phase_change_name`, `physics_debugger_begin_capture`, `physics_debugger_end_capture`, `player_force_mode`, `player_profile_clear_to_default_values`, `player_set_stance`, `player_ur`, `precache_package_name`, `randomize_hi_mip_requests`, `rasterizer_bloom_override`, `rasterizer_bloom_override_blur_amount`, `rasterizer_bloom_override_box_factor`, `rasterizer_bloom_override_brightness`, `rasterizer_bloom_override_brightness_alpha`, `rasterizer_bloom_override_high_res`, `rasterizer_bloom_override_max_factor`, `rasterizer_bloom_override_only`, `rasterizer_bloom_override_reset`, `rasterizer_bloom_override_silver_bullet`, `rasterizer_bloom_override_threshold`, `register_package_guid`, `register_package_use_debug_packages`, `register_package_use_hashing_and_signing`, `register_package_use_pcv1`, `register_patch`, `reload_shaders`, `reset_dsp_image`, `resourcerer_pause`, `resourcerer_start`, `run_like_dvd`, `run_no_hdd`, `saved_film_disable_version_checking`, `saved_film_insert_marker`, `saved_film_play`, `saved_film_play_last`, `saved_film_record`, `saved_film_seek_to_film_tick`, `saved_film_seek_to_film_timestamp`, `saved_film_seek_to_marker`, `saved_film_set_playback_game_speed`, `saved_film_set_repro_mode`, `saved_film_toggle_debug_saving`, `saved_films_show_timestamp`, `saved_games_delete_campaign_save`, `screenshot`, `script_doc`, `script_recompile`, `script_screen_effect_set_value`, `security_run_unit_tests`, `select_brightness_level`, `set_crash_folder`, `set_csm_resolution_v2`, `set_csm_uniform_log_blend`, `set_eqaa_depth_edge_threshold`, `set_eqaa_display_edges_for_sample`, `set_eqaa_gbuffer_edge_threshold`, `set_eqaa_normal_edge_threshold`, `set_evsm_negative_exponent`, `set_evsm_positive_exponent`, `set_global_channel_override`, `set_hi_mip_memory_limit`, `set_hires_fame_wait`, `set_pc_runtime_language`, `set_reports_directory`, `set_sdsm_max_blur_light_space`, `set_sdsm_softening_amount`, `settings_startup_check_disable`, `simulation_end`, `simulation_priority_display_set_color_by_final_priority`, `simulation_priority_display_set_color_by_relevance`, `simulation_priority_display_set_color_by_update_period`, `simulation_priority_display_set_enabled`, `simulation_priority_display_set_machine_filter`, `simulation_priority_display_set_object_names`, `simulation_priority_display_set_priority_scope_second_best`, `simulation_priority_display_set_priority_scope_second_worst`, `simulation_priority_display_set_priority_scope_tick`, `simulation_profiler_detail_level`, `sobject_crash`, `sobject_delete_selected`, `sobject_describe`, `sobject_select`, `sobject_select_tag_name`, `sobject_sub_select`, `ssao_blend`, `ssao_type`, `status`, `stream_manager_load_core`, `stream_manager_save_cores`, `submit_announcement`, `submit_incident`, `suicide`, `tag_file_set_backend`, `tag_group_shim_dump_function_counts`, `tag_group_shim_reset_function_counts`, `tag_load_force`, `tag_reload_force`, `tag_unload_force`, `tags_verify_all`, `take_screenshot_now`, `take_screenshot_now_uncompressed`, `team_picker_unit_test_add_player_with_ft_and_skill`, `team_picker_unit_test_add_players_with_count_ft_and_skill`, `team_picker_unit_test_clear_players`, `team_picker_unit_test_pick`, `team_picker_unit_test_pick_no_splitting_with_team_count_size_and_imbalance`, `team_picker_unit_test_pick_splitting_with_team_count_size_and_imbalance`, `team_picker_unit_test_set_maximum_imbalance`, `team_picker_unit_test_set_splitting_allowed`, `team_picker_unit_test_set_team_count`, `team_picker_unit_test_set_team_size_fixed`, `team_picker_unit_test_set_team_size_min_and_max`, `terminal_suppress_output`, `test_fragment_utility_drive`, `test_get_platform_account_id`, `test_get_squad_session_id`, `test_invite_friend`, `test_memory_allocators`, `test_memory_allocators`, `test_sapien_crash`, `test_show_are_users_friends`, `test_show_guide_status`, `test_show_users_xuids`, `test_xcr_monkey_enable`, `ticket_upload_enable`, `tiger_increment_time_of_day`, `tiger_set_time_of_day`, `toggle_tag_memory_jitter_stress`, `town_presence_activate`, `town_presence_deactivate`, `town_presence_default`, `ui_clear_fade`, `ui_debug_load_main_menu`, `ui_debug_show_title_safe_bounds`, `ui_fade_to_black`, `ui_hud_globals_debug_enable`, `ui_jump`, `ui_load_globals`, `ui_load_screen`, `ui_notify_bubble_transition`, `ui_notify_game_state_announcement`, `ui_notify_game_text_message`, `ui_notify_game_text_message_channel`, `ui_notify_game_text_message_with_metadata`, `ui_notify_game_type_announcement`, `ui_notify_hud_global_flag`, `ui_notify_medal_gain`, `ui_notify_sandbox_player_dealt_damage`, `ui_notify_xp_gain`, `ui_post_alert`, `ui_post_toast`, `ui_reset`, `ui_start`, `ui_stop`, `ui_time_scale_step`, `version`, `virtual_monkey_start_default`, `virtual_monkey_stop`, `voice_enable_update`, `voice_set_force_hud`, `voice_set_force_match_configurations`, `voice_set_mute`, `voice_set_outgoing_channel_count`, `watermark_text`, `webstats_disable`, `webstats_log_uploads`, `webstats_test_submit`, `webstats_throttle_bandwidth`, `world_controller_automation_activity_to_launch_from_orbit`, `world_controller_automation_character_creation_class`, `world_controller_automation_character_creation_gender`, `world_controller_automation_character_creation_race`, `world_controller_automation_create_character`, `world_controller_automation_delete_all_characters`, `world_controller_automation_delete_character_index`, `world_controller_automation_emit_character_descriptions`, `world_controller_automation_emit_playable_activities`, `world_controller_automation_emit_profile_name`, `world_controller_automation_emit_profile_names_in_session`, `world_controller_automation_emit_state_name`, `world_controller_automation_end_activity`, `world_controller_automation_leave_orbit_when_ready_user_count`, `world_controller_automation_set_controller_not_required`, `world_controller_automation_set_signin_age_restriction_enabled`, `world_controller_automation_signin_character_index`, `world_controller_display_state_change_reasons`, `world_controller_signin_character_index`, `world_controller_use_type`, `world_reset_random`, `xoverlapped_debug_render`, `xsync_pony_map`, `xsync_pony_tag`

## Compared with the Xbox 36735 alpha (web-tiger docs/hs-functions.txt)

57 names are new in betath and 45 of the alpha's are gone.

New (kind in this build):

- `content_system_set_task_event_display_enabled` (stub)
- `datamine_set_header_content_type` (implemented)
- `debug_character_sheet_set_ability_mod` (stub)
- `debug_character_sheet_set_ability_mod_count` (stub)
- `debug_character_sheet_set_armor_perk` (stub)
- `debug_character_sheet_set_build_perk` (stub)
- `debug_character_sheet_set_weapon_perk` (stub)
- `debug_incident_submit` (stub)
- `determinism_allow_out_of_sync` (implemented)
- `determinism_debug_manager_set_trace_flag` (stub)
- `ee_access_asserts_enabled` (stub)
- `ee_access_checks_enabled` (stub)
- `ee_overlap_asserts_enabled` (stub)
- `enable_defrag_log` (stub)
- `enable_limbo_mode` (stub)
- `events_suppress_timestamps` (implemented)
- `execute_on_target_gah` (stub)
- `get_screenshot_memory_address` (stub)
- `main_enable_block_detection_no_halt` (stub)
- `main_enable_block_detection_with_assert` (stub)
- `map_reset_to_current_phase_always` (stub)
- `matchmaking_override_latency` (stub)
- `net_allow_out_of_sync` (implemented)
- `net_dump_online_session` (stub)
- `net_session_dump_qos_stats` (stub)
- `network_invitation_invite_other` (stub)
- `network_invitation_invite_self` (stub)
- `phase_change_initial_bubble` (stub)
- `physics_debugger_begin_capture` (stub)
- `physics_debugger_end_capture` (stub)
- `postprocess_nan_replacement_color` (implemented)
- `quit` (implemented)
- `register_package_guid` (stub)
- `relax_bundle_memory_limits` (implemented)
- `set_user` (empty-impl)
- `sobject_select_tag_name` (stub)
- `status_lines_dump` (implemented)
- `team_picker_unit_test_add_player_with_ft_and_skill` (stub)
- `team_picker_unit_test_add_players_with_count_ft_and_skill` (stub)
- `team_picker_unit_test_clear_players` (stub)
- `team_picker_unit_test_pick` (stub)
- `team_picker_unit_test_pick_no_splitting_with_team_count_size_and_imbalance` (stub)
- `team_picker_unit_test_pick_splitting_with_team_count_size_and_imbalance` (stub)
- `team_picker_unit_test_set_maximum_imbalance` (stub)
- `team_picker_unit_test_set_splitting_allowed` (stub)
- `team_picker_unit_test_set_team_count` (stub)
- `team_picker_unit_test_set_team_size_fixed` (stub)
- `team_picker_unit_test_set_team_size_min_and_max` (stub)
- `telemetry_disable_verbose_context_switch_profiling` (empty-impl)
- `telemetry_enable_verbose_context_switch_profiling` (empty-impl)
- `test_set_runscript_id` (empty-impl)
- `ui_clear_fade` (stub)
- `ui_fade_to_black` (stub)
- `virtual_monkey_start_default` (stub)
- `virtual_monkey_stop` (stub)
- `workbench_add_silent` (empty-impl)
- `world_controller_automation_set_signin_age_restriction_enabled` (stub)

Gone:

`asset_apply_patch`, `content_system_set_dirty_schema_name`, `content_system_set_override_session_restore_path`, `content_system_set_override_session_store_path`, `core_upload`, `datamine_debug_menu_setting`, `datamine_insert`, `datamine_open_debug_menu`, `datamine_set_display_mission_segment`, `datamine_set_mission_segment`, `ee_enabled`, `ee_overlap_assert`, `force_async_file_copy_hang`, `force_pvp_game_engine`, `game_all_quiet`, `game_is_playtest`, `game_revert`, `game_safe_to_respawn`, `game_safe_to_save`, `game_safe_to_speak`, `game_save`, `game_save_and_quit`, `game_save_cancel`, `game_save_cinematic_skip`, `game_save_immediate`, `game_save_no_timeout`, `game_save_unsafe`, `game_saving`, `map_apply_patch`, `mp_ai_allegiance`, `net_create_hosts_entry`, `net_enable_eula_test`, `net_set_http_proxy_url`, `net_use_hopper_directory`, `net_use_secure_backend`, `physics_constants_reset`, `physics_disable_character_ground_adhesion_forces`, `physics_set_velocity_frame`, `random_range_array`, `real_random_range_inclusive`, `register_package_use_new_entry_table`, `set_sdsm_maximum_depth`, `status_line_dump`, `status_lines_disable`, `status_lines_enable`
