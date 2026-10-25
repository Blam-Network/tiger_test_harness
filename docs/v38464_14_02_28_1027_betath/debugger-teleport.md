# Debugger teleport: the host teleportation nest (betath 38464)

// 2026-10-22. PS4 pre-alpha 38464.14.02.28.1027.betath, IDA `eboot-ida.elf` (headless :13345, read only).
// Run: server logs/start-betath-20261022-201243.out, cosmo_patrols_1 (cosmo, FAH+GAH). Same failure in
// city_tower_default1 earlier in that log (teleports 1-3 to 1.0 / 2.0).
// Offsets below were read in disassembly; the client's teleportation code has no IDA functions.

## Symptom

// `/teleport 7.0` (the debugger's slice menu) logs `debugger teleport 1 to 7.0 (transition 0x0)`, the
// membership goes out, and nothing happens: the client never reports a teleportation in class 21 (no
// `client teleport state=` line in the whole log), the host's teleportation sits at state 1, and the next
// teleport "replaces 1, which stood at state 1". Walk-in crossings in the same session work.

## End to end

// 1. Debugger app (tiger/packages/bullshcript-debugger, Sidebar.tsx teleportItems): a slice runs
//    `/teleport <bubble>.<state>`, a listed spawn point `/teleport <handle> <name>`; the console command
//    goes over DAP to the server.
// 2. src/debug/commands.ts `teleport`: region = packBubbleStateHandle(bubble, state); transition =
//    fnv1(name), a 0x hash literal, or with no name `scenarioClient(activity)?.spawnTransition ?? 0`.
// 3. RegionCrossing.debugTeleport -> teleport(): instance.teleport = {id, region, state 1, transition},
//    holds the phase's own teleports, pushes the membership.
// 4. The membership's PAH block carries the host teleportation (betath 80800BCB, written by
//    versions/v38464_14_02_28_1027_betath/membership.ts). The client accepts it, asks its slice-set
//    transition for the region, crosses (class 21 pending region + token; the server answers as for any
//    crossing), enters the region by the spawn transition, reports done (class 21 teleport state 3).
//    RegionCrossing.noteClientTeleport moves the host to 3 (sent as inactive), the client goes inactive.

## The client's teleportation (0x900390)

// Called through a vtable thunk (0xB20AB0) with rsi = the host's 80800BCB, rdx = the client's own
// teleportation 80800D6E. Layouts (rsat-descriptors.json):
//   80800BCB (0x24): +0 i8:2 state, +4 80800DD4, +0x14 80800DD4.
//   80800DD4 (0x10): +0 u8 id, +4 i32 region, +8 u32 spawn transition, +0xC u20 peer mask.
//   80800D6E (0x18): +0 i8:3 state, +4 80800DD4 (the accepted one), +0x14 i32 start time.
// - Accept: `mov al,[rbx+4] / cmp al,[r14+14h] / jz` (0x9003B7). When the client's id differs from the
//   host's id at +0x14, it copies the 80800DD4 at +0x14 into its own (0x900490..0x9004A9), stamps its
//   start time, state 1, "Accepted teleportation '%d'". A client not at state 0 or 3 warns "forced to start
//   a teleportation while one's already active" and accepts anyway. The host's state is not read here.
// - State 1: sub_888740 (transition manager +473 != 5), then sub_888680(region, &transition, id, mask)
//   -> sub_887CC0: manager +880 region, +884 spawn transition, +888 id, +892 mask; state 2, "Requested
//   slice-set transition".
// - State 2: the manager's current slice set (sub_888760) equals the region -> state 3, "Completed ...
//   waiting for the host to notify that all clients are ready".
// - State 3: `cmp byte [r14],0 / jnz` (0x9006AE): host state 0 -> sub_D76720, state 0, "Host is
//   reporting inactive".
// - sub_1636150 (host inactive): state == 0 and id at +4 == id at +0x14. So +4 is the last teleportation
//   the host finished, +0x14 the one it runs: the alpha's 808044D2 {a, left, right} exactly.
// - The client's own print (sub_17F2C40) names its 80800D6E fields tel_state, tel_cookie,
//   tel_always_deinstantiate (= mask == 0) and tel_start_time.

## Cause

// The betath membership wrote the target into the first 80800DD4 (+4, the last finished) and zeros into
// the second (+0x14). The client compared its own id (0) with +0x14 (0): equal, so no teleportation was
// ever accepted, and nothing came back to move the host off state 1. The state also went out raw: the
// field is i8 2 bits biased by 1 (-1..2), so the host's 3 ("every client completed") does not fit.

## Fix

// versions/v38464_14_02_28_1027_betath/membership.ts teleportValue: as the alpha's teleportNest. Active 1
// while the host runs it (states 1, 2), else 0; the target in the second 80800DD4; the first equals it
// once finished (zeros while running); peer mask 0 (the client then waits on no peer). Hard wipe phase
// starts (teleportToPhaseStart) use the same nest, so they move betath clients too.
// Test: versions/v38464_14_02_28_1027_betath/membership.test.ts.

## Spawn transition 0x0

// Betath's scripts give no start spawn point (the activity-start test's STARTS have no `spawn`), so
// `scenarioClient().spawnTransition` is unset. The GAS then sends "default" (0x2EA8FB98,
// SPAWN_TRANSITION_DEFAULT), but the debugger's no-name teleport (commands.ts), the phase teleport
// (stepTeleport) and the hard wipe fall back to 0. Not a blocker: the client's transition point search
// (sub_8FDB70) runs three passes over the slice's transition points, exact name (2), exact name or no
// name (3), then the first one with no checks ("using fallback transition point", 4). A 0 name lands on
// the fallback point. To land on a named point, pick it from the slice's submenu (the data service lists
// `default` first) or pass it: `/teleport 7.0 default`. Sending "default" for a no-name teleport would
// match the GAS but changes every build's teleports; left as is.

## Open

// - Betath's host hard wipe 80800B58 {u8, u8, i8:3} has the alpha's shape {cookie, completed cookie,
//   state}; the second u8 still goes out 0. Not checked on this client.
// - The phase teleport's 1 -> 2 step runs on the script tick (stepTeleport); with active sent for both it
//   no longer matters on this build.
