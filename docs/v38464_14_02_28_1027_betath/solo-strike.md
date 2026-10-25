# Solo strike launch (Den of Devils, cosmo_portal_1) in 38464.14.02.28.1027.betath

// 2026-10-22. Headless IDA on eboot-ida.elf (:13345, IDA address = ELF vaddr). Key compares read in
// disassembly, not only Hex-Rays. Tag bytes read with gibbon v38464_14_02_28_1027_betath from
// D:/Games/ps4/betath-38464/packages. Evidence run: server logs/start-betath-20261022-191013.out,
// client reports 20261022_013709_orb_tiger (debug_full.txt).

## What happens

// Director launch of activity 238 (cosmo_portal_1, level 6). Client log:
//   01:48:45 Entering state 'setup:matchmaking' / Started matchmaking for activity '238'
//   01:48:45 Gather chance for party size '1' is '0.13' / 'PRIVATE activity' Starting search
//   01:49:00 Current phase expired, moving to new phase '1'            (15 s, hopper phase timeout)
//   01:49:29 Starting to advertise due to searching in desperation / Starting to gather
//   01:49:36.. 01:54:26 search returns 1 session = "found local machine [craftycodie] ... ignoring"
//   01:54:30 Requested matchmaking cancel -> 'matchmaking_backout' -> orbit   (Codie backed out)
// Never logged: "Ready to start criteria met." Server side was correct throughout: createSession,
// findSessions 0 results, then 1 (the client's own advertised session, which it ignores).

## Why: the strike hopper wants 3 players, and that is client content

// Matchmaking necessary? Tick of world_controller state setup:matchmaking, sub_8C66D0 (state table
// 0x2AC8D68): rbx = sub_9D8FB0(activity) = activity definition + 64 (gibbon s_activity_matchmaking);
// 0x8C672B mov r12b,1 / 0x8C672E cmp [rbx+10h],-1 -> necessary iff the row has a hopper tag.
// Not necessary -> "Matchmaking not necessary for activity '%d'" (0x24DFBBC) -> in_world. That is the
// patrol path (239, hopper -1). Every cosmo_portal_1 row has one: 183-186 -> 0x808F63D4, 238 -> 0x808F63D8.
//
// Configuration: sub_F8FE70 builds the matchmaking configuration (dump sub_F902A0) from
// c_investment_matchmaking_data_stack_accessor (sub_9D9270(acc, activity, phase); phase <= 1).
// Hopper tag offsets (tag base = the size field, same convention as the X360 alpha doc):
//   +0x8C -> cfg+64 "gather start threshold seconds" (sub_9D9430)
//   +0x90 -> cfg+60 "gather start game_early seconds" (sub_9D9470)
//   +0xA8 phase time out seconds (sub_9D96F0), +0xAC phase mode (sub_9D93F0)
//   +0xB0 + 72*phase -> cfg+120 "minimum player count" (sub_9D94F0, 0x9D9543 mov eax,[rbx+rax*8+0B0h])
// Hopper 0x808F63D8 (activity 238): +0x8C 2, +0x90 30, +0xA8 15, +0xAC 1, min players phase 0 = 3,
// phase 1 = 3, team block zero (picker mode 0, no teams). 0x808F63D4 (183-186): same mins (3/3).
// The 15 s phase timeout matches the log (01:48:45 -> 01:49:00), which pins the offsets.
// Activity block (gibbon field names): min_players 1, max_fireteam 3, max_players 3 for every
// cosmo_portal_1 row; block+8 = cfg+124 max player count.
//
// Ready to start: sub_8C7BB0, 0x8C7BDD mov ecx,[r14+1C50h] (live player count of session 1) /
// 0x8C7BE4 cmp ecx,[rbx+78h] (cfg+120) / 0x8C7BEB jl -> not ready. Caller sub_8C6E20 only gets
// there when the composition check sub_F8D2F0(0) is 17 "success" (names 0x2B04A40); then lockdown
// sub_8C7CF0: start at once if count == cfg+124 (0x8C7D1E cmp eax,[r15+7Ch]), else after cfg+60 * 1000 ms (0x8C7D42).
// Phases only go 0 -> 1 (0x863BC0 phase mode 1, 0x863BCA current phase 0, 0x863C07 timeout); phase 1
// is also min 3, so a solo player never becomes ready. No timeout path starts with fewer.

## Nothing the server can send changes this

// - The minimum is read from the hopper tag only. sub_F8FC80 (the other writer of the configuration)
//   sets preferences/NAT/locality, nothing about player counts. No hs or registry override found:
//   owc_matchmaking_enable (0xD91F00 -> sub_865740) sets a byte on the matchmaking manager, not the
//   minimum.
// - The live count (session +0x1C50) is real peers in the client's own networking session. Demonware
//   findSessions can only hand the client sessions to join; joining one needs a peer that answers the
//   session join protocol. Faking peers is not a server feature.
// - EngineConfiguration (signon / BAP client_config field 3) carries only the content block.
// - The activity row is the client's director choice; every strike row has a min-3 hopper, and every
//   launch path into the activity goes through setup:matchmaking.
// - The investment level gate (sub_1794400 / sub_1789C80) passed: the log reached setup:matchmaking.
// Same finding as the X360 alpha (web-tiger docs/crucible-hoppers.md: portal hopper 808E3915 min 3 of 3),
// where solo strikes ran only with a Xenia patch.

## Client patch that would allow it (described, not applied)

// Option A, keeps the real matchmaking path (preferred; equals the alpha "hopper min players = 1"):
// sub_9D94F0 returns 1 for every hopper. Format of native/guest/betath-38464.xml (Address = vaddr +
// 0x400000):
//   <Line Type="bytes" Address="DD9543" Value="B8010000009090" Original="8B84C3B0000000"/>
//   mov eax,[rbx+rax*8+0B0h] -> mov eax,1; nop; nop
// Effect: ready as soon as composition succeeds, then the 30 s lockdown wait (hopper +0x90; solo never
// reaches max 3), then activity host setup for 238. Side effects: the director's player-count display
// (sub_E50C60, 0xE51BB9 -> +308) shows 1; PvP hoppers also become min 1, and a teams hopper would
// still fail the team picker solo (alpha doc section 5).
// Option B, skip matchmaking for every activity (the alpha's "Skip orbit matchmaking"):
//   <Line Type="bytes" Address="CC672B" Value="4530E4" Original="41B401"/>   mov r12b,1 -> xor r12b,r12b
// The exit function sub_8C65B0 (0x8C661A) still sees the hopper and calls sub_878510; untested.
// Then: python3 native/guest_patches.py <manifests> --eboot native/out/eboot.elf --out
// native/out/patches-betath.bin, restart the client. No server change or restart is needed.

## Open

// - Not checked: how web-tiger-day0 starts the AH for activity 238 once matchmaking hands over.
// - findSessions arms the PAH ASSIGN->REVOKE timer on every orbit search (40 times in this run); the
//   pending revoke is still set when the next activity starts. Unrelated to this block; watch it.
