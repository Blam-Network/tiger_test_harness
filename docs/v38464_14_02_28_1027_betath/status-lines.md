# Status lines (network debug overlay) in betath 38464

// 2026-10-22. PS4 pre-alpha 38464.14.02.28.1027.betath, IDA `eboot-ida.elf` (headless :13345,
// IDA address = guest VA). Read-only RE plus read-only memory reads of the running client.
// Question: the L3+R3 / L1 network overlay page flags flip (claw.md), but nothing is drawn. Why?

## Answer

// The status lines are built and walked every frame, but the call that draws each line is a
// compiled-out stub: nullsub_352 (0xBE2560, a lone `retn`). Nothing in init.txt, hs or the
// renderer can bring it back; only a code change can.

## Pipeline

// Registration (0xF4F690..0xF4F9DB, init code with no IDA function): each g_network_* block is
// a name pointer + N lines of 312 bytes + a "next line" index. sub_15EDE30 clears the lines and
// links each into the global status line list (sub_15ED2E0; list head qword_3BC5870, tail
// unk_3BC5868, links at line +296/+304). sub_15EDF00 stores the page flag pointer at line +272
// (e.g. unk_31A8480 for g_network_session_status_lines at unk_31BFD78, 150 lines).
// Line layout: +0 text (256), +256 color, +264 flags (1 blink, 2 hidden, 4 one-shot), +268 alpha,
// +272 bool* enable, +280 alternative enable, +288 invert.
// Producer: 0xF51640 (called from sub_F505A0 at 0xF50A17) tests each page flag (0xF51693,
// 0xF51DC2, 0xF5336C, 0xF53667, 0xF5401F, 0xF54066, 0xF5408F), resets the block's index
// (sub_15EDF60) and fills lines through sub_1D9EAC0 (next line) + sub_1D9DCD0 (printf).
// Renderer: sub_15ED9E0, registered by sub_15ED930 (from sub_DB4490) via sub_BE09F0 as the
// status-lines callback unk_2EFDBB8. The debug render pass sub_BE40B0 calls it at 0xBE43A9 when
// bit 1 of its mode (a6 >> 1) is set; sub_C022A0 sets that bit for views with flag 0x20.
// sub_15ED9E0: sub_C000F0 gate (returns 0, so never skipped); walks the list from unk_3BC5868;
// a line shows if its enable flag (xor invert) is true and text[0] != 0; counts shown lines in
// dword_3BC857C; scroll offset dword_3BC8578; draws "<Scroll Down with Back + Left Stick>" when
// more than 20. Every draw is `call nullsub_352` at 0x15EDB55, 0x15EDD15, 0x15EDD8F
// (confirmed in disassembly: rdi = &color, rsi = text, xmm0 = x 0.0390625, xmm1 = y / 720,
// xmm2 = scale 0.6; all normalized screen units).

## Runtime proof (2026-10-22, read-only ReadProcessMemory, flag page 2 on)

//   unk_31A8480 = 1; dword_3BC857C (lines shown last frame) = 20 on every sample;
//   unk_2EFDBB8 = 0x8015ED9E0 (the callback is installed);
//   g_network_session_status_lines index = 19, line 0 "Thu_10222026_051821_000001@orb@craftycodie@PS4",
//   "network port: 3074", "Reported NAT type: moderate", "JQs: FT: u@5, POSS: none, ...",
//   "Ctrlr 0: craftycodie", "QOS - POSSE - [DIS] GROUP - [DIS] GROUP TARGET - [DIS]".
// So the combo, the producer, the pass and the walk all work; the text just goes to a `retn`.
// Script: scratchpad peek-statuslines.ps1 (session 128c5104).

## The live debug string path

// sub_BE2380 (printf, 28 callers e.g. game_camera_pos/cascade text in sub_C7CC80) -> sub_BE2570
// (text in 94-char chunks, x advanced per chunk) -> sub_BE2030: takes a slot from the debug
// primitive pool unk_2EFDB80 (sub_BE1E10, spin lock dword_2EFDBA0; 120 slots of 0xD0), type 19,
// color at +152, x/y at +0x10/+0x14, scale*16384 at +24 (asserts scale < 4.0), lifetime 2
// (sub_1B3C130). sub_BE2780 builds the per-frame handle list (draws lifetime >= 2, frees at 0);
// sub_BE40B0 -> sub_BE3E80 draws type 18/19 with sub_CAE310 (built-in debug font metrics,
// word_2A20E50; state unk_30FB1B0 was populated at runtime). No font tag lookup on this path.
// sub_BE2570 has the same ABI as nullsub_352 (rdi = int* color, rsi = text, xmm0 x, xmm1 y,
// xmm2 scale) and sits right after it (nullsub_352 + 15 bytes of padding = 0xBE2560..0xBE256F).
// nullsub_352 has exactly those three callers (the 0xBE2556 xref is padding fall-through).

## What does not work

// - init.txt / hs: status_lines_enable/disable are gone from the hs table; status_lines_dump's
//   evaluate at 0xD97540 is the 3-instruction stub (mov edi, esi; xor esi, esi; jmp sub_DA8D20),
//   hs-functions.md lists it as implemented because IDA folds it into sub_D97220. No hs global
//   or init key touches nullsub_352, sub_C000F0 or the callback.
// - The renderer: the text never reaches the GPU, so no d1port gpu change can show it.

## Making it visible (describe only; not applied)

// Guest patch, debug-only, in native/guest/betath-38464.xml (Address = IDA + 0x400000):
//   <Metadata Name="D1 betath: draw status lines (debug)" isEnabled="false" ...>
//     <Line Type="bytes" Address="FE2560" Value="EB0E" Original="C366"/>
// `jmp short 0xBE2570` turns nullsub_352 into sub_BE2570, so each status line becomes a debug
// string queued in the pool and drawn by the next frame's debug pass (lifetime 2: one frame
// late, one frame long, same as every other debug string).
// Equivalent: retarget the three call rel32s (0x15EDB56, 0x15EDD16, 0x15EDD90) to 0xBE2570.
// Risks: the pool has 120 slots; a 20-line page uses 20-60 (strings over 94 chars take more).
// Long pages (session members, 150 lines) can run it dry: lines drop and "primitive cache
// exceeded (%d)" is drawn. Strings queue from inside the render callback; the pool is lock
// protected (dword_2EFDBA0), but this ordering is not how Bungie shipped it, so test once.
// Unverified: that type 19 primitives actually show in d1port (no other debug text was seen on
// screen; 3 pool slots were live, types not read before the client exited).
