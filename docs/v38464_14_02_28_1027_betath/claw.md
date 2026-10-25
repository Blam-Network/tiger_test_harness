# CLAW and the other debug button combos (betath 38464)

// 2026-10-22. PS4 pre-alpha 38464.14.02.28.1027.betath, IDA `eboot-ida.elf` (headless :13345,
// IDA address = guest VA). Read-only RE. Evidence tags as in start-menu.md: [C] code; key compares
// checked in disassembly (0xDEA913-0xDEAC99, 0xDEA770-0xDEA830) [C, disassembly].

## Where

// sub_DEA6C0 runs once per frame, unconditionally (called at 0x840D97 in the main update).
// It walks controllers 0..3 (sub_DEBA80, table dword_254AAF0 = 0,1,2,3) and reads each one's
// 192-byte input state from sub_64BC10: byte_2BEBC50 + 912*bank + 32 + 192*controller (returns
// null if the controller is not connected, or the zeroed unk_2BEC940 while word_2BEBC51 is set).

## State bytes (confirmed against the writer)

// sub_64B090 -> sub_64D320 -> sub_64D130 -> sub_64CD40 fills the same address (rcx =
// base+0x20, +0xC0 per controller at 0x64D361) from ScePadData [C]:
//   +4 L2, +5 R2  frames-held counts from the analog bytes PadData+8/+9 (hysteresis, not the bits)
//   +6.. +20      frames-held counts for qword_243DE30 entries 0..14 (byte = slot + 4):
//   +6 up  +7 down  +8 left  +9 right  +10 OPTIONS  +11 touchpad  +12 L3  +13 R3
//   +14 cross  +15 circle  +16 square  +17 triangle  +18 L1  +19 R1  +20 touchpad
// Slot order is the Halo/Destiny controller-button order (LT RT up down left right start back
// LS RS A B X Y LB RB). Non-zero = held.

## Gate and edges

// Every combo needs L3 and R3 held (0xDEA921/0xDEA92B). Only then: L1 down sets
// byte_31482A0[c]; the first frame L1 is up again is the "L1 tap" edge. Same for R1
// (byte_31482A4). Nothing is time based: no hold duration, the action fires on the release frame.
// L1/R1 and +20 are never part of the "nothing else held" tests.

## CLAW (bug: claw id)

// Hold L2 + R2 + L3 + R3 + one of square/circle/triangle; no d-pad, OPTIONS, touchpad or cross.
// Tap L1. dword_31482B0[c] counts the taps while the combo stays held (0xDEAC71):
//   tap 1: ++dword_3148270 (claw id, reset to 0 at 0xDEA474), log "bug: claw id=%d" (level 5),
//          then for sub_852420(0..1, 0..1) (activity client connections off qword_2EBAA98)
//          sub_17E8CB0(conn, id) -> sub_17D2C00 = activity_client_send_message, message 41 =
//          bug_claw (web-tiger-day0 messages.ts BugClaw = 41), payload the 4-byte claw id.
//   tap 2: nothing.
//   tap 3 (0xDEA776, new count == 3, counter reset):
//          triangle held -> `mov dword ptr ds:1, 2Ah` at 0xDEA7D6: deliberate crash (crash dump).
//          else sub_711220(circle held) -> sub_710EA0("@N", type) "bug:
//          create_and_upload_bug_files_helper": type 0 (square) = "bug_now", type 1 (circle) =
//          "bug_now_full" (switch at 0x710D13). Skipped if unk_2E4AD00 (bss, true name
//          unknown) is set, or "bug upload in progress"/"bug creation pending".
// The tap counter is cleared on any frame where L3+R3 are held but the rest of the combo is not
// (0xDEAA64, 0xDEAB3B, 0xDEADDC). Releasing L3 or R3 first skips the controller and keeps it.
// No screenshot is taken by the claw tap itself; files come only from the third tap.

## Other combos in the same function

// L3+R3, L2, R2 and d-pad up not held, at least one of down/left/right/OPTIONS/touchpad/cross/
// circle/square/triangle held, tap L1: steps the network debug overlay one page:
//   off -> g_network_channel_manager_status_lines (unk_31A847E) -> g_network_session_status_lines
//   (31A8480) -> g_network_session_members_status_lines (31A8481) ->
//   g_network_activity_instance_lines (31A8484) -> g_network_transition_lines (31A8485) plus the
//   "SM: %s" line flag 31A8483 -> g_network_session_matchmaking_status_lines (31A8591) ->
//   g_network_status_session_qos_status_lines (31A8592) -> off.
//   Names from the registrations at 0xF4F6C8-0xF4F9DB; drawn at 0xF51693, 0xF51DC2, 0xF54066.
//   Circle alone also calls "Debug.Insert Saved Film Marker" (nullsub_507/508: compiled out).
// L3+R3+L2+cross, R2 and everything else up, triangle up: R1 taps count dword_31482D0[c]
//   (never reset); exactly the 3rd sets unk_2A40C60 (sub_F4FD60, network globals) +9/+10/+11 = 1.
//   Meaning true name unknown; +11 skips an elapsed-time check at 0x1055AA8 (looks like a
//   timeout suppress). L1 taps in this state only cycle dword_31482C0 (no other reader).
// L3+R3+L2+R2 and nothing else: if unk_2EA8993 (bss, default 0, no code writer) is set, copies
//   it to unk_2EA8992, which the main loop (sub_7B7C00) turns into sub_9D7170 "reports_dump_all".
//   Off by default.

## Gating

// input_disable_claw_button_combos is an hs function in this build, and a stub (hs-functions.md,
// Stubs list): it cannot turn the combos off. sub_DEA6C0 checks no debug flag on the CLAW path.
// debug_enable_easy_weapon_down_claw and g_cortex_allow_memory_claw have no code references
// here (string only). So CLAW works by default as long as the pad state reaches sub_64BC10.

## d1port input (d1port/src/runtime_pad.c)

// L2/R2 must come through the analog bytes: keyboard R/F and Xbox LT/RT both set l2/r2 (255 or
// the axis), so they work.
//   PS4         keyboard (window not holding the mouse)   Xbox 360 pad
//   L2 / R2     R / F                                     LT / RT
//   L3 / R3     Z / C                                     LS click / RS click
//   square      E                                         X
//   circle      Left Shift                                B
//   triangle    Q                                         Y
//   L1          1                                         LB
//   R1          3                                         RB
//   cross       Space                                     A
// OPTIONS (Enter / Start) is not in any combo; options_as_touchpad does not matter.
// CLAW: hold R F Z C E, tap 1 (pad: LT RT LS RS X, tap LB). Six keys at once may ghost on some
// keyboards; the pad is safer. Never use triangle (Q / Y) with three taps: it crashes the game.
