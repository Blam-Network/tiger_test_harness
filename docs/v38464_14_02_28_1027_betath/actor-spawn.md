# Tower actors never spawn: the scripts never tick (betath 38464)

// 2026-10-22. PS4 pre-alpha 38464.14.02.28.1027.betath, IDA `eboot-ida.elf` (headless :13345).
// Run: server logs/start-betath-20261022-201243.out, city_tower_default1 (240), slice 3 (plaza).

## Symptom

// Every squad tally reads "alive 0" and no vendor shows up. The scripts' threads start
// ("thread sc_main_plaza_thread start") but nothing after: no "print CITY TOWER DEFAULT ACTIVITY",
// no "host:t30_hack_bind_host()", no sc_plaza_vendor_* thread, no place().

## Not the actor or squad bodies

// In the same run the script debugger placed every plaza squad by hand (log lines 625-750,
// "debugger: place() on sq_plaza_vendor_pve t1#11" ...). Each time the client's squad sense
// came back with the bodies alive ("squad 8cc31436:11 alive 1 (reported)", civ_monitor_talkers
// alive 4, ...). So the ActorAuth (80800844), SquadAuth (8080082A, roster per definition cell)
// and the retail actorPlaceBody are accepted and the client places.
// Client side, for reference (disassembly read at 0x15FA0C0..0x15FA208, no IDA function there):
// - 0x15FA0C0 is the combatant's receive-auth: only as bubble authority (sub_16072B0 == 1);
//   sub_15FA4E0 applies the kill epoch (auth+0), then asserts auth+0 == actor+0x1AC.
// - Place when `[auth+6]` (place) && !`[actor+0x1DC]` && (`[auth+5]` carried | 2) != 3 &&
//   `[actor+0x1E0]` == -1 -> sub_15F8DB0 (placement through sub_168E640; failure logs
//   "activities:client:combatant: '%s' failed to place actor" at level 4).
// - Anonymous bodies: sub_15FF760 (squad reconcile/placement), per cell sub_1601280 =
//   squad+0x408[cell] (roster copy) - squad+0x1CC[cell] - already placed.

## Cause: the player_spawned incident is misread

// session-host.ts tick(): "Nothing runs until a player has spawned" - the scripts tick only
// once `host.playerSpawned`, set by an activity_host_incident whose names include
// player_spawned (session-host.ts `handleIncident`). The run's only incident (53B, line 528) logged as
// `incident 0x50e54ccc refs=[]`, so the gate never opened.
// betath's incident.ts was copied from 40662: 11-bit registry indices plus an optional list of
// plain hashes. The client's own schema (rsat-descriptors.json, from its registry 0x1F33920):
// - 80800B15 = {80805424 names, 808042AC metadata}; the only schema nesting 80805424.
// - 80805424 = {i32 4-bit count, array (max 15) of 80805420}; 80805420 members are i32 10-bit.
// - 808042AC = {i32 9-bit length, 80804408 bytes}. No plain-hash list in between.
// The betath incident registry has 661 names (fits 10 bits). Decoding the captured incident
// `218e5618...` with 10 bits: count 2, indices 99 and 598, length 48 (53B fits exactly).
// Index 99 is fnv1("player_spawned") = 0x2766028D. With 11 bits it read 199 (0x50E54CCC) and 344.

## Fix

// versions/v38464_14_02_28_1027_betath/incident.ts: 10-bit indices, metadata length right after
// the names (metadataBit = 4 + 10n + 9), no hash list. Test: incident.test.ts (gated on
// TIGER_TEST_PACKAGES_V38464_14_02_28_1027_BETATH) decodes the captured incident to
// [player_spawned, registry[598]], metadataBit 33.
// Offline check (scratch, not kept): the betath package host on city_tower_default1 slice 3,
// player spawned, 4 ticks -> prints the banner and places cryptarch/pve/vanguard vendor1 and
// the postmaster squad (bodies=2), as the debugger placement did live.
// Every other betath incident (kills, cinematic_finished/skip, triggers, interaction) went through
// the same wrong reader, so those were misnamed too.

## Open

// - Not seen live yet: needs a server restart and a Tower load.
// - registry[598]'s name is unknown (the mission/incident.test.ts Tower spawn carries
//   0xEB1FEE95 and 0x84D50D24 beside player_spawned).
