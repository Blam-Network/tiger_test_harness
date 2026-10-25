# Audio environments (reverb) in PS4 pre-alpha 38464.14.02.28.1027.betath

2026-10-22. Native client `d1port_betath`. IDA addresses are the betath IDB (`eboot-ida.elf`, port 13345); guest patch addresses are IDA + 0x400000. Static RE and logs only (the game was being played, so no process reads). Follows `audio.md` (silence fix).

Complaint: with sound working, everything sounds like it is indoors. Log lines suspected: `audio:listener: can't find connectivity data`, `audio:listener: could not find a valid cluster at listener position`, `visibility: portal culling is disabled, falling back to frustum culling`, `audio: umbra tome changed, caching it now`, `visibility: encountered a chunked instance ... that wasn't in the tome`.

## How the listener picks its environment

Per frame `sub_973FE0` builds each local user's listener from the observer (camera) transform `sub_D40DA0(i)` (position `+16`, forward `+40`, up `+52`) and calls `sub_BCBAF0(listener, desc)`:

- `sub_BCBAF0` sets the listener's Umbra cluster (`listener + 64`, listener array `qword_2EFD2C0 + 208*i`). Cluster = -1 if the listener flag `+196 & 1` is set (only listener 7, the pad copy) or if `sub_BD4320` finds no tome. Otherwise it queries the cached tome (`qword_2EFD2C8 + 8`, `sub_14327C0`) at the listener position; no hit gives -1 and the "could not find a valid cluster" line.
- `sub_BD4320` compares the visibility system's current tome (`sub_C37810` -> `sub_C43ED0`, `unk_30CC240` slot `+24`) with the audio copy and re-caches it (`sub_BCB9C0`) with the "umbra tome changed" line. That line has no counter: it prints at every slice/tome change and is normal.
- `sub_BCC3E0` -> `sub_BCCA50(listener, out)` turns the cluster into Wwise environment sends:
  - start: primary environment = the audio globals' default (`sub_1AEE580(dword_2EFD288) + 12`), weight 1.0 (`dword_2515EF8`).
  - connectivity = `sub_C37BE0()`: tag id at `+164` of the tag in the current visibility slot (slot `+4`, resolved by `sub_1B49820`). -1 gives "can't find connectivity data" and the default environment.
  - cluster -1 also gives the default environment (jump at the `+64 == -1` test).
  - otherwise the cluster's record (20 bytes, byte `+34` = environment index, 255 = "cluster environment index not set") selects the environment (`+16` of a 24-byte entry); portals of the cluster (48-byte records, centroid + radius) add a transition environment weighted by distance ("bad centroid" when the centroid is invalid).
  - output (0xBCD5AB..0xBCD700): up to two `{environment +12, weight}` pairs appended to the listener effect list, then `sub_BD4820`/`sub_BD4EA0`/`sub_BD57A0` apply it.

So any failure (no connectivity tag, no tome, listener outside every cluster) silently falls back to the one default environment from the audio globals tag. That matches "everything sounds the same, roomy".

## What the log lines do and do not show

- "can't find connectivity data" (counter `dword_2EFD378`), "could not find a valid cluster" (`dword_2EFD350`), "cluster environment index not set" (`dword_2EFD3F0`) print **only on the first failure of the process** (`if (counter++ <= 0)`). Every later failure is silent. So one line per log tells nothing about whether it keeps failing.
- First prints line up with transitions: connectivity at `setup:activity_world_transition` (02:58:04.645, before `initial_slice_set_loading`, so no slice and no tome yet); cluster at `activity:physics_join` (02:58:19.012) in the same frame as the portal-culling line, i.e. the camera was not inside the tome before the spawn. Both expected even on a console.
- "portal culling is disabled" (`sub_C40270`, print at 0xC40C63) is **not a switch**. Confirmed in disassembly 0xC40B86..0xC40C43: the view position (`view + 0x90`) is tested against the tome's bounds (per-tile AABB list, or `sub_C3AE80` overall bounds); if it is inside none, `view + 0x42C` = 0, frustum culling is used and the line is printed, rate-limited to one per 5000 ms (`sub_639C10() - dword_30CC470 >= 0x1389`), suppressed when `dword_2A20C0C == 2`. No init.txt key, hs global, platform query, GPU/occlusion result or allocation is involved. In report `20261022_025609` it fires at physics_join, around tome changes, and every 5 s at 03:12:49-03:12:59 and 03:13:58-03:14:03 while `in_world`: the camera was outside the tome's bounds for those stretches. While that is true the audio cluster lookup fails too (same tome, same camera) and the default environment is used.
- "chunked instance ... wasn't in the tome" (x357, `sub_C3C680` at 0xC3CB76): placed geometry missing from the baked tome, i.e. tomes baked against older geometry. A content symptom (stale visibility bakes in pre-alpha data), not a runtime one.

## Runtime or data?

Nothing in this path touches an import: Umbra queries are in-guest math on tome data, the connectivity id is a field of a loaded tag, the environment is a tag field. The runtime only carries the final mix (`runtime_audio.c`, port 0, 8 ch float; the betath does not import `sceAudioOutGetPortState`, so Wwise picks its own 7.1 layout and SDL downmixes). The server only picks the activity; slices and tomes are the destination's. So the fallback is driven by betath's own content (missing connectivity reference, or tomes that do not cover the outdoor areas) unless a later live read says otherwise. 40662 is a final build with the log strings stripped and its reports are empty, so there is no log to compare.

## The check that decides it (read only, when nobody is playing)

Guest address = 0x800000000 + IDA address. In world, standing outdoors, read twice 5 s apart:

- `dword_2EFD378` grows (about 30/s) -> no connectivity tag in the loaded slice: content lacks audio connectivity, default environment everywhere.
- `dword_2EFD350` grows -> listener outside every cluster (camera outside the tome).
- `dword_2EFD3F0` grows -> clusters have no environment assigned.
- Listener 0 cluster: `[qword_2EFD2C0] + 64` (dword). Default environment tag: `[sub_1AEE580(0x80938002)] + 12`; name via `sub_67B470`.

None growing while it still sounds indoors means the environment data itself says so (the cluster's environment is the roomy one), or the cause is downstream in the mix.

## Fix

- No init.txt line, server change or runtime change applies: nothing in the selection reads config, platform state or server data.
- If the check shows the fallback is in use, the only lever is the guest (hypothesis test, do not leave in): drop the default environment so a listener with no cluster or no connectivity gets no reverb send instead of the roomy default. In `native/guest/betath-38464.xml`: `Address="FCCA8E" Value="0F1F00" Original="8B480C"` (0xBCCA8E `mov ecx,[rax+0Ch]` -> 3-byte nop; `var_38` stays -1, so the output at 0xBCD5AB is skipped). Clusters that have their own environment still get it. Portals with no environment still use the default (0xBCCEE8, same bytes `8B580C`; nop it as well for a fully dry fallback: `Address="FCCEE8" Value="0F1F00" Original="8B580C"`).
- Real fix, if the content lacks connectivity: author or borrow per-destination audio environments (data), not code.

## Confidence

High on the mechanism and on "portal culling disabled" = camera outside the tome bounds (checked in disassembly). Medium that the default environment is what is heard: the log cannot show persistence (log-once counters), and the counter read above was not possible during play. Low that the runtime or server is involved.
