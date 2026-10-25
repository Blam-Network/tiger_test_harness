# Hard wipe (alpha 36735.13.12.02.1953)

// 2026-10-20. Alpha tiger_release_internal_unlock.xex, IDA :13338 (server_health checked). Retail
// shapes from default_ttk_231.xex on :13341 (:13337 was a Halo db that day). Key compares were read
// in the listing as well as the decompiler (marked "disasm"). Guesses are marked as guesses.
// The activity host's own wipe logic is not in the xex: the `hard_wipe` HaloScript function
// (name @0x820AF064, descriptor @0x820BF01C) uses the generic unimplemented stub sub_82DCC0D8,
// and none of the strings are host-side. So we only see what the client does and what it expects.

## 1. Two separate pieces

// a) The wipe handshake: a host cookie in membership replication and a client echo in
//    ClientAuthoritativeData. This is what actually puts up the wipe screen and respawns the player.
// b) HardWipeGlobals (row type 34): just a countdown the HUD shows. It does not start or end a wipe.

## 2. Host side: 808044CB, inside PahRegions

// ReplicateMembership 808044E0 (.schmr 0x824E48CC): pahRegions 808044DD at +0x21C8 (optional);
// PahRegions (0x82408E6C): table +0, 808044CB at +0x1680, teleport 808044D2 at +0x1684.
// 808044CB (0x82390E84, 3 bytes, our `Unknown808044CB`):
// | off | wire | meaning |
// | +0 | u8 (kind 7) | cookie: id of the wipe the host is running |
// | +1 | u8 (kind 7) | completed cookie: host is idle when +1 == +0 (sub_83699638, disasm 0x83699638) |
// | +2 | i8 3 bits bias 1 (kind 3) | host state; the client only checks == 3 = "complete" (disasm 0x829EC430) |
// Host states 0..2 are never read by the client; what Bungie used them for is unknown.
// The client keeps the decoded copy at activity client +0xAD0 +0x108 (+0x3848 = this struct).

## 3. Client side: 808044C8 in ClientAuthoritativeData

// 808044DA (0x8255D4AC, 0x190 B): identity +0, transition +0xB0, hard wipe 808044C8 +0x168,
// teleport 808044CF +0x174. Names come from the client's own log format @0x821C1330
// ("hard_wipe:[hw_state %d][hw_current_cookie %d][hw_last_cookie %d][hw_start_time %d]"),
// printed by sub_8372EEA0 (loads 0x168/0x169/0x170/0x16C, disasm 0x8372EEE8-0x8372EF20).
// | off | wire | field |
// | +0 | i8 3 bits bias 1 (kind 3) | hw_state 0..3 |
// | +1 | u8 | hw_current_cookie: host cookie being handled |
// | +4 | i32 bias 0x80000000 | hw_start_time: activity tick the client saw the new cookie |
// | +8 | u8 | hw_last_cookie: last wipe the client completed |
// Our schemas/client-auth.ts has unknown0 as u8 size 3 without the bias: decoded states come out +1.
// Built every update by sub_8291B4D0 (copies last state from activity client +0x53D0, then calls the
// state machine). The struct is zeroed when an activity client is created (sub_836120E8 ->
// sub_83602D58 -> sub_8372ECE0), so every new AH connection starts at cookie 0.

## 4. Client state machine, sub_829EC1A0(world, host 808044CB, client 808044C8)

// Every client-auth update (disasm 0x829EC1AC-0x829EC5CC):
// - client.last == host.cookie: nothing (idle).
// - client.current != host.cookie: new wipe. current = cookie, state = 0, start_time = now,
//   sub_82E16220 opens the `wipe_screen` CUI screen (hash 0x80EEFD77 = fnv1("wipe_screen")).
// - state 0: log "initiating hard wipe.  displaying ui", state = 1.
// - state 1: once now >= start_time + 3.0 s (flt_821BCC6C, sub_83645648 seconds -> ticks):
//   log "Finished displaying hard-wipe ui.  Waiting for activity host to signal completion.", state = 2.
// - state 2: when host.state == 3: sub_82D6B348, sub_82E16168 (closes the wipe screen, CUI layer
//   bit 29), log "Activity host signaled completion.  Completing hard-wipe.", state = 3.
// - state 3: log "Hard-wipe complete.", sub_82931510 bumps last (+1, wrapping 255 -> 1, never 0).
//   State stays 3 until the next cookie.
// So the cookie must go up by one each wipe, skipping 0, or last never meets it and the UI repeats.

