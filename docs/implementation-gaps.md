# Implementation gaps (audit 2026-10-21)

Static audit of what the activity host (bullshcript script host + web-tiger-day0 wire) does not
implement, for alpha 36735 (A) and TU0 41375 (T). Three read-only passes: natives the scripts call,
bundle row types, and wire fields/messages. Nothing here was checked against the game or captures
unless stated. Hard wipe has its own write-up: [hard-wipe.md](hard-wipe.md).

How gaps stay hidden:
- A native with no handler answers by name pattern and only writes a log note
  (bullshcript `native_support.ts:330` `unboundAnswer`: `is_`/`has_` -> false, `get_`/`_count`/`progress_`
  -> 0, else true).
- Script rows with no wire encoder are logged once ("no encoder for X rows, not sent", script-host/item-sink.ts)
  and go out idle or all-zero.
- Client reports with no consumer are decoded and dropped without a note.

## 1. Breaks a core loop

| Gap | Builds | Effect | Where |
|---|---|---|---|
| Kill incident metadata is never decoded past the 808004C9 header; scripts get `killer = self`, `victim = {}`, no bubble / dead combatant / object identifier hashes | A, T | No loot, XP or progression from kills (dropLoot/grantXp/grantProgressionZero have no callers). `destructible_objective` can never complete (`destructible_kill` is not in KILL_FAMILY_NAMES). Bounty `kill_accum_combatant_bubble_hash` never counts. PvP `handle_kill` sees nobody. player_died / suicide / betrayal never dispatch. | mission/incident.ts, script-host/session-host.ts (handleIncident, handleKill), players/registry.ts |
| `("...").format(...)` throws (string metatable has only `__add`) | A | Kills `game_thread` in the PvP wait-for-players loop on all three PvP maps | c_pvp_controller.bs:84, c_pvp_salvage.bs:100 |
| Hard wipe handshake missing; T row type 26 `hw_phaseNN` (mars_portal_1) has no zero auth, rows left out with an error | A, T | Fireteam wipe never happens; mars_portal_1 sends incomplete applies | hard-wipe.md |
| T command scripts empty: `commandScripts: () => []` | T | `execute(cp)` runs 0 atoms on every ControlPoint (2687 rows / 45 activities) | content/versions/v41375_*/readers/activity-table.ts |
| T sense: no actorDrop / actorCommandScript accessors; three sense schemas undecodable (0x8080077e, 0x808029a9, 0x80802b18) and `resyncs:false` | T | `is_dropping` / `get_command_script_state` wait to their timeouts; one undecodable row ends the whole sensor update (t39 new_user_experience is in all 56 cached activities; not checked against a capture) | versions/v41375_*/sensor-sense.ts, rsat/sensor-sense.ts |
| Fireteams: one instance per player (roster decoded, only the requester used); host is solo-only; PeerLeaveRequest logged only; MembershipAcknowledgement dropped | A, T | No co-op | activity-host-manager.ts, activity-instance.ts, session.ts (handleActivityHostNotification) |

## 2. Features silently missing

