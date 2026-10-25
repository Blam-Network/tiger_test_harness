# Activity start assert: fireteam maximum below its player count (ff 39573)

2026-10-23. PS4 ff 39573.14.04.03.1336.ff on d1port_ff. Addresses are eboot virtual addresses (IDA's; guest = 0x800000000 + address, guest patch manifest = address + 0x400000). ff was read with capstone (the ff IDA was not open); names and decompiles come from the pre-alpha twin (betath 38464, headless IDA :13345), matched by bytes.

## Symptom

Third launch from orbit in one session: `### ASSERTION FAILED: in function <unknown>, @0x8006e5d33`, state `setup:activity_session_creation`, change-world `loaded orbit`. Earlier in the session: 303 (cosmo_portal_1) played, then 151 (act_cosmo_m0_5_hangar) went to `prologue_intro_loading`, "Unable to obtain activity_name" and a KTO (`error.loading_activity_resources`; 151 has no scenario_client, and the server logged "no scenario for start activity=151"). Back in orbit, the next launch halted.

The server took no part in the third launch: after `director_enter_orbit` (log line 1523 of `logs/start-ff-20261023-210729.out`) it saw no DemonWare `createSession`, no `get_activity_host_proxy` and no start request before the crash report. The 151 launch reached the DW `createSession` in the same state, so the halt came early in `activity_session_creation`, before the activity session was created.

## Stack

| Address | Function | Betath | What |
|---|---|---|---|
| 0x6E5D33 | sub_6E5CC0 | | assert reporter (halt), trap at 0x6E8DBB |
| 0x62A9E3 / 0x62AC20 | sub_62A9D0 / sub_62ABA0 | sub_62AB70 | `assert(false)` with no message |
| 0x88FDF6 | sub_88FD40 | sub_87F170 | join controls from desired controls (the check) |
| 0x88F768 | sub_88F240 | sub_87E6F0 | per-frame join-controls update of the three sessions |
| 0x88EC63 | sub_88EC50 | | networking logic update (sub_88EC70, sub_88EF90, sub_88F240, sub_88F820) |
| 0x8717F3, 0x8502A7, ... | | | networking update, frame loop |
| 0x723B0B / 0x7240CC | sub_7239F0 / sub_723FD0 | | job system running that update as a job |

The job frames are the job worker running a job ("thread 51700 job #0/4"). This is not the 0x723CB0 job-help assert or a sibling of it: the halt is in game code the job runs.

## What the check is

sub_88F240 runs every frame. For each of the three sessions (0 fireteam, 1 posse, 2 group) that is valid and hosted here, it builds the session's `active-join-controls` parameter (session parameter 1) from its `desired-join-controls` (parameter 9, session + 0x7938 + 0x9A0) and `user-join-controls` (parameter 8, + 0x8B8). The posse's result seeds the fireteam's.

sub_88FD40(player_count, user_controls, desired, out):
- `out[0]` (maximum configured player count) = `desired[0]` (maximum player count), `out[1]` = open slots.
- clamps the two against each other, then asserts at 0x88FDF1 that `out[0] >= player_count`, at 0x88FE0D that open slots are not negative, and at 0x88FE33 that a full session has `out[0] == player_count`.
- player_count is the session's vtable slot 5 (`c_network_session` vtable 0x2B82460, slot 0x1091D50 = `mov eax, [rdi+0x1E88]`), the membership player count (betath +0x1DE8, used the same way in its "would this join overflow the session" check sub_1061730).

The halt is the first assert in the call from 0x88F763, the fireteam (session 0): the fireteam's desired maximum player count was below its player count.

## Where the fireteam maximum comes from

The setter is sub_88E4E0(session, count) (betath sub_87D9B0), asserting count < 21. Its five callers, the same in both builds:

| ff site | Betath | Session | Count |
|---|---|---|---|
| 0x88DEC9 | 0x87D3D9 | fireteam | sub_852B60: 20 or 6 |
| 0x8DECA2 | 0x8C8236 | fireteam | setup:orbit handler (entering orbit): sub_852B60, 20 or 6 |
| 0x8DF02A | 0x8C85BA | fireteam | orbit handler exit (sub_8DEFC0): the fireteam's `activity` parameter's matchmaking `max_fireteam` |
| 0x8D9776 | 0x8C335C | posse | activity_session_creation, "As PS HOST, setting activity session-parameters" |
| 0xFE9DB9 | 0xFC3679 | from caller | matchmaking gather, "opening group to joins" |

Leaving orbit for an activity, sub_8DEFC0 reads the fireteam session's `activity` parameter (+0x790), the activity definition's matchmaking struct (sub_A0B3E0: definition + 0x40, gibbon `s_activity_matchmaking`) and sub_A0BBD0 returns its `max_fireteam` (+4), capped at 6 but not raised. The next frame's join-controls update compares that maximum with the fireteam's player count.

A solo fireteam (one user signed in, `PEER:[1]` in the KTO bucket) has player count 1, so the maximum was 0. ff's activity table (309 rows, read with gibbon over `D:/Games/ps4/ff-39573/packages`) has one row with `max_fireteam` 0: **235**, min 0 / fireteam 0 / max 3, type 16, no name, betath string "Book Three", node D0.1 (`b15e92cf`) of the debug destination 0x0248BE86. Every D0 node has a last state row `4` with no requirement, and 235 has no launch, join or visible flags, so the server's unlock policy cannot hide or lock it.

The game's own launch check, sub_A0DB90 (betath sub_9DB710, `networking:investment:activity_start_status: Fireteam has a suitable number of players (MIN=%s <= %d <= MAX=%s)`), reads a `max_fireteam` of 0 or less as "UNSPECIFIED", so it lets 235 launch. The orbit exit does not, and sets the fireteam maximum to 0.

Not confirmed: which node was launched. Neither log names it. If it was not a debug destination node (every D2 node's activity has `max_fireteam` 3, Tower 6), the fireteam's player count must have exceeded 3, which nothing in the logs shows; the KTO bucket after 151 shows one peer. Ask Codie which node he picked.

## Fix

Client patch (in `staging/d1port_ff/native/guest/ff-39573.xml`, "unspecified fireteam size keeps the orbit maximum"): the setter's range check at 0x88E515

```
cmp r14d, 0x15 ; jb 0x88E522 ; xor edi, edi ; call assert     41 83 FE 15 72 07 31 FF E8 7E C6 D9 FF
```

becomes

```
lea eax, [r14-1] ; cmp eax, 0x13 ; ja 0x88E598                 41 8D 46 FF 83 F8 13 0F 87 76 00 00 00
```

0x88E598 is the setter's own exit (stack guard, epilogue). Counts 1-20 are set as before. 0 now leaves the maximum the orbit set (6 or 20), as the launch check's "UNSPECIFIED" means. Counts above 20 are skipped instead of asserting; no caller passes one. Nothing jumps into the replaced bytes. Built with `guest_patches.py guest/ff-39573.xml --eboot out/eboot.elf --out <scratch>`: 6 writes, Original matched. `out/patches-ff.bin` was not rebuilt (game running).

With the patch, launching 235 gets past `activity_session_creation` and reaches the server, which has no scenario for it (no scenario_client), so it ends in a KTO like 151 did. No server change: nothing the server sent reaches this check.

To verify, rebuild `patches-ff.bin` and launch D0.1 from orbit: before the patch it halts at 0x8006e5d33, after it the server logs `start req ... activity=235`.