// sub_82D6B348: for each local player (player datum +0x5D8 = this machine) with no unit
// (+0x5FC == -1), set player +0x14 bit 0. The spawn update sub_8294DC60 reads that bit: it skips
// the respawn delay at +0x18 (disasm 0x8294E210) and the soul/revive path (0x8294E49C), and goes
// straight to sub_8294CA70 (create player), which clears the bit again (0x8294D84C). So: forced
// respawn for every dead local player. Living players are not touched. The spawn point then comes
// from the usual resolver chain (table 0x8394FB60, sub_8294BCD8..sub_8294C140); nothing in the
// wipe code picks a checkpoint.

// World-controller UI: sub_82A4DE68 picks UI substage 34 (true name unknown; same stage group 6
// as in-game 33, sub_82A4CBD8) while sub_82A4C7D8 sees any local client not idle, where idle =
// host idle (completed == cookie) and client current == last (sub_829EC060). So the host must
// also set completed = cookie at the end, or the client stays in substage 34.

## 5. HardWipeGlobals, row type 34, auth 808005AB

// 808005AB (0x825312A4, 0x1C B): one field, the 80804520 countdown (0x82315B1C, 7 fields:
// running, min, max, elapsedBase, remainingBase, epoch, rate f32).
// It is the only 0x1C auth in .schmr that is just that countdown.
// Client class (handler block 0x82040F84, 3 records, registered in sub_828D4AA8 at 0x828D5598):
// init sub_835C28E8 (zeroes entity +0xF4), a nullsub, receive auth sub_835C2998 (copies 7 dwords
// to entity +0xF4, disasm 0x835C29D0 `li r9, 7`). No getters, so scripts cannot read it.
// Only reader: sub_829EC128 finds the sensor with sub_8361DE10(34, 0) (disasm 0x829EC154
// `li r3, 0x22`), and sub_82A95DE0 fills HUD data +0xAEC with {u8 running (entity +0xF4),
// f32 remaining seconds (sub_835C2910 -> sub_83725888), f32 tunable 0xF50D3FBE (default 2.0,
// sub_83699650)}, called from the HUD update sub_82A97C68 next to the Timer bars.
// A CUI component (factory sub_82ECC238, type hashes 99FB91B7/35EF40BB, true names unknown;
// update sub_82EC8C30) resets two values to (-1, 0) each frame, and while running sets them to
// remaining * 1000 and tunable * 1000 (ms). It also binds a player (sub_82F8DDA0).
// Guess: a "wipe in N" style countdown the host runs before it bumps the cookie (e.g. while the
// whole fireteam is down). The client does nothing when it reaches 0.

## 6. Retail shapes (default_ttk_231, same ids as TU0 41375)

// Client 80800C21 (0x822644D0, 8 B): +0 i8 3 bits bias 1 state, +1 u8 current cookie, +4 i32
// start time. No last cookie. Host 80800C93 (0x822639BC, 8 B): +0 u8 cookie, +1 i8 3 bits bias 1
// state, +4 i32 (meaning unknown). Both sit where the alpha ones do (ClientAuthoritativeData
// 80800C56 +0x200; 80800BD7 unknown1).
// A countdown auth 808004A4 (0x822952C8, 0x20 B) = {bool, bool, i8 2 bits bias 1, 80800AB3
// countdown} matches the captured hard_wipe_globals rows ({u0 false, u1 toggles, u2 0, idle
// countdown {false, INT_MIN, INT_MAX, 0, 0, 0, 1.0}}). That it is type 34's schema is a guess by shape.
// TU0 also has error 104 private_activity_instance_timed_out_during_hard_wipe:
// the retail host waits for clients during a wipe, with a timeout.

## 7. What the server needs

