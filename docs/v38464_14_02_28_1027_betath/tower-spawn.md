# Tower spawn: lifetime state gate (betath 38464)

// 2026-10-22. PS4 pre-alpha 38464.14.02.28.1027.betath, IDA `eboot-ida.elf` (headless :13345).
// Run: client windowed.log 16:35, server logs/start-betath-20261022-163224.out, city_tower_default1 (240).
// Key compares below were read in disassembly, not only the decompiler.

## The spawn function

// sub_8FA920 (no IDA function; prologue at 0x8FA920) is the per-player spawn update. Its reasons go
// through sub_8FA540(level, text): level 2 prints as `error` with a shared 5 s rate limit, every other
// level is 1 and never reaches windowed.log. Order of the gates:
// 1. no slice set (lvl 1), no simulation player (lvl 2), gear loading (lvl 1).
// 2. Lifetime state, 0x8FAB34..0x8FABE6: `ebx = sub_160D410()` (lifetime auth byte 0 via sub_160D430 =
//    sensor type 16, the binder's 0x80800909 row; returns 2 when there is no lifetime sensor).
//    `mov eax,0D8h / bt eax,ebx / jb` -> states 3,4,6,7 blocked; `mov eax,3 / bt` -> 0,1 blocked (and
//    sets D73F80(player)+0x5F0 = 1); `mov eax,24h / bt / jb` -> only 2 and 5 go on. Blocked logs
//    "can't spawn due to the current activity lifetime state" at level 1 (invisible) and returns.
// 3. Player sensor, 0x8FAD27..0x8FAD5C: sub_B2DB80(player) and sub_B2DE80(player) both non-null, else
//    "can't spawn due to not having a player sensor assigned" (level 2, the visible error).
// 4. Faction: sub_161ACB0(player)+0x10 == 0xFF -> "awaiting faction assignment" (lvl 1).
// 5. Spawn lock: byte from sub_B2DB80 == 0 -> "waiting for the activity spawn lock" (lvl 1).
// Then spawn policy / methods / points (the method error is level 4, not seen).

## What assigns the player sensor

// sub_B31510 (defined in the session's IDB, not saved; no static xref, vtable slot) is the player sensor
// client's PlayerAuth (808024EA, 0x58 bytes) setter: "attaching FAH/GAH sensor '%s' to player '%s'".
// - Key = PlayerAuth.identity.key (auth+0x18). Attaches when the key changed or nothing is attached and
//   key != 0. sub_1848F80(key) finds the player whose +0x18 equals it (`cmp rdx,[rax+rcx+18h]`,
//   0x1849087); no match logs "can't attach player sensor ... to non-existent player" (level 4).
// - Player +0x18 is the "character id" (sub_162B490's "character id mismatch! player instance had").
//   It is filled at player_new (sub_D664C0 -> sub_1847250 -> sub_1845F80) from the player configuration.
// - On attach: player+0x48 = sensor handle (sub_1846810); sensor+0x1C8 = identity copy (sub_1B331B0),
//   sensor+0x298 -> auth+0x50 = PlayerAuth [3] "flag" (sub_1B33250, from sensor+0x228).
// - sub_B2DB80(player) = resolve(player+0x48)+0x298 (the flag byte, also the spawn lock).
//   sub_B2DE80(player) = sub_B326F0 -> sub_162B8F0: sub_162B490(sensor) != -1 and player+0x38 bit0
//   (local player, set at player_new).
// So no separate message: the binder Player row's auth with key = character id (0x200000001) assigns it.

// Evidence it was assigned in this run: the client's first sensor_sense_update (643B) decodes (see
// below) to row 0x40AEBF90 Player #4 with state {3, 0x811C9DC5, true, true, 1}, state2.f32 0.0001.
// Those come from sub_B32010, the player sense writer, which only runs when sub_162B490(sensor) != -1
// and player+0x38 bit0: the sensor was attached to the local player.

// The visible error is transient. It was printed once (client line 1933) while the client still held
// membership 10 (MEM-10 at 1790, MEM-11 at 1942). The server sent membership 11 (seq 23) before the
// dest apply (seq 28, class 5 2241B), so the error predates the apply: no lifetime sensor yet ->
// sub_160D410 = 2 -> passes gate 2 -> no player rows yet -> gate 3 fails. After the apply the gate
// returns at gate 2 every frame, silently, so the error never repeats.

