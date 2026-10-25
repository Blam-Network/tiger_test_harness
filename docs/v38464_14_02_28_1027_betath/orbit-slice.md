# Orbit slice: what picks the planet behind the director (betath 38464)

// 2026-10-22. PS4 pre-alpha 38464.14.02.28.1027.betath, IDA `eboot-ida.elf` (headless :13345, read only).
// Packages D:/Games/ps4/betath-38464/packages (ps4_orbit_0157_0.pkg) read with gibbon betath. Key branches
// below were checked in disassembly, not only the decompiler. Same design as the Xbox alpha
// (web-tiger/docs/orbit-intro.md, cosmo-intro.md), with two extra non-planet slice sets.

## Orbit scenario (orbit:scenario_client 80AAE003, destination "orbit")

// Ten bubbles, one state each, descriptors 80AAE004..80AAE00D (all world 0x597E3BC5, blueprint set
// 80AAE02F). The map's slice-set list (80AAE028, class 80800611, 10 entries) has the same names, same order.
//   0 0x8265820B  true name unknown. Loaded by bootflow:prepare_for_orbit; also the last-resort fallback.
//   1 cosmo_intro (0x132E9BF9). Finite bounds. Nothing in the eboot names it (no 0x132E9BF9 constant).
//   2 0x11E694B6  true name unknown. Loaded by character:signin (character select backdrop).
//   3 orbit_earth  4 orbit_mars  5 orbit_mercury  6 orbit_moon  7 orbit_reef  8 orbit_saturn  9 orbit_venus
// 80AAE00E (class 80800321) is a package group root, not a movie map: {0x30B80B6F -> 80AAE00F (map root),
// orbit_globals -> 80AAE010 (destination table), 0x70CE4417 -> 80AAE011 (second map root)}.

## The loader (orbit_map_loader, sub_AD2680 init / sub_AD28C0 update / sub_AD3030 pick)

// sub_AD2680(loader, target) stores target at +0x104 and loads the "orbit" map (sub_8505A0, log "Found
// default orbit symbol"). Three callers, one per state:
//   0x8B73B6  esi=0  character:signin enter   -> dword_2EF8D04 = 0x11E694B6 (bubble 2)
//   0x8B4F09  esi=1  bootflow:prepare_for_orbit -> dword_2EF8D00 = 0x8265820B (bubble 0)
//   0x8CA678  esi=2  setup:orbit_loading enter -> character profile key
// Both constants are set only by the static init at 0xAD3400/0xAD340A (no other writer, not hs vars).
// sub_AD3030 (disasm 0xAD3061..0xAD3125): target 2 reads `[sub_79FAD0(sub_7AACF0())+0x478]` (0xAD3085),
// keeps 0x811C9DC5 if empty, translates it with sub_8CB4C0, then sub_18AD710 (map slice-set lookup by
// hash). Hit -> transition {12, handle, empty spawn} via sub_747290(mgr, 2, ...) ("Change slice-set").
// Miss -> "failed to find a valid slice_set ... slice_set_target [%d]".

## Key -> slice set (sub_8CB4C0, disasm 0x8CB4DE..0x8CB55C)

// 1. sub_900020(out, &key): *out = 0x811C9DC5, then scans the orbit_globals table (rows of 8 bytes at
//    data+0x10: 0x9000D4 `mov ecx,[rax+rbx*8+10h]` / `cmp ecx,[r15]` / 0x9000DD `mov eax,[rax+rbx*8+14h]`).
//    The key itself is never used as a slice-set hash: fnv1("orbit_venus") is a plain miss.
// 2. Miss, or target not in the map -> sub_178C000 = dword_3C13D50 = 0x59AD083E `city_tower` (static
//    init 0x178E2E0, only writer) -> table -> orbit_earth.
// 3. Miss again -> slice set index 0 (sub_1630470(0) -> sub_18A9790) = bubble 0 0x8265820B. Unreachable
//    with shipped data.
// Destination table 80AAE010 (class 80802283, the only tag of that class), 21 rows, key -> slice set:
//   orbit_earth: cosmo B22417AE, city_tower 59AD083E, 29930BA4 (uncracked), pvp_city_defense 35C39E60,
//                pvp_factory 54A75336, pvp_colony_ship DC5E5A7F
//   orbit_venus: venus E6BBD7C8, pvp_greenhouse D3249BC3, pvp_venus_hcc 7F3DE654
//   orbit_mars: mars A776C5B6, pvp_cabal_camp C62952D7, pvp_marsbattle 7124853D, pvp_oasis 3FACAB43,
//               pvp_rooftops B5B5F1FE
//   orbit_moon: moon BA7B60B2, pvp_anomaly 4F3811CF, pvp_moonbase 65BDC6F8
//   orbit_mercury: 1002D408 (uncracked), pvp_vex_tube D28FF232
//   orbit_saturn: 868C93A1 (uncracked)        orbit_reef: A6ED809B (uncracked)
// Bubbles 0, 1 (cosmo_intro) and 2 are not targets of any row: no key selects them.