// Idle (today): host {cookie 0, completed 0, state 0}, HardWipeGlobals countdown idle. Correct.
// To run a wipe (send ReplicateMembership on each change; pahRegions must be present):
// 1. cookie += 1 (skip 0), state != 3. Clients open the wipe screen and report state 0 -> 1 -> 2.
// 2. Wait until every member reports hardWipe {state 2, current == cookie}. Guess: this is the
//    moment to reset the world behind the screen (squads, objectives, checkpoint spawn name).
// 3. state = 3. Clients close the screen and force-spawn their dead players.
// 4. When every member reports last == cookie, set completed = cookie (host idle).
// Never send a cookie != 0 to a fresh activity client unless a wipe is meant to start.
// Optional: run the HardWipeGlobals countdown for the HUD before step 1.
// Fixes: client-auth.ts HardWipe.unknown0 -> i8 size 3 bias 1; Unknown808044CB.c is kind 3 (i8).

## Player-facing behaviour (Codie, 2026-10-21)

- Trigger: the whole fireteam is dead.
- Players see a menu (the wipe screen), then everyone respawns together at the phase start.
- They come back at the last checkpoint, not where they fell.
- Encounters and objectives reset.
- Codie thinks scripts enable and disable hard wipe. Unconfirmed: no alpha script or schema has a wipe
  native, and alpha story_common never calls anything on hard_wipe_globals. Leads: the 2.3.1 row
  state 808004A4 {bool, bool, 2-bit, countdown} (an enabled flag?) and the 2.3.1 incident `hard_wipe`
  (C446E77C, registry 80A60DA0).

## 2.3.1 captures (24 runs, 2026-10-21)

- The story_common row `hard_wipe_globals` (type 34, auth 808004A4 {u0 bool, u1 bool, u2 2-bit,
  u3 countdown 80800AB3}) is one per session.
- **u0 is very likely "hard wipe enabled", set by the phase scripts.** It changes in 16 of 17 mission types
  (never in act_cosmo_m0_highway).
  - On: at the first combat objective's phase start (17/17 within 0.4 s of a Lifetime phase change).
  - Off: when the last kill or boss objective ends (18/19).
  - 34/36 flips are within 0.45 s of a host `insertion_point` incident.
  - Darkness zones do not touch it.
- u1 flips with every bubble swap: false at the phase-bubble change, true 0.3-1.3 s after the
  `slice` marker (79 each way, all missions). Meaning unknown.
- u2 changed once: Gardens Spire boss kill, 0 -> 2.
- u3 countdown is always idle {false, INT_MIN, INT_MAX, 0, 0, 0, 1.0}.
- No wipe in any capture: host cookie 80800C93 always {0,0,0}, client 80800C21 never present, `hard_wipe`
  incident never seen. All 10 deaths happened with u0 false and ended in self-resurrection about
  6.3 s later.
- The host sends an `insertion_point` incident at every phase start (298 messages). Our
  `insertion_point` native is a logged no-op (implementation-gaps.md).
- Teleports use a host/client state handshake (host 80800BD7 [2], states 0->1->2->3->0, client echo
  in 80800C56 [3]): 29 times, each at a phase change. A wipe plausibly reuses it; unproven.
- Raw data: session scratchpad `hardwipe\hw_changes.tsv`.

## TU0 handshake, insertion points, death signals (2026-10-21, second pass)

// IDA: day0 TU0 default.xex (41375) :13340, TTK default_ttk_231 :13341, alpha :13338 (server_health
// checked each). Compares marked "disasm" were read in the listing. TU0 ids from schmr_tu0.bin.

