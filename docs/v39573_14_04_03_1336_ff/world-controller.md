# PS4 39573 (ff) world controller and state handlers

2026-10-23. Codie's ff IDB (`D:/Games/ps4/musicplayerdemo2/eboot.elf`, IDA :13347). Static work only. All the names
below are now in that IDB; the ledger (ea, old, new, evidence) and the reapply scripts are in the session
scratchpad, `naming/ff-world-controller-names.json`, `naming/ff_world_controller_names.py` and
`naming/reapply_ff_world_controller_names.py`. If you re-run `naming/ff-types/reapply.py` (it rebuilds the vtbl
member names from the function names), run `reapply_ff_world_controller_names.py` after it. Otherwise the base
vtbl members keep their names but lose their prototypes.

Reach (:13337) is the template. `c_life_cycle_state_manager` and `c_life_cycle_state_handler` there match the
Destiny `world controller state manager` and `c_world_controller_state_handler`. The Reach names used here are
register_state_handler, set_current_state (Destiny's version is apply_requested_state_change),
current_state_prepare_for_update, get_status_string, enter and exit.

## State handler vtable (`c_world_controller_state_handler`, 10 slots)

The eboot has no vtable for `c_world_controller_state_handler` itself. `c_world_controller_tiger_base_state_handler`
(vtable 0x2B5C230) holds the default bodies, and slots 4 and 7 are pure. Each handler's own vtable is primary; the
UI handlers add slots 10 to 13, which are overrides of `i_online_world_controller_ui_boot_flow_context` and
`i_online_world_controller_ui_dialog_result_handler`. Those extra slots are not named yet.

| slot | name | meaning | evidence |
|---|---|---|---|
| 0 | `~Class` | complete-object dtor (an empty body everywhere) | Itanium ABI layout; slot 1 is `~Class_deleting` (operator delete) |
| 1 | `~Class_deleting` | deleting dtor | already named |
| 2 | `initialize()` | one-time setup | `c_online_world_controller::initialize` calls it on all 34 handlers, then registers each handler |
| 3 | `dispose()` | called when the handler is unregistered | `c_world_controller_state_manager::register_state_handler` calls it on the old handler, and `::dispose` clears all 35 handlers. The base is empty and nothing overrides it |
| 4 | `enter(previous_state, reason)` | state entered | `apply_requested_state_change` calls it after "Entering state '%s' for reason '%s'". content_check logs "entered for reason verifying_new_content" |
| 5 | `exit(next_state, reason)` | state left | called after "Leaving state '%s' for reason '%s'". in_world's exit writes the activity end data to the datamine |
| 6 | `prepare_for_update() -> bool` | prerequisite gate | the manager calls update() only when this returns true. The base walks 34 prerequisite bits at this+8 using `check_prerequisite`. A "not ready" result logs "Prerequisite '%s' failed, skipping update()". A failure logs "... proceeding to cleanup state" and requests cleanup with the reason. No handler overrides it |
| 7 | `update()` | per-tick work | the "waiting for ..." logs are here. It is pure in the tiger base |
| 8 | `fill_retail_datamine_state_data(s_world_controller_state_datamine_data *)` | 3 qwords for the KTO datamine record | on an error state change, `world_controller_request_state_change` passes this to the retail datamine as WorldControllerStateStatus, ...TaskManagerRequestedTasks and ...TaskManagerRemainingTasks. The base zeroes all three. host_setup, session_creation, world_transition, initial_slice_set_loading, prologue_intro_loading and cleanup override it |
| 9 | `get_task_manager()` | the handler's embedded `c_task_manager<...>` | the base returns NULL. initial_slice_set_loading returns this+48 and cleanup returns this+56; the c_online_world_controller ctor sets the task manager vtables at those offsets. No caller was found, so this name has medium confidence |

All 38 handler classes, the tiger base and the 37 concrete handlers, have their overrides named
`Class::<slot name>`. Two development handlers share code with their parents: dev physics_join reuses
physics_join::exit, and dev prologue_intro_loading reuses prologue_intro_loading::exit and
::fill_retail_datamine_state_data.

Tiger base helpers:

- `check_prerequisite(prerequisite, ...)` (0x8B6D60). It returns 0 for ok, 1 for not ready and 2 for failed.
- `set_required_session_parameters(session_type, mask)` and `set_default_required_session_parameters`. They
  store the required session-parameter masks for fireteam, posse and group at this+24.

Each prerequisite check is named after its log line, for example `world_controller_prerequisite_ethernet_link`,
`_state_time_limit`, `_deployment_not_draining`, `_fireteam_rescue` and `_slice_set_transition_manager`.

## World controller interface (`c_world_controller_engine_interface` -> `c_world_controller_interface`, 12 slots)

The implementations are OWC `c_online_world_controller` (vtable 0x2B5BD20) and EWC `c_editor_world_controller`
(0x2B66200). The selector also knows SWC, DWC and AHWC, but they are not in this binary ("Selected world
controller is not available in this binary").

| slot | name | OWC body | evidence |
|---|---|---|---|
| 2 | `update()` | updates the global resource loader | called every tick by `world_controller_update` (from simulation_update) |
| 3 | `set_scenario(fireteam_host, group_host, client)` | `world_controller_activity_manager_set_scenario` | log category world_controller:activity_manager:set_scenario |
| 4 | `clear_scenario()` | `world_controller_activity_manager_clear_scenario` | "clearing scenario" |
| 5 | `start_game() -> bool` | `c_world_controller_activity_manager::start_game` | "activity_manager: start_game". EWC returns true |
| 6 | `end_game()` | empty (one folded nullsub shared by OWC and EWC) | guessed from its position after start_game. Low confidence |
| 7 | `request_world_reset()` | `world_controller_request_world_reset` (0x851170; I created this function) | "Cannot world_reset in OWC / with activity peers / ...", then transition 9 |
| 8 | `request_callback_transition(name, callback, context)` | `world_controller_request_callback_transition` | queues transition 15 (152-byte payload), which runs the callback with the simulation locked. `world_controller_bug_callback` uses the same transition |
| 9 | `initialize()` | builds the 34 handlers, calls `world_controller_register_state_handler`, then `world_controller_request_state(bootflow:media_check)` | `world_controller_select` calls slot 9 (+0x48) |
| 10 | `dispose()` | empty | called by `world_controller_selector_dispose` |
| 11 | `unload_global_resources()` | sync-unloads global resource loader packages 7, 6, 2, 3 and 4 | `world_controller_unload_global_resources`, from the exit-game transition (11) |

## States (`e_world_controller_state`, `g_world_controller_state_names` 0x2B5BBF0)

| # | state | OWC handler qword | # | state | OWC handler qword |
|---|---|---|---|---|---|
| 0 | pregame | none | 18 | bootflow:profile_setup | 215 |
| 1 | bootflow:media_check | 1 | 19 | bootflow:prepare_for_orbit | 223 |
| 2 | bootflow:bootload | 8 | 20 | character:signin | 485 |
| 3 | bootflow:intro_screen_display | 15 | 21 | character:prologue | 527 |
| 4 | bootflow:start | 23 | 22 | cleanup | 265 |
| 5 | bootflow:platform_signin | 31 | 23 | setup:orbit_loading | 444 |
| 6 | bootflow:enumerate_content_rights | 41 | 24 | setup:orbit | 534 |
| 7 | bootflow:account_signin | 47 | 25 | setup:activity_session_creation | 544 |
| 8 | bootflow:eula | 95 | 26 | setup:matchmaking | 575 |
| 9 | bootflow:email | 103 | 27 | setup:activity_host_setup | 585 |
| 10 | bootflow:content_check | 112 | 28 | setup:prologue_intro_loading | 593 |
| 11 | bootflow:content_install | 120 | 29 | setup:orbit_outro | 600 |
| 12 | bootflow:insufficient_content_space | 134 | 30 | setup:activity_world_transition | 606 |
| 13 | bootflow:illegal_dlc_media | 141 | 31 | activity:initial_slice_set_loading | 944 |
| 14 | bootflow:queuing | 147 | 32 | activity:physics_join | 987 |
| 15 | bootflow:package_registration | 191 | 33 | activity:in_world | 994 |
| 16 | bootflow:bap_signin | 198 | 34 | activity:watch_video | 1010 |
| 17 | bootflow:investment_signin | 207 | | | |

"OWC handler qword" is the handler's offset in `c_online_world_controller`, divided by 8. -1 means NONE. OWC
does not register the development handlers (dev account_signin, dev physics_join, dev prologue_intro_loading).

## Change reasons (`e_world_controller_state_change_reason`, `g_world_controller_state_change_reasons` 0x2F4A240)

There are 223 entries of {name, hash}, filled at static init. Reasons 0 to 10 are normal:

| # | reason |
|---|---|
| 0 | normal_flow |
| 1 | matchmaking_backout |
| 2 | matchmaking_restart |
| 3 | activity_recycling |
| 4 | activity_join_in_progress |
| 5 | activity_rejoin_in_progress |
| 6 | leaving_fireteam |
| 7 | return_fireteam_to_orbit |
| 8 | verify_new_content |
| 9 | switching_character |
| 10 | switching_orbit_slice_set |

`state_change_reason_is_error` (a log self-name) treats every reason from 11 up as an error. Examples:

| # | reason |
|---|---|
| 11 | error.recycling_activity |
| 15 to 44 | error.starting_private_activity_instance_* |
| 47 | error.deployment_is_draining |
| 51 | error.state_timed_out |
| 62 to 99 | error.private_activity_host_* and error.booted_from_private_activity_host_* |
| 102 | error.activity_not_ready_to_spawn |
| 119 | error.no_ethernet_link |
| 128 | error.no_bap_connection |
| 132 to 218 | error.sstm_* (slice-set transition manager) |
| 221 | error.forced_kto |
| 222 | error.forced_ktl |

The full ordered list is in the enum and in `naming/ff-world-controller-reasons.json`. I renamed the table from
`g_error_names`, which was an earlier guess.

Helpers:

- `world_controller_state_get_name` / `world_controller_state_change_reason_get_name` (both return "NONE" for -1)
- `world_controller_state_change_reason_get_hash`

## Flow

1. `world_controller_initialize(type)` (0x84FFE0) runs these in order:
   - `world_controller_globals_initialize` allocates the managers. Their allocation names are retail datamine,
     activity manager, activity world globals manager, state manager (432 bytes), session manager, slice set
     manager, matchmaking manager, cinematics manager, client config manager and ui-stage manager. The globals
     are `g_world_controller_*`, read through `world_controller_get_<x>` (writers) and `_const` (readers).
   - `world_controller_selector_initialize`.
   - `world_controller_select(type)`, which logs "OWC selected" and calls slot 9 `initialize()`.
   - Registering `world_controller_bug_callback`.
2. `c_online_world_controller::initialize` runs:
   - `world_controller_register_transitions`.
   - Every handler's `initialize()`.
   - `world_controller_register_state_handler(1..34, handler)`.
   - `world_controller_request_state(bootflow:media_check)`.
3. Every tick, `world_controller_update` (from simulation_update) runs the transition manager, then
   `world_controller_globals_update`, then OWC's slot 2 `update()`. Inside the globals update,
   `c_world_controller_state_manager::update` loops up to 35 times:
   - `apply_requested_state_change`. If the requested state or reason differs from the current one, it calls
     `exit(next, reason)` on the old handler and sets current = requested, stamping the enter time. Then it calls
     `enter(previous, reason)` on the new handler and posts the "lifecycle" event.
   - If `prepare_for_update()` returns true, it calls `update()`.
   - The loop stops when requested == current ("Aborting potential infinite state-update loop" at 35).
4. A state change goes through `world_controller_request_state_change(state, reason, context)`. The helpers
   `world_controller_request_state(state)` and `_for_reason(state, reason)` call it. It warns on "Duplicate
   request to a state '%s' which is not cleanup" and stores the requested state and reason in the state manager.
   When the reason is an error, it also does the KTO work:
   - logs the KTOBUCKET lines (STATE_CHANGE_REASON, current/next state, context, BAP, activity, session);
   - calls the current handler's `fill_retail_datamine_state_data` and sends the result to the retail datamine.
5. A failed prerequisite (`prepare_for_update` returning 2) requests `cleanup` (22) with the prerequisite's
   reason. That is the kick-to-orbit path. I did not trace where cleanup's own update goes from there
   (`kick_to_bootflow_start` exists).
6. Fireteam, posse and group sessions also carry a world-controller goal-state session parameter:
   - `world_controller_set_session_goal_state[_with_reason]` and `world_controller_get_session_goal_state` read
     and write it.
   - `world_controller_session_peers_in_current_state`, `world_controller_session_peers_at_or_past_current_state`
     and `world_controller_session_host_ahead_of_current_state` compare peer states.
   - `world_controller_state_order_toward_goal` decides whether a peer is ahead of us or behind us, walking the
     state indices modulo 35.

State manager layout (`c_world_controller_state_manager`, 432 bytes):

| offset | field |
|---|---|
| +0 | `char status_string[128]` (the Reach get_status_string) |
| +128 | `handlers[35]` |
| +408 | `current_state` |
| +412 | `current_reason` |
| +416 | `state_enter_time` |
| +424 | `requested_state` |
| +428 | `requested_reason` |