## Where the key comes from

// It is a destination name hash (fnv1), held in the client's character profile at +0x478, which is BAP
// character profile 80801728 member 3 (server: SelfCharacter unknown6.unknown1.unknown3).
// Writers (byte scan for stores to +0x478):
// - 0x8C4FFB (sub_8C4B00) and 0x8C617B (fn 0x8C6130): on activity launch, the current scenario_client
//   (sub_852000 = world controller +1560) data +0x18 = fnv1(destination_name) (gibbon unknown18; checked:
//   orbit b084dd2b, cosmo b22417ae, city_tower 59ad083e). Then uploaded in 702.
// - 0x8C9377 (sub_8C9310): fireteam session parameter at +0x4B0 (host's key) when not empty; the compare is
//   sub_8C9120 ("Ignoring orbit slice set displayed due to exit reason"). Solo: host is self.
// - Sign-in: the server's self family profile.
// Live evidence: start-betath-20261022-163224/165718.out show the 702 ack key going 0x3559729A (what we
// sent) -> 0x59AD083E (city_tower) after the Tower.

## Current server behaviour

// character-values.ts `DEFAULT_ORBIT_KEY = fnv1("orbit_earth")` (0x3559729A) is not a table key; it
// shows Earth only through the city_tower fallback. The comment above it ("fnv1 of the orbit bubble") is
// wrong for this build: the key is a destination hash. values.ts `withOrbitKey` keeps the stored 702 key
// when non-empty, so a returning player gets the planet of their last activity (here always Earth or
// Mars, since only cosmo / city_tower / pvp_factory / pvp_marsbattle load in these packages).

## How to pick a planet

// Server (only lever): send the destination hash in profile member 3.
// - Default for new characters: character-values.ts `DEFAULT_ORBIT_KEY` -> e.g. `fnv1("venus")` (0xE6BBD7C8) or
//   `fnv1("city_tower")` for the proper Earth row.
// - Force it for everyone: in values.ts `withOrbitKey` set `unknown3` to the chosen key instead
//   of `key`. The encoder path is values.ts `unknown6: characterProfile(character)` in the self
//   family (login_character / self pushes).
// - Applies on the next orbit_loading after the client has the value: reliable at sign-in (self family
//   arrives before character:signin). After an activity the client has already written the activity's
//   destination locally at launch; whether a self push before orbit_loading overrides it is unverified.
// Not levers: init.txt / hs. `slice_set_transition <string>` (0xD94FB0) only stores the automation launch
//   name (sub_845620, getter 0x845BC0 has no direct caller); `world_controller_automation_*` launch
//   activities; no hs var holds 0x59AD083E or the two bubble constants. Debugger teleport needs an
//   activity client, which orbit lacks.
// Selectable: orbit_earth, orbit_venus, orbit_mars, orbit_moon, orbit_mercury, orbit_saturn, orbit_reef.
// Not selectable without client changes: cosmo_intro, 0x8265820B, 0x11E694B6.

## Confidence

// High: loader targets and constants, table contents, key translation and fallback (disasm + tag bytes).
// High: key = destination hash in member 3 (writers + live 702 acks). Medium: no other reader of +0x478
// (byte scan found only 0xAD3085). Untested: planet content of the non-Earth bubbles renders on PS4.
// Test: key 0xE6BBD7C8 must log "Change slice-set" with a different index than Earth.
