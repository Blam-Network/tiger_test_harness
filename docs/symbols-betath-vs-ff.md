# Symbol sources: betath 38464 vs ff 39573 (and Alpha Trial 40662, 360 alpha)

2026-10-23. What naming information each PS4 eboot carries, with counts, and which build to use for which question.

Inputs:
- betath: `D:/Games/ps4/betath-38464/eboot-ida.elf` (38464.14.02.28.1027.betath), IDA headless :13345
- ff: `D:/Games/ps4/ff-39573/eboot-ida.elf` (39573.14.04.03.1336.ff); Codie's IDA :13347 has the same eboot open (`musicplayerdemo2/eboot.elf`)
- Alpha Trial: `D:/Games/ps4/alpha-40662-CUSA00942/eboot.bin` (40662, CUSA00942)
- 360 alpha: `tiger_release_internal_unlock.xex`, via `web-tiger/ida/strings.csv` and `web-tiger/docs/hs-functions.txt`

Method: the ELFs were parsed directly in Python (program headers, the SCE dynlib segment, relative relocations). IDA was used read-only for function counts and to classify assert call sites. Import NIDs were resolved with shadPS4's `aerolib.inl` (`staging/d1port/external/destiny-native-shadps4/src/core/aerolib/`). Typeinfo names were demangled with `llvm-cxxfilt`. The scratch scripts are in the session scratchpad (`sym/`).

## Summary table

| Source | betath 38464 | ff 39573 | Alpha Trial 40662 |
|---|---|---|---|
| ELF section headers | none shipped. The header still records 43 sections at shoff 0x1AF79024 (~452 MB file before signing) | none. Header records 44 sections at shoff 0x1B70B90C (~460 MB) | none, and the header fields are zeroed |
| `.symtab` / DWARF / `.debug_*` | none | none | none |
| Dynamic symbols (SCE dynsym) | 674 entries, all imports (NID form) | 704 entries, all imports | 782 entries: 728 imports plus **52 exports** (lib `tiger_release_final`) |
| Imports resolved to names | **672/672** (472 `sce*`, 28 C++ ABI/libc++) | **702/702** (503 `sce*`, 21 C++) | 728/728 |
| Named functions in IDB | 1 (`start`) of 56,283 | 1 of 55,762 | n/a |
| RTTI typeinfo objects | **2,284** (296 class, 1,859 single inheritance, 129 multiple/virtual) | **2,312** (297 / 1,885 / 130) | 2,434 (318 / 1,976 / 140) |
| Vtables reached from RTTI | 4,128 (1,937 primary) | 4,181 (1,961 primary) | 4,369 (2,035 primary) |
| Distinct virtual-slot targets | 9,927 | 10,100 | 10,644 |
| RTTI by origin | Bungie 1,673, Havok 383, DemonWare 111, sce Toolkit 94, SpeedTree 5, Wwise 4, std 4, other 10 | Bungie 1,696, Havok 383, DemonWare 111, sce 99, ... | Bungie 1,803, Havok 383, DemonWare 117, sce 99, ... |
| Bungie type identifiers in RTTI names (incl. template args) | 1,418 (c_ 1,179, s_ 177, i_ 56, e_ 6) | 1,437 (c_ 1,189, s_ 180, i_ 57, e_ 11) | 1,514 |
| Function names from local-class RTTI | 1 (`resourcerer_allocate_gpu_resource_internal(...)` with full signature) | same 1 | 2 (adds `defrag_handle_relocated_gpu_entry(...)`) |
| Assert call sites (`sub_62AB70` / `sub_62ABA0`) | 102,676, of which **99,866 pass NULL** (no expression, file or line); the rest pass a register | 105,331, of which **102,448 NULL** | not counted (release config) |
| Bungie source paths (`__FILE__`, distinct files) | **273** (`d:\bungie\betath\shared\engine\source\...`, `Foundation\...`, `spasaha\spasahalib\...`) | **276** (`d:\bungie\ff\...`) | 29 (`d:\bungie\pubalpha\...`) |
| Third-party source paths | DemonWare v34 116, libtomcrypt 93, Oodle 68, Havok 32, orbis_sdk 5, ATVI 5 | DemonWare v35 120, libtom 93, Oodle 68, Havok 32, sdk 6 | DemonWare v36 125, libtom 97, Oodle 67, Havok 32 |
| Log strings with a category prefix (`networking:bap: ...`) | **9,014**, 1,486 distinct categories | **9,266**, 1,511 distinct categories | 399, 77 distinct |
| Static log category table (`foundation:`, `resourcerer:`, ...) | 55 entries | 55 entries | n/a |
| Format strings (`%s`, `%d`, ...) | 7,887 | 8,015 | 1,662 |
| Messages that name a function (`foo_bar()`) | 228, incl. 87 boot-trace `after xxx_initialize()` | 224, incl. 87 boot trace | 96 / 89 |
| `__FUNCTION__` / `__PRETTY_FUNCTION__` strings | none (only names written into messages) | none | none |
| hs function table | **913 entries** at 0x2ADCA50 (name, parse, evaluate, param types, return type); roughly 210 to 225 have real bodies, about 600 are stubs (see `v38464.../hs-functions.md`) | **0**: hs is compiled out (`v39573.../hs-functions.md`) | 0 |
| hs globals table | **594 entries** at 0x2AEE798 (stride 24: name, type, value pointer); 203 point at a live data address | 0 (none of the 594 names exist) | 0 |
| hs type-name and usage tables | 59 type names (`unparsed`, `special_form`, ...), 29 usage strings | gone | gone |
| `error.*` names | 52 | **209** | 227 |
| RSAT descriptors (no names in any build) | 17,680 handles, 4,602 definitions, 14,991 members | 17,957 / 4,652 / 16,181 | 12,908 / 4,402 / 16,110 |
| Activity host message names | 43, no registry pointer | 43 at 0x2C3C040 | 43, registry switch present |
| Relocated string-pointer tables (8 or more entries) | 270 tables, 5,866 entries | 267 tables, 4,262 entries | not run |
| Profiler zones | 221 Havok `Tt*` timer zones, Oodle ThreadProfiler, 25 telemetry strings | 221 `Tt*`, 6 telemetry | 220 `Tt*` |
| Crash handler symbol map | code looks for `bin/orbis/%s.map` (`resolve_symbols_orbis.cpp`); no .map file is in any dump | same | same string; no file |