| Gap | Builds | Effect | Where |
|---|---|---|---|
| PvP: capturable, faction and TeamPicker senses dropped (no feeder exists; wiring them needs a ScriptHost entry point), Capturable / Faction / ObjectTimer object components never encoded, PlayerAuth faction hard-coded 0, scoreboard rows never sent (no encoder, no scoreboardDefinition), score incidents unbound | A (T scripts have none) | Dominion / salvage captures never fire, teams never go out, scoreboards empty | script-host/session-host.ts (handleSensorSense), script-host/item-sink.ts, versions/v36735_*/sensor-auth.ts (PlayerAuth faction) |
| Health rows have no encoder | A (T has no rows) | Boss bars never bind (`hydra_health`, `boss_health`, `captain_health`); `is_ready()` never true | script-host/item-sink.ts |
| `insertion_point` is a logged no-op | A, T | Checkpoints never advance (mars m01_valley m2-m6, venus m01_engineering m4, chapter_2 m4); matters for hard wipe respawn | instance_building.ts (instanceNative) |
| ObjectiveSense ignored (no feeder exists; wiring it needs a ScriptHost entry point) | A, T | `get_count()` on objectives is always 0 | script-host/runtime.ts, script-host/session-host.ts |
| PlayerObjective countdown dropped by both encoders; participants solo-only | A, T | Objective timers never show | item-sink.ts |
| Script incidents (`submit_incident_hash/_with_team`) dispatch locally only | A, T | pvp announcer/score, `phase00_raid_end`, `action_mock_partial_complete*` never reach client or world server | scheduling_threads.ts:300-325 |
| Engagement handlers (`set_handler(po.d_handle_engagement_incident)`) recorded, never run; `get_engaged_player_count` 0/1 | A, T | Public events' engagement logic (headlands, caldera; cosmo public events) | u_event_globals.esu, u_event_countdown.esu |
| SafeZone: `inside` sense dropped (no feeder exists; wiring it needs a ScriptHost entry point), `set_filter` never sent | A, T | Tower plaza safe zone | script-host/session-host.ts, script-host/item-sink.ts |
| ObjectFilter on T sends only row(add) + activityFlag | T | squadMembers / combatantType / playersOnTeam filters and removes never reach client | versions/v41375_*/sensor-auth.ts |
| Approximations: `count_at_firing_area` = alive count (no squad combat-count feeder exists; wiring it needs a ScriptHost entry point), `squad_member.is_alive` = squad alive, Location from the bundle's single PlayerMonitor, `encounter_manager.add_ambient_encounter` args 3-4 ignored, `objective.add_squad` ignores the squad, `player_objective.activate` writes Incoming (true state unknown) | A, T | Wrong timing in vex block waves, warp gates, ambient budgets | squad_natives.ts, object_natives.ts, scheduling_threads.ts |
| `trigger_volume.import_only_clear_slice_set_assignment` unbound (answers true) | A, T | dialog_trigger in chapter_2 / strike_1 / moon_portal_2_music | dialog_trigger.esu:15 |
| `submit_incident_with_metadata`, `submit_score_incident`, `submit_incident_with_player` unbound | A | PvP | c_pvp_dominion.bs:77, c_pvp_game_type.bs:73,82 |
| `fireteam.nav_point_clear_all`, `new_mission.display` logged no-ops | A | Tower default | enc_city_tower_default1.es:45-55 |
| `d_finalize` delegate never invoked | A | PvP controller cleanup | c_pvp_controller.bs:186 |
| Row types with no behaviour: Fireteam (t9), NewMission (t53/54), T t36 task rows, t37 Passenger (modelled, gated on a type id TU0 lacks), t18 navigation, t38 Target, t39 new_user_experience (probably the real NewMission), t62 `si_*` | A, T | Unknown until each is looked at | tag_types.ts per build |

## 3. Wire constants and stubs (fine solo, risky later)

- Membership: wipe cookie {0,0,0}; replicateMask 0; slot auth not echoed (A); public host fields zero.
- PAH ambassador revoke flips on an 11 s timer instead of the client's `ackedRevokeToken` (pah-policy.ts).
- GAS: `draining` false, `world.handles` [] (no activity-option overrides), world time fixed at 10:00 (A).
- JoinResult `result` always 0 (no reject path), replication epoch always 1, AdvanceReplicationEpoch never sent.
- Host never sends SensorMessage 7, ScriptState/ScriptEvent 38/39, the entity slot authority queries 27-31, ConnectivityFailure 35.
- BAP: unrouted world-server nids get status-0 zero replies (A 101, 105, 201-207, 303, 304, 506, 803, 902, 1401 and cheats); alpha `director_enter_orbit` is ack-only (no activity-complete flush); alpha never names or completes the activity on the self character; peer/inspection/roster baselines always use the session's own character.
- Signon keys and ticket are constant zero; demonware serves only bdMatchMaking, encrypted frames dropped.

## 4. Suggested guard

Make unbound natives loud: an error (or at least one warning per (type, method) with call site)
instead of `unboundAnswer` guesses, the same way unknown types became compile errors.