### TU0 client machine sub_826ADE20(world, host 80800C93, client 80800C21) (TTK: sub_8267B9E0, same code)
// Host 80800C93 {+0 u8 cookie, +1 i8 3b bias 1 state, +4 i32}; client 80800C21 {+0 state, +1 cookie, +4 start}.
// The client reads only host +0/+1 (disasm 0x826ADE34-0x826ADEB8). No completed/last cookie; the cookie is
// copied, never compared. "Host active" = state != 0 && state != 4.
// - client 0, host active: state 1, cookie = host cookie, start = activity time, fade to black (1.0 s).
// - 1 -> 2 at once (sub_82545930(player+0x54, 1), UI vt+0x4C; true names unknown).
// - 2 -> 3 when the fade reaches 1.0.  3 -> 4 when now >= start + 1.0 s + tunable 833DB2D4 (default 3.0 s).
// - 4 -> 0 when host state == 4 (disasm 0x826AE0A4 lbz 1(r29); cmplwi 4) AND the Lifetime (type 16) state is 3
//   or 4 (sub_831AAC60): sub_82973160 asks a spawn for every local player with no unit (sub_826A1F90(p, 0, -1),
//   disasm 0x82973244 li r4,0 = the initial-spawn reason), fade back in.
// - Idle (sub_824DA290, disasm 0x824DA2A4-C4) = host state 0 AND client state 0. The UI picker sub_824CA390
//   shows substage 43 (UI mode 28 = wipe_screen 80EEFD77) while any client is not idle, so the host must go
//   back to 0 or the client stays on the wipe screen. A spawn gate (sub_826A5200, true name unknown) is false
//   while not idle (sub_826ADD48). The host i32 is never read by the client (host bookkeeping; send 0).
// - Ids confirmed: 80800C93 = ReplicateMembership 808009ED.pahRegions (80800BD7) [1] at +0x21C0; 80800C21 =
//   ClientAuthoritativeData 80800C56 [2] at +0x200 (sub_82420480 = activity client +0x66B8). Teleport pair
//   80800BF9 (+0x21C8) / 80800D9E (CAD +0x208) uses the same idle test (substage 19).
// Host must: {c, 0} idle -> {c+1, 1} start (any 1..3; wire = value + 1) -> wait for every client's CAD
// hardWipe state 4 (screens black) -> reset the world, move everyone -> {c+1, 4} (Lifetime state 3/4) ->
// wait for every client 0 -> {c+1, 0}. Alpha section 4 (cookie + completed cookie) does not apply to TU0.

### insertion_point (host incident, 2.3.1 and TU0 metadata 8080048E, 27 B, 212 bits + 4 pad)
// 8080056F header {u32 incident number, 808009B8 {i8 3b bias 1 submitter kind = 2, i64 = AH session id}},
// u64 = AH session id again, i16 bias 0x8000 = activity id (161 act_cosmo_m0_highway, 299 cosmo_portal_1),
// 80800985 {u32 = fnv1(phase name), bool}. 298 of 298 decode clean. Phase hashes checked: cosmo_m0_phase00_
// highway 65215BE6 .. phase04_outro 439D9D22, strike phase00..phase07 45BC13AE.. (same names = same hash).
// bool: false at the phase start, true once the fireteam is in the phase's area (often the same frame;
// cosmo breach 0.66 s after the slice crossing). The first phase of a session may send only true.
// hard_wipe_globals u1 follows it: u1 true 0.0-0.9 s after a true incident (62/79), false with a false one
// (53/79); the rest are bubble swaps without a phase change. Same TU0 struct, so day0 can send it as is.
// Client side: no consumer touches spawning. Alpha (type 18 = 80800D51 {player, i16, u32}) feeds only the
// generic incident listeners; the spawn transition name is set only by sub_8294ACF8 <- world-controller
// state 2 (slice-set change). Guess: telemetry / checkpoint progress, not the wipe respawn point.

### Where the wipe respawn lands (alpha code, TU0 assumed the same, medium)
// Forced spawn = initial-spawn policy (alpha player+0x14 bit0 -> sub_8294C5E0 policy 0 -> mode byte +0x22,
// 0x0F for story/portal): breadcrumbs (player trail) -> SpawnPoint rows -> LandingPoint rows -> spawn point
// named by the transition name. PvE bundles have no SpawnPoint/LandingPoint rows. Breadcrumbs are cleared
// only with a new transition name (sub_8294ACF8 -> sub_82D6D270, every slice-set change).
// So without a slice-set change the fireteam comes back on its breadcrumbs, near where it fell. For "back at
// the checkpoint" the host should run a host teleport (80800BF9) during client state 4 with the phase's start
// spawn name (spawn tags carry ch2_phase00_start, venus_strike_1_phase01 ...). 2.3.1 phase teleports use
// these: e.g. {id 2, region 112, spawn EAEC2235} at the cosmo phase00 insertion point. A teleport into the
// region the client is already in is untested (alpha logs "Cannot assign synchronization task ...").

