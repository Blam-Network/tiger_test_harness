# PS4 39573 (ff) free camera (debug director)

2026-10-23. `D:/Games/ps4/ff-39573/eboot-ida.elf` (39573.14.04.03.1336.ff), read from the ELF bytes (capstone,
relocations); IDA address = guest VA, patch Address = IDA address + 0x400000. The pre-alpha (betath 38464,
`D:/Games/ps4/betath-38464/eboot-ida.elf`, headless IDA :13345) was the Rosetta stone: every ff function below was
found from its betath twin by byte signature and checked in disassembly. Static work only: the patch is untested
in the client.

## What is left of the flying camera

- ff has no hs runtime, and the pre-alpha's `director_cycle_debug_camera` is already an empty body there. The
  engine side is intact: RTTI `c_debug_director` (vtable 0x2B6E1B0, ff) / 0x2AD8F70 (betath), `c_flying_camera`,
  `c_editor_director`, `c_observer_director`, `c_game_director`, `c_space_flight_director`.
- director_set_mode sub_D6FA30 (betath sub_D2D3C0) (user 0..3, mode): calls the old director's vtable slot 0,
  constructs the new one in place in the per-user director array (`[0x31E55E8] + 0x3D0 * user`) and stores the
  mode at array + 3904 + 12 * user. Modes: 0 game (sub_D390D0 in betath), 1 saved film, 2 observer, 3 debug
  (ctor sub_D6E0C0 / betath sub_D2BA50), 5 editor, 6 loki, 7 space flight. Director vtable slot 0 returns the mode
  (debug: 0x1BFDB30 `mov eax, 3`).
- Only one caller passes 3: sub_D716A0 (betath sub_D2F050), "enter the debug director at this position/forward/up"
  (3, or 5 in the editor, then sets the flying camera's position and facing). Nothing calls it in either build (no
  call, jump, lea or relocation): it was an hs function's native and the hs entry is gone. So the debug director is
  dead code, but complete.
- The director reset loop (0xD7009D in ff, 0xD2DA4D betath) recomputes each user's mode and skips users already in
  mode 3: 5 if in the editor (sub_401DD0) without a player (sub_DCD5D0 == -1), 1 if a saved film (sub_D9D890),
  7 in space flight (sub_851B90), else 0. Loading a new map (sub_D70190 = betath sub_D2DB40, every user to 0 first)
  and the cinematic switch sub_D6F730 still reset it.

## The debug director (sub_D6E270 update, byte-identical structure to betath sub_D2BC00)

- Constructor: camera mode table 0x25D0FD0 = {2 flying, 0 following}; index +0x35C starts at 0 = flying.
  sub_D6E180 (betath sub_D2BB10) applies it and logs "%s camera".
- The flying camera ctor sub_D77CE0 (betath sub_D35560) starts at the observer's current camera (sub_D84160 =
  betath sub_D40D00), so it starts where the view was.
- Input: the user's controller (sub_DFBA30 user -> controller), abstract button state 0x14 bytes per pad slot,
  filled from the pad state in slot order LT RT up down left right OPTIONS touchpad L3 R3 cross circle square
  triangle L1 R1 (+2 = frames held, 1 = pressed this frame; +0 = ms held). Read in the director update:
  - square held 2000 ms (button index 12 from dword 0x2AD6580) or keyboard key 0x1D: flying <-> following.
  - flying: R3 press flips flying <-> static (frozen, mode 7); L3 press does the same, and in static it aims at
    the player's unit.
  - following: R3 press following <-> orbiting.
  - flying: square press raycasts from the view (betath sub_DC3AC0) and switches to "look at" the object hit,
    triangle press to "orbiting" it. In orbiting, triangle goes back to flying and square to look at; in look at,
    square goes back to flying and triangle to orbiting. (Camera names: table 0x2AF4FC0 betath, "following",
    "orbiting", "flying", "look at", ..., "static" = 7.)
- The flying camera (betath sub_D356B0; ff vtable 0x2B6E600 slot 2 = sub_D77E30) reads the same controller:
  sticks move and look (profile settings camera_flying_movement / camera_flying_thrust / look sensitivity),
  RB up and LB down (analog value of the bumper entries), RT held flips a camera flag (bit 0 of camera +0x88, true
  name unknown: most likely the fast mode), LT feeds a speed scale. D-pad up/down (speed x / ÷) only applies in the
  other branch, gated by a global (betath unk_2EE87C8) that is probably never set. These assignments are read from
  the decompile, not tested.
- While flying, director slot 8 (+0x40) returns true (+0x360). sub_D71410 (betath sub_D2EDC0) returns it and the
  player input-suppress check sub_84BA40 (betath sub_83E9F0) ORs it in, so the player stands still while the
  camera flies.