## The sources in detail

### ELF symbols and imports
- No build ships `.symtab`, `.strtab` or DWARF. The SELF-to-ELF conversion keeps only program headers. In betath and ff, `e_shoff`/`e_shnum` still describe the original ~450 MB linker output (43 and 44 sections), which shows that a full debug ELF existed at Bungie. It is not in any dump.
- Every dynamic symbol is an import NID (`xxxxxxxxxxx#L#M`). All of them resolve with aerolib, so every PLT stub can be named `sceNpManager...`, `scePthreadCreate`, `__cxa_throw` and so on. The IDBs currently leave them unnamed.
- ff adds C++ exception support (`__cxa_throw`, `__gxx_personality_v0`, `_Unwind_Resume`) plus `sceMsgDialog*`, `sceNpWordFilter*`, `sceNpSnsFacebook*` and `sceHttpCreate*WithURL`. betath alone imports `_Assert`, `sceNpCmpOnlineId` and some libc++ iostream/system_error.
- The Alpha Trial is the only build with exports: 52 functions (13 to 2,576 bytes, around 0x720000) under module `tiger_release_final`. Their NIDs are not in aerolib and do not match the libc `user_malloc`/`user_new` replacement names, so they stay unnamed.

### RTTI (Itanium)
- All three PS4 builds keep RTTI. betath and ff share 2,267 of their ~2,300 typeinfo names: 17 are betath-only and 45 ff-only. The ff-only names include `c_action_system_game_system`, `c_device_spectacle_game_system`, the world_controller `c_task_manager<e_..._task, ...handler>` set, sce Toolkit WordFilter/Sns/ActivityFeed and `c_status_crash_reporter`. The Alpha Trial has 193 names that ff lacks.
- Families: about 120 `*_game_system`, 98 `c_investment_bap_message_*` (BAP message classes), 69 to 75 `c_simulation_queue_*`, about 145 `*_component`, 204 `cui::` UI classes, 1 `c_activity_client_messaging_interface_bap::` nested class.
- Each typeinfo gives its class's vtable (offset-to-top + typeinfo pointer), so about 10k virtual functions per build can be named `c_class::vslot_N`. Base links come from `__si_class_type_info` and `__vmi_class_type_info`, so the hierarchy is complete for polymorphic classes. Non-polymorphic `s_` structs only show up as template arguments.
- The 360 alpha's MSVC RTTI covers 441 types, all Havok or other libraries. It has no Bungie classes.