### hard_wipe_globals (808004A4 = TU0 type 34 record +0x108) client reads (TU0)
// u0 +0x108 (sub_831A3D88) = enabled. Armed (sub_826AE1E0) = u0 AND Lifetime record +12 (guess: the phase
// bubble) == the local client's bubble. Armed swaps the respawn delay tunables (sub_8273FB68: 1F8692DE -> 11FEC628,
// fireteam 5142597A -> 7C28580C; sub_8273FC50: 6A0C99D7 -> D0FB01B3; values from the runtime options table,
// unknown), makes a player joining during Lifetime state 3 wait a respawn timer (tunable 7005EBAE,
// sub_826A2050), and feeds the HUD (sub_82443870: +69 armed, +71 last guardian standing = sub_826AE268,
// +72 = u0 && !armed && u1). Countdown HUD sub_8241CD90 reads u0 and running (+0x10C).
// u1 +0x109: only the HUD flag above. u2 +0x10A: no reader found (true name unknown).
// The client never starts a wipe itself and u0 does not stop the respawn timer. A dead solo player with
// u0 true still asks to respawn; whether he self-resurrects is the host's call (next section).

### Death and return (2.3.1 captures, all 10 deaths; TU0 Player sense 80802C30 = auth 808022A5 members)
// T: client player_died (kill family, victim identity = character id). T+0.07: sense [0] 80800540 bool [4]
// true (dead). T+0.8: host echoes it in the auth. T+5.3: sense [1] 80802619 first bool true (respawn
// request; TU0 80802619 = {f32, bool, bool, bool}, this is unknown1; 2.3.1 put a nest first, so [1][2]).
// T+6.2: host auth sets that bool and [3] (TU0 PlayerAuth.flag bool; 2.3.1 808023A5 [0]) true = grant. T+6.25: client spawns, player_spawned + self_resurrection (or
// player_resurrected / resurrection for a revive), sense clears; host clears auth [0][4], [1], [3] 1 s later.
// "Everyone dead" = every occupied Player row's sense [0][4] true. "Back" = player_spawned or [0][4] false.
// The grant is host-side in every capture (causality medium): during a wipe, do not grant.
// Scratch: hardwipe2\{inc,tele,death}.mts, ip.py (decoder), *_all.json.

## Why the player stayed dead after a wipe (TU0, 2026-10-21)

// Log logs/start-tu0-20261021-200415.out, act_venus_m09_tower, both wipes. IDA TU0 default.xex :13340
// (server_health checked). Compares marked "disasm" were read in the listing.
// Client hard wipe reports (class 21, decoded): 1, 2, 3, 4 (black), then 0 in the SAME update as the
// teleport's state 1. The host had sent the teleport and its state 4 back to back.
// After that, no Player sense ever came again: no respawn request, no spawn, still dead.
// - The wipe's 4 -> 0 asks a spawn for every local player with no unit (sub_826ADE20 -> sub_82973160
//   -> sub_826A1F90(p, 0, -1) = message 76; its handler sub_826A2638 sets player +12 bit 0 and the
//   reason at +1456, and sub_824180B0 / sub_826A5468 spawn once the gate sub_826A5200 opens).
// - The teleport machine sub_827F1040 (TU0 vtable 0x82002324, next to the wipe's at 0x82002320) asks
//   the same spawn at its own end, client 3 + host 3, but only while the wipe is idle
//   (disasm 0x827F1178-0x827F11A0: sub_826ADD48 != 0 skips sub_82973160).
// - Our teleport ended while the host still said 4, so it asked none; the spawn asked just before the
//   teleport did not survive it (true reason unknown: lost in the world swap). Armed, the respawn
//   timer gives none, and the server's "awaiting return" holds off a second wipe: stuck.
// Fix (session-host.ts): reset the phase and start the teleport while the screens are black, wait for
// the host teleport to go back to 0, and only then say 4. The wipe's own 4 -> 0 then spawns everyone
// where the teleport put them. HardWipe.noteWorldReset / returnDue hold the step.
// Also: bullshcript's reset re-arms every player trigger the reset phase or restarted encounter binds
// (fires once per arm stamp); the skiff triggers read as fired before.
// "drop #1" without its "bodies=" line after a reset is only the log's repeat filter (notePoll).