## The toggle: L3 + R3 held, tap L1

- The debug button combo sub_E034E0 (betath sub_DEA6C0, see `docs/v38464_14_02_28_1027_betath/claw.md`) runs
  every frame, per controller, only while L3 and R3 are held. L1 down sets a latch (0x31F0FD4 + c); the frame L1
  is up again is the tap. With L2, R2 and d-pad up not held:
  `dl` = nothing else held (down, left, right, OPTIONS, touchpad, cross, circle, square, triangle),
  `r15b` = 0 on the tap. 0xE03890 `or dl, r15b; jne 0xE03C12`: the tap with something else held steps the
  network overlay page; the tap with nothing else held does nothing. That is the free combo.
- Patch (guest/ff-39573.xml, "D1 ff: free camera on L3+R3 + L1 tap (debug)", isEnabled="false"):
  - 0xE03893 (Address 1203893): `jne 0xE03C12` -> `jne 0xD716A0` (`0F8579030000` -> `0F8507DEF6FF`).
  - 0xD716A0 (Address 11716A0, 173 of the dead function's 0x180 bytes):
    ```
    test r15b, r15b ; jne back                 // no L1 tap: the original jump
    movsxd rax, [rbp-0x2C]                     // controller (stored at 0xE03758)
    imul rax, rax, 0x638
    lea rcx, [0x31EE8E0] ; mov ebx, [rcx+rax+4] // its user (the table sub_DFBA30 searches)
    cmp ebx, 4 ; jae back
    mov rax, [0x31E55E8] ; test rax, rax ; je back
    imul rcx, rbx, 0x3D0 ; add rax, rcx ; mov rdi, rax ; mov rax, [rax] ; call [rax]   // director mode
    mov esi, 3 ; cmp eax, 3 ; jne set          // not in the debug director: enter it
    <the reset loop's choice, 0xD7009D: 5 / 1 / 7 / 0>
    set:  mov edi, ebx ; call sub_D6FA30
    back: mov rdi, r13 ; jmp 0xE03C12          // 0xE03C12 does mov r13, rdi
    ```
    Stack is 16-aligned in sub_E034E0's body (push rbp + 5 pushes + sub 0x78). After 0xE03C12 the path is the
    original no-op: r15b = 0 and r12b = 0 (circle not held), so no saved film marker.
- `python3 guest_patches.py <copy with isEnabled="true"> --eboot out/eboot.elf --out <scratch>`: 5 writes, both
  Originals match. With the entry disabled the output is byte-identical to the current out/patches-ff.bin.

## Use

1. In `C:/Users/codie/Projects/staging/d1port_ff/native/guest/ff-39573.xml` set the free camera entry's
   `isEnabled="true"`. walk-ff.sh rebuilds out/patches-ff.bin when the XML is newer, on the next launch.
2. In game (Xbox 360 pad on the native client): hold both stick clicks (LS + RS), tap LB, release. Nothing else may
   be held (no triggers, d-pad, face buttons, Start/Back). Keyboard: hold Z + C, tap 1.
   Same combo again leaves it. One pad: the camera uses the controller of the player who pressed the combo; no
   second controller needed.
3. Flying: left stick move, right stick look, RB up, LB down, RT probably fast. RS click freezes the camera (static)
   and back. X (square) on something in the middle of the view: look at it; Y (triangle): orbit it; Y again from
   orbit: fly. Hold X 2 s for the following camera on your character (RS click: following <-> orbiting); hold X
   2 s again to fly. A quick X press also does the look-at pick, so hold it with nothing in the view center.
- Entering presses L3/R3/L1 in the normal game director first: sprint, the R3 action and a grenade (L1) may fire.
- A map load or cinematic resets the director and drops you out; use the combo again.

## Untested / risks

- Nothing here ran. The debug director's constructor and update are byte-for-byte the pre-alpha's, but that code
  was unreachable in both shipped builds, so it may assume dev-only state (e.g. a message system behind "%s
  camera", sub_678B40-style). If entering crashes, the crash site says which.
- The flying controls (which bumper is up, what RT and LT do) are from the decompile; the toggle path and the
  debug director's own button reads are confirmed in disassembly.
- The controller -> user table read (0x31EE8E0 + 0x638 * c + 4) assumes the field sub_DFBA30 compares is the
  user index (betath: the debug director takes its controller through the same table). A wrong user only means
  the toggle does nothing (user >= 4) or acts on that user.
- Overwrites sub_D716A0, which has no callers in ff (checked: no call/jmp/jcc into 0xD716A0..0xD71820, no lea,
  no relocation).
