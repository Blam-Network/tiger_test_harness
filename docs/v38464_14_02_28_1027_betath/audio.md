# Audio in PS4 pre-alpha 38464.14.02.28.1027.betath: why it is silent

2026-10-22. Native client `d1port_betath`. IDA addresses are the betath IDB (`eboot-ida.elf`, port 13345); the live state below was read with ReadProcessMemory (read only) from a running `d1-windowed-probe.exe`, guest image at 0x800000000 + IDA address. Alpha Trial (40662) addresses are its IDB (port 13342).

## Cause

At sound-engine start-up the betath adds a Wwise secondary output for the pad speaker with **every** listener on it:

- `sub_BD9540` (audio_system init, `Engine\Audio\Library\private\audio_system.cpp`), at 0xBD96A5: `xor edi,edi; mov esi,4; mov edx,0FFFFFFFFh; call sub_1384010`.
- `sub_1384010` queues Wwise message 0x1B (secondary output add). The audio thread runs `sub_139D7F0`, which builds the sink through `sub_13D62A0(settings, type 4, user 0)` and, only if the sink's Init succeeds, does `main_output.listener_mask &= ~mask` (0x139DB3B) and gives the mask to the new output.
- The pad sink's Init is `sub_13D65E0` (vtable 0x2BAB980): `sceAudioOutOpen(user [rbx+40h], type [rbx+3Ch], 0, 1024, 48000, fmt)` at 0x13D66BC, failure if the result is <= 0.

So the call is `AddSecondaryOutput(output 0, pad speaker, listeners 0xFFFFFFFF)` and opens `sceAudioOutOpen(userId 0, PADSPK)`. User 0 is not a signed-in user. On a console that open fails, the output is dropped and the main output keeps its listeners. Our runtime's `audio_open` (`d1port/src/runtime_audio.c`) ignores the user id and opens port 17, so Wwise moves all listeners to the pad speaker. The main output (port 0) then has listener mask 0 and mixes silence, and the pad output mixes nothing either.

The Alpha Trial does it the console-safe way: 0xBA6480 calls the same API (`sub_1318B40`) with the signed-in user (`sub_6B6680`/`sub_6B6FE0`, the initial user) and mask 0x80 (listener 7 only), and removes the old one (`sub_1318BD0`) when the user changes. That is why the alpha has sound with the same runtime.

## Evidence (live, title/orbit, before the 01:56 crash)

- Wwise output table `qword_332D928` (count `dword_332D930` = 2, 80-byte entries). Entry 0 (main, sink user 0xFF type 0, port handle 0x20000000): listener mask at +32 = **0x00000000**. Entry 1 (pad, sink user **0**, type 4, handle 0x20040011): mask **0xFFFFFFFF**.
- Both sinks' buffers (`+88`/`+96`, 32768 and 4096 bytes) read all zero for 20 polls; matches the BB_AUDIO_DUMP of 1031 s, both ports, all zero.
- Everything upstream works: stream manager `qword_2EFD7B8` has init-bank state 1 (`+44`) and 729 banks registered (`+72`), the first being 0x50C63A23 = FNV("init"). Resourcerer audio callback `qword_2D47850` = `sub_BD9E10`. Audio globals tag `dword_2EFD288` = 0x80938002.
- Events are posted and accepted by Wwise: "event playbacks" pool (`audio_interface+6080`) holds the orbit audio loop (tag 0x809380D1, event 0x43E1A826, playing id 8, posted by `sub_860BA0` through `sub_BD1E10`); freed slots show playing ids up to 0x2C.
- No `audio:` lines in the reports: none of the failure paths are hit (bank load errors are level 5, stream open/read errors level 4, all logged when they happen).

Ruled out on the way: init.txt/config keys, app flags (`sub_7B5E10` sets byte 6 = 1, gate `sub_727A70` passes), game-in-progress gate `sub_D59CB0` (passes), system service status, `master_volume` RTPC (`dword_2EFD298` = FNV("master_volume"), forced to 100 by `sub_BCC110`), max voices (`0x2A20BEC` = 45), media format (all Vorbis 0xFFFF streamed, same as the alpha), package block flags (stream media uncompressed in both builds), AJM (unused: Vorbis is software). Game-side listeners (`audio_interface + 208*i`) are all cleared in orbit because no local player is mapped (`sub_D881C0`, players `+216` = -1); that only drops positional events and is the same in the alpha.

## Fix

Runtime (preferred, matches the console): in `d1port/src/runtime_audio.c` `audio_open`, refuse user-bound port types for a user that is not signed in:

```c
/* Voice, personal and pad-speaker ports belong to a signed-in user (USER_ID, runtime_services.c). */
if ((type==2 || type==3 || type==4) && user!=1) return ERR_INVALID_PARAM; /* 0x80260016 */
```

Any negative result is enough for Wwise (`test eax,eax; jle` at 0x13D66C4). The alpha opens port 17 for user 1 and is unaffected. Main/BGM/aux keep accepting the system user (255). Share the user id with `runtime_services.c` rather than repeating the literal.

Guest alternative (only if the runtime cannot change), in `native/guest/betath-38464.xml` (address = IDA + 0x400000): skip the call, `Address="FD96B1" Value="0F1F440000" Original="E85AA97A00"`; or give it the alpha's listener-7 mask, `Address="FD96AC" Value="BA80000000" Original="BAFFFFFFFF"` (the pad output still opens for user 0, but listener 0 stays on the TV output).

## Confidence

High that this is the silence: the main output's listener mask was read as 0 in the live process and the code path that zeroes it is the one above. Not yet verified by a boot with the fix; after it, port 0 should carry non-zero samples at the title/orbit music (`BB_AUDIO_DUMP`).