## The blocker: lifetime state numbering

// The server sends lifetime state 3 for "active" (40662 numbering, wire = script + 1):
// `versions/v38464_14_02_28_1027_betath/sensor-auth.ts` `lifetimeStates: { active: 3, ended: 7,
// none: 0, pregame: 1, shift: 1 }`, and the `encodeLifetimeAuth` default `state = 3` (used by the binder
// grant, `buildBinderSenseEntries` in rsat/sensor-auth-fields.ts). The item-sink constructor starts at active (3) or none (0); scripted
// changes go out as script state + 1. Betath lets only 2 and 5 through, so 3 (and 0, 1) hold the spawn.
// 2 is the active state here: it is the value sub_160D410 uses when there is no lifetime sensor, and
// the bullshcript runtime numbers active 2 (native_support.ts LIFETIME_STATE_BY_MEMBER). Betath matches
// 36735's numbering (active 2, ended 6, no shift), not 40662's.
// Other betath checks agree with no shift: `cmp eax,6` (sub_853EE0), `cmp eax,7` (sub_853EC0),
// (state-6) < 2 terminal (sub_B2E3A0), state < 8 (sub_B214C0), `state == 5` (sub_160D570).
// Unverified: the names of 4, 5 and 7 (schema reflection is off). Script results 5 / ended 6 map
// straight through; 7 has no script state.

## "Possible host migration" (MEM-n, every push)

// sub_84D4B0 walks the local session's peers in state 10; for each machine id found in the activity
// membership (sub_17F4640, 8-byte compare against slot+8) but missing from the activity client's tracking
// list (sub_17DF340, +0x63C8, count +0x63C4) it logs the fixup and re-adds it (sub_17DEE60).
// The list is cleared in the membership receive, sub_17E3D20 at 0x17E4716..0x17E472A:
// `call sub_17F35C0` (old membership +4) / `cmp [rbp+var_51EC], eax` (new +4) / `jz` / `mov [rbx+63C4h],0`.
// Membership +4 is ReplicateMembership member [1] (`unk`). sub_17F3590 increments that same word with a
// wrap to 1, so it is a host epoch, not a generation. The server writes `unk: values.generation`
// (membership.ts `unk: values.generation`) and the FAH re-pushes membership every keepalive beat while the PAH ambassador is
// ASSIGN (`Keepalive.tick` in session-keepalive.ts), so every push clears tracking and the fixup fires. The machine id is
// right: the fixup only fires when sub_17F4640 found 1C:69:7A:73:78:03:0000 in the membership.
// 40662 does the same (its membership.ts also sends unk = generation) and spawns, so this is noise, not
// the blocker. Retail's value of [1] was not checked.

## Also wrong for betath (not the spawn)

// - sensor-sense.ts `leadsWithByte: true`. The 643B update parses to 0 rows with it; without the byte it
//   gives 29 clean rows starting at binder 0x40AEBF90 Player #4 then 0x8CC31436 squads/actors (first
//   byte a8 = initial 1, 0, row 1, then the bundle). The host never sees the client's player/squad senses.
// - start-request.ts FireteamMember `machine: rsat.bytes(6)`: the log's account 0xe456000000010000 /
//   character 0x0001000000020000 are the join's 0x100000001 / 0x200000001 read 2 bytes late, so the
//   machine is 8 bytes (6 + 2 zero). Hence "start req matches no registered player, using anonymous
//   hosts". The trailing stream machine (`StartRequestStream.machine`) is probably 8 too (unverified).

## Fixes

// 1. sensor-auth.ts `lifetimeStates` -> `{ active: 2, ended: 6, none: 0, pregame: 0, shift: 0 }`; `encodeLifetimeAuth` default `state = 2`.
// 2. membership.ts `unk` -> keep `unk` constant for the host's life (1), not the generation (cosmetic).
// 3. sensor-sense.ts `leadsWithByte` -> `false`.
// 4. start-request.ts FireteamMember `machine` -> `rsat.bytes(8)`.
