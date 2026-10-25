# Free camera (debug director) in betath 38464

2026-10-23. Port of the ff patch (`docs/v39573_14_04_03_1336_ff/freecam.md`, confirmed working in ff). betath was
the source build for the ff RE, so the mechanism, controls and caveats are the same; only the addresses differ.
IDA address = guest VA (`eboot-ida.elf`), patch Address = IDA + 0x400000.

## Addresses

| What | betath | ff |
|---|---|---|
| director_set_mode | sub_D2D3C0 | sub_D6FA30 |
| director array pointer (0x3D0 per user) | 0x3132868 | 0x31E55E8 |
| controller -> user table (+4) | 0x3145BA0, stride 0x630 | 0x31EE8E0, stride 0x638 |
| reset mode choice | 0xD2DA4D: sub_401DD0, sub_D88040, sub_D5A4F0, sub_8444B0 | 0xD7009D |
| hook (`jne` after `or dl, r15b`) | 0xDEAA73 | 0xE03893 |
| return target | 0xDEADF2 | 0xE03C12 |
| code cave (dead "enter debug camera") | sub_D2F050 (0xD2F050..0xD2F1D0) | sub_D716A0 |

- The CLAW combo function sub_DEA6C0 has the same instructions as ff's sub_E034E0 from the per-controller loop to
  the hook and from the return target on (normalized diff empty), so [rbp-0x2C] = controller, rdi = r13 at the
  hook, and r15b = 0 on the L1 tap hold here too.
- sub_D2F050 is dead in betath as well: no call, jump or jcc into 0xD2F050..0xD2F1D0, no lea, no relocation. Its hs
  entry is gone (`director_cycle_debug_camera` is an empty body), so no hs command is lost.

## Patch

guest/betath-38464.xml, "D1 betath: free camera on L3+R3 + L1 tap (debug)", isEnabled="true":
- 0xDEAA73 (Address 11EAA73): `0F8579030000` -> `0F85D745F4FF` (`jne 0xD2F050`).
- 0xD2F050 (Address 112F050): the same 173-byte toggle as ff, assembled for the addresses above.

`guest_patches.py guest/betath-38464.xml --eboot out/eboot.elf`: 4 writes (job help, hopper, the two free camera
lines), Originals match; out/patches-betath.bin regenerated.

## Use

Same as ff: hold LS + RS click, tap LB, nothing else held (keyboard: hold Z + C, tap 1); the same combo leaves it.
Left stick move, right stick look, RB up, LB down, RS click freeze; X on something: look at it, Y: orbit it; hold
X 2 s: following camera. On the way in you may sprint, trigger the R3 action and throw a grenade. A map load or
cinematic drops you out.

Untested in betath.
