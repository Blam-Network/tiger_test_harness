# Start menu (character menu) does not open (betath 38464)

// 2026-10-22. PS4 pre-alpha 38464.14.02.28.1027.betath in d1port_betath against web-tiger-day0.
// IDA `eboot-ida.elf` (headless :13345, IDA address = guest VA; live guest = 0x800000000 + IDA addr).
// Evidence tags: [C] code (decompiler checked against disassembly where noted), [O] live read of the
// running client (read-only ReadProcessMemory), [L] game/client logs.

## Which button opens it

// One path only. sub_EEC4D0 is the start menu's input handler (strings "ui:start_menu: ...").
// Its only caller is the ui message loop sub_DFDFA0 (0xDFE14E). The open routine sub_EEC9F0 is
// reached only from sub_EEC4D0 (0xEEC998) and the unreferenced wrapper 0xEEC9E0 (no call, lea,
// reloc or raw pointer to it anywhere in the eboot) [C].
// sub_EEC4D0 first test: message type == 13 (button pressed) && ui button == 12 [C].
// Button chain, all read from tables/switches in the eboot [C, disassembly]:
//   scePadReadState bits -> sub_64CD40 table qword_243DE30 (15 dwords):
//     0x10 up, 0x40 down, 0x80 left, 0x20 right, 0x8 OPTIONS, 0x100000 TOUCHPAD, 0x2 L3, 0x4 R3,
//     0x4000 cross, 0x2000 circle, 0x8000 square, 0x1000 triangle, 0x400 L1, 0x800 R1, 0x100000 TOUCHPAD
//     -> controller slots 2..16 (slot 0/1 = L2/R2 analog). OPTIONS = slot 6, touchpad = slots 7 and 16.
//   slot -> ui button: switch at 0xDEE4CD (posted by loc_DEE4B0 as type 13): slot 6 -> 12 (start),
//     slot 7 -> 13 (back), slot 16 -> 16, slot 10 -> 0 (cross). Inverse table asc_24531B0 agrees.
// So the start menu is OPTIONS (pad bit 0x8). The touchpad posts ui buttons 13 and 16 (the
// Director in the Tower; Codie used it for "return to orbit" on 2026-10-22 01:30 [L]).

## Input side: runtime_pad.c delivers OPTIONS

// d1port/src/runtime_pad.c: BTN_OPTIONS=0x8, BTN_TOUCHPAD=0x100000 match the game table.
// Keyboard (window not holding the mouse; native KBM is not armed for betath, no "Native mouse"
// line in windowed.log): Enter = OPTIONS, Tab = touchpad left, Backspace = touchpad right.
// Xbox 360 pad (windowed.log "gamepad connected: Xbox 360 Controller"): Start = OPTIONS,
// Back = touchpad (left-side touch). BB_PAD_FILE token "options".
// PadData layout matches what sub_64D130/sub_64CD40 read: connected @76, connected_count @104,
// touch count @52, touch x/y/id @60/62/64 [C]. No touch data is needed for OPTIONS.

## Game gating between the press and the screen

// sub_DEBF60 (ui input pump) posts type 13 when slot.down == 1, slot not consumed, owner 37/any.
// sub_DFE610 posts only if the controller is in use or the top screen accepts it.
// sub_DFDFA0: top screen of layer 1 gets it first (sub_E08AC0 -> vtable+80 = sub_E0BEF0, which
// walks the screen's components). If no screen consumes it and
// (sub_DEB510(0) != 1 || (sub_D59CB0 && sub_D5A4F0)), sub_EEC4D0 runs.
// sub_EEC4D0 refusals all log at level 4 (= error, same level as other ui errors that do reach
// debug_full.txt): "simulation starting up", "controller not in use", "Launch countdown",
// "invalid ui_location", "conflicting menu already open".
// sub_EEC9F0 then builds screen hash 0xB177D30B (dword_3185F34, set at 0xEECDD6) via
// sub_E06D50 -> sub_EC7060 -> sub_EF3B10 (sorted hash list) -> sub_EC6DA0 -> sub_EC1440, whose
// failures log "cui:screen:load: ..." [C].

## Live state (client PID 57160, orbit, 2026-10-22 ~20:10 local) [O]

// ui ready byte_3158F00=1; active controller 0; blocking-message id qword_31480DC=-1 (none);
// session states 6/0/0, dword_327BD48=1, bd61=1, bd62=1 -> sub_DEB510(0) = 0: gate open in orbit.
// cui blocked-screen list (ui+736, count ui+800) empty.
// 0xB177D30B is registered: memory holds the sorted list ... {0xAE4CCBF6,0x8081C008},
// {0xAE5261E8,0x8081C009}, {0xB177D30B,0x8081C00A} ... so the start-menu screen tag is 0x8081C00A
// and its screen list is resident. (0xAE5261E8 = dword_3185F38, the sibling screen.)
// cui layer 1 top screen: category 9 (hash 0xA10F9031); at character select also category 31
// (0x113375AB). Both use vtable 0x2AF5D30, input handler sub_E0BEF0.

## Logs [L]

// No "ui:start_menu:" line and no "cui:screen:load" line in any report (2026-10-21/22), though
// Codie spent 9-14 min in orbit and ~8 min in the Tower per run. So every OPTIONS press either
// never reached sub_EEC4D0, was consumed by the top screen, or reached sub_EEC9F0 and was dropped
// silently (sub_E05E60 finds an existing category-0 screen for the same controller).
// Server log start-betath-20261022-201243.out: nothing UI-related; no request is made when the
// menu fails, so no server data is implicated yet.