### Asserts, source paths, logs
- Assert text is compiled out in both builds. More than 97% of the calls to the assert/halt helper pass NULL. The helper reads `{message, file, line}` from a static descriptor that is empty here. The PS4 eboots have no assert expressions, file/line pairs or `__FUNCTION__` strings.
- The `__FILE__` strings that do survive come from memory allocation tracking (`allocate(size, ..., "Foundation\\systems\\cortex\\cortex_container.cpp", 0x1A2)`): 439 of the 470 path strings that IDA lists in betath have xrefs. Each one gives the file (and line) of the allocating function, which is a good anchor for naming nearby code. Branch roots: `d:\bungie\betath\`, `d:\bungie\ff\`, `d:\bungie\pubalpha\`; the 360 alpha uses `d:\bungie\alpha\`.
- Log strings are the richest per-function source in betath and ff, at about 9k each. The category prefix (for example `world_controller:slice_set_transition_manager`) places the code in its subsystem, and many messages name their own function (`try_to_get_activity_client_world() failed!`). The Alpha Trial stripped about 96% of them.

### hs (script) tables: betath only
- 913 named functions, each with its parse/evaluate addresses and a typed signature. About 210 to 225 bodies are real; the rest are stubs into the hs return. Those evaluate functions call the engine natives, which gives a name anchor for each native that is actually implemented.
- 594 named globals (`enable_melee_action`, `havok_broadphase_half_size`, `force_disable_reports_file_output`, ...), each with a type code (5 boolean ×375, 6 real ×118, 8 ×100, 7 ×1). 203 have a relocated pointer to the actual global variable in .data/.bss. This table is not in the existing docs yet.
- In ff, none of these names survive (`hs-functions.md` covers the evidence). The extra 1,541 snake_case strings that betath has over ff are almost exactly these 913 + 594 names.

### Reflection and schema data
- The RSAT descriptor catalogs (`rsat-descriptors.json` per build) give layout, kind and checksum only. No build has type or member names. betath and ff share 16,214 checksums, and 3,652 definitions have identical members. The Alpha Trial rehashed and shares only 1,728.
- The tag/struct type names that appear as plain strings are few (14 standalone `c_`/`s_`/`e_` names). The tag class names come from the packages, not the eboot.
- Enum and name string tables found by scanning relocated pointer runs include TFX shader pass names (415), `_tfx_externs_*` (76 to 78), particle variables, render-object types, `_join_result_*`, simulation event types, signon/security refresh states, DemonWare `BD_*` error names (about 390), libtomcrypt errors, Havok member names (cloth, constraints) and the 55-entry log category table. Most exist in both builds. In betath the largest table is the hs function table itself.
- `error.*` code words: ff 209 and Alpha Trial 227, against 52 in betath. ff has the `booted_from_private_activity_host_*` family, which betath lacks.

### Third-party libraries
Havok 2012.2 (383 RTTI, 221 `Tt*` timer zones, member-name tables), DemonWare (v34 in betath, v35 in ff, v36 in the Alpha Trial; `bd*` RTTI and BD_ error tables), Oodle (`v:\devel\projects\oodle\...`), libtomcrypt 1.2, CRI Movie/Sofdec (`CriMv*`; no Bink beyond a few strings), Wwise (`AK::`, `CAk*`), SpeedTree, FreeType, sce NP Toolkit. Scaleform is absent, and so are RAD Telemetry zones (Bungie's own `telemetry_*` settings do exist). The `Tt` zones belong to Havok, not to a Bungie profiler, and no Bungie job-name or thread-name table was found beyond about 30 job/global names.

## Recommendation

betath is the best single reference for naming code. Use ff where its contents are closer to the Alpha Trial and release, then carry names across by function matching. The two builds are about 97% the same code (RTTI 2,267 shared names, RSAT 16,214 shared checksums).

| Question | Use |
|---|---|
| What is this function called? Script/console natives, init.txt settings, debug globals | **betath**: 913 hs functions and 594 named globals with addresses. Nothing else gives function and variable names. |
| Class identity, vtables, virtual dispatch, class hierarchy | either (same RTTI); **ff** for classes added after February (action system, device spectacle, world_controller task managers) |
| Subsystem / log-driven tracing (`networking:*`, `world_controller:*`) | either; both keep about 9k category logs. Use the build you are debugging. |
| Networking against our servers: BAP/RSAT layouts, error codes, signon, DemonWare 35, sku_config, rejoin/booted flows | **ff**, as it is closer to the Alpha Trial: 209 error names, newer NP APIs and exception support |
| Release-like behaviour, activity host message registry | **Alpha Trial 40662** (its logs and source paths are mostly stripped, so do not use it for naming) |
| Source file / module of a function | either: allocation-site `__FILE__`+line strings (273 / 276 files) |
| Assert expressions, file:line of asserts | none of the PS4 builds; the 360 alpha keeps somewhat more debug text (6.3k category logs, 311 `.cpp` strings, 901 hs functions) but is PPC and has no Bungie RTTI |

Workflow: name functions in betath from the hs tables, RTTI vtables, allocation `__FILE__` strings and log strings. Then port the names to ff and the Alpha Trial with BinDiff (installed at `C:\Program Files\BinDiff`) or byte signatures, using RTTI vtables and log-string xrefs as matching anchors. Apply the aerolib import names to both IDBs first, since every NID resolves.
