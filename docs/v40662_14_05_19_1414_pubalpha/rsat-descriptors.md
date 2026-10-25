# RSAT descriptors, PS4 alpha 40662.14.05.19.1414.pubalpha (CUSA00942)

2026-10-21. `eboot.bin` sha256 `4eb62bcd…b2b75e`, plaintext x86-64 ELF (ET_SCE_EXEC). The first PT_LOAD already has
p_vaddr 0x400000, so **IDA address = p_vaddr** (checked: file offset 0x1826F1F = IDA 0x1C22F1F). Pointers in .data
are zero in the file and filled by `R_X86_64_RELATIVE` entries in DT_SCE_RELA (the IDA db did not apply them). The
descriptors themselves contain no pointers, only self-relative offsets and schema handles.
Catalog: `rsat-descriptors.json` from `python scripts/rsat-descriptors.py <eboot.bin> --out …` (about 4 s, ELF only).

## Where they live
- Boot (`sub_400880`) calls `sub_535230(0x182E130)` just before "after schema_system_initialize()". `0x182E130`
  is the schema memory blob. `+0x20` is a self-relative u64 that points at the registry at **0x182E188**: a u64
  count (**12908**), then 16-byte entries `{i64 offset to the record, relative to the entry; i16 table; u16 index;
  u32 0}`. Handle = `0x80800000 | table<<13 | index`, the same datum-handle namespace as the 360 (tables 0/1/2 hold
  4093/3731/5084 entries). The records follow the registry (0x1860880..0x1ABE30C).
- `sub_535230` claims each handle (`sub_48D780`) and then matches record `+8` against the static C++ class table.
  That table is `{&class_handle_global, u32 checksum}` pairs, e.g. 0x2079850 → 0x234BA50 / 0x0AD62A29.

## Record (one per handle)
| off | field |
|----:|-------|
| +0x00 | u64 record size (records may have gaps between them) |
| +0x08 | u32 checksum. This is the queuez `headerChecksum` and the class-table key (80801774 = 0x42C311B7, as in 41375) |
| +0x0C | u32, 0 or a second hash (true name unknown) |
| +0x18 | u32 base class handle, or -1 (80801774 → 80801907, an empty size-1 struct) |
| +0x1C | u32 sizes[4]. [0] equals the x360 `.schmr` size and [3] equals the PS4 definition size in all 4402 cases. [1]/[2] are other 64/32-bit platforms (not identified) |
| +0x2C | u32 aligns[4] |
| +0x3C..+0x48 | flags u32 ×3, then an ordinal with a 0x64/0x68 high byte (the 360 "+0x40 ordinal") |
| +0x60, +0x68 | u64, true name unknown (kept raw in `header`) |
| +0x70 | u64 offset from +0x70 to the struct definition; 0 = none |
| +0x78.. | tagged attribute objects `[u32 type][payload]`, e.g. 8080001D {u32 handle} (alias / underlying type), 8080001B, 80800050 (empty), 8080010D {u64}. Kept raw (`attributes`) |

The struct definition is itself typed. The u32 just before it is **8080010A**, the self-describing meta schema
(`sid 8080010A`, members u64 count, kind-0 sid, i32 size64, i32 packedSize, i32 dirtyBits). Definition =
`{u64 count; u32 sid (== handle, asserted for all 4402); u32 size64; u32 packedSize; u32 dirtyBits}`, then
`count` members. The member meta schema is **80800109** (0x28 bytes):

| off | field (from 80800109's own members) |
|----:|-------|
| +0x00 | i32 offset in the PS4 instance (used by the walkers) |
| +0x04 | i32 packed offset (kind-0 members take 0 bytes), true name unknown |
| +0x08 | i32 dirty index (in memory only, never on the wire) |
| +0x0C | f32, 0.5 on all members except 4 (80800493 m0-2 = 0, 80802049 m9 = 1), true name unknown |
| +0x10 | i8 kind (stored as 6 bits, bias 1) |
| +0x11 | bool optional: 1 presence bit on the wire, which also gates the field |
| +0x14 | u32 nested handle, or -1 |
| +0x18 | 16 raw bytes of params (meta schema 80800106 = 16 × u8). Ints: p0 bias, p1 bits. real32: p0 min, p1 max (f32), p2 bits (bits ≤ 0 or > 31 means raw IEEE). Nested: byte0 == 1 marks an array and p1 is the byte offset of the count field in the parent |

There are no per-member defaults in this format. 4402 records carry a definition (527 of them have 0 members) and 8506
have none (aliases, primitives, opaque types). Arrays (89): the count is always the member just before the
container, the element container's member count is `max`, and the count member's bits are `lengthBits` (resolved
in the JSON under `array`).

## Walkers and kind handler tables (decompile, with the key compares read in disasm)
- Decoder `sub_1570600`. 0x1570777 `cmp byte [m+0x11],0` is followed by `call sub_493060` (read the presence bit);
  0x15707B1 `movsx rax, byte [m+0x10]; cmp rax,1` (nested). 0x157089B `cmp byte [m+0x18],1` (array), then 0x15708B8
  reads the count as `*(i32*)(struct + p1)`. Every other kind goes to `call [0x2061B80 + kind*8 + 0x148]` (0x1570975).
  The nested schema is resolved through the datum array (`unk_2173A18`) to its record, then record+0x70.
- 41-entry tables at 0x2061140 + n×0x148: compare (0–3), **encode 0x2061660 / 0x20617A8 / 0x20618F0 / 0x2061A38**
  (walkers `sub_156F290` / `sub_156EE80` / `sub_156FA90` / `sub_156F690`), **decode 0x2061B80 / 0x2061CC8 /
  0x2061E10 / 0x2061F58** (`sub_1570A50` / `sub_1570600` / `sub_15712F0` / `sub_1570EA0`), copy (12–15), validate (16–17).
  41 kinds (0..40). The "42 handlers" in the retail hint does not apply to this build.
- Bits are packed MSB-first into a 64-bit accumulator (stream +0x28 bits, +0x30 count; spill `sub_492FD0`).

| kind | codec (encode table 0x2061660 entry) |
|---|---|
| 0, 32, 33 | nothing on the wire (nullsub). 1 = nested, done by the walker (also a nullsub in the table) |
| 2 | bool, 1 bit (`sub_1577360`) |
| 3/4/5, 7/8/9 | i8/i16/i32, u8/u16/u32: `(value + p0)` in p1 bits (`sub_15773A0` …). Decoder: `read(p1) - p0` (`sub_157C680`) |
| 6, 10 | u64, `value + p0` in p1 bits (`sub_1577460` / `sub_1577540` → `sub_492C30`) |
| 11 | real32, raw 32 bits or `sub_4922A0(…"real32", bits, min, max)` (`sub_1577560`) |
| 12, 37 | 64 raw bits (`sub_492A60(…,64)`) |
| 13/14, 40 | 3 floats (point/vector), 15–17 quaternion/rotation forms. Engine types, unverified |
| 18–23, 30, 31 | presence bit + 32-bit id (handles / names), each with its own resolver |
| 24–26 | variant: 6-bit kind tag, then that kind's codec (`sub_1577F70`) |
| 27–29, 34–36, 38, 39 | composite engine types. 34–36 re-enter the schema encoder `sub_731F20` with a handle |

## Validation against 41375 (x360 July 2014)
The 41375 hand-written files (`schemas.ts`, `queuez/*.ts`, AH `ah.ts`, `start-request.ts`) declare **246** schema
ids (248 declarations). All 246 are registered in the alpha. **229 match exactly**: member count, order, kind,
optional, bits, bias, nested id, array lengthBits/max, real32 params, and the 360 size equals sizes[0]. Both
duplicate declarations (ah.ts + self.ts) match too. **17 differ**. A second check compared the alpha with the raw
41375 `.schmr` dump (`scratch/ida/schmr/schmr_tu0.bin`). Of 4417 41375 struct definitions, 4389 are registered here
and **4234 are identical**. Of the 155 that differ, 73 are meta schemas where an i32 became a u64 (pointer-sized,
platform only), 24 changed size only through a nested type, 23 changed member count, 19 changed members, and 16
have no definition here. 28 handles are not registered at all (80800F1A–F24, 808036D4/D5, 8080304C/5B/5D,
80805B18/97/A0/A2/A9/AA/AF/B3/B6/B7/B8/BA).

| id | name (41375 file) | alpha vs 41375 |
|---|---|---|
| 80801920 | Unknown80801920 (self) | members swapped: alpha `{i8 2b bias1, u64}`, 41375 `{u64, i8}` |
| 8080176B | Unknown8080176B (self) | alpha `{opt i16, opt i32, opt i32, opt i32}`, 41375 `{opt i32 ×3, opt i16}` |
| 80801846 | Unknown80801846 (self) | alpha `{opt i16, opt 8080176B, opt u8, …, opt 80804629 last}`, 41375 order `{176B, 4629, i16, …, u8}` |
| 80801732 | InventoryItem | alpha `{u64, opt i16 defIndex, opt 80801920, opt 80801711, …}`, 41375 has the i16 at slot 3. size 0x80 (41375 0x78). checksum 11205AEE |
| 80801724 | Unknown80801724 (self) | 5 optional members `{80804599, 8080470E (32×u64), 80804599, 808047AC, u64}`, 41375 has 2 `{80804599, u64}`. size 0x388 |
| 80801714 / 80801743 | SelfCharacter / SelfInventory | same members, size 0x58F0 (41375 0x55B0) through 8080176B/80801724. checksums 354E2318 / D34ABC22 |
| 808017A5 | InspectionCharacter | same members, size 0x1AB8 (0x1778). checksum DDFC637C |
| 80801803, 808018C7 | SelfPrimary, Unknown808018C7 | layout identical, checksum 21C2FDAC / 1231F678 (41375 88190FE1 / B74ADE8B) |
| 8080071E | SquadAuth (ah) | m3 is 80804252 = `array(i32, 4b, max 8)`, 41375 has 80805B79 `array(i16, 4b, 8)`. size 0x70 |
| 80805B79 | SquadRoster (ah) | registered but no definition here (base 80800009, size 0x90) |
| 80800646 | PlayerIdentity (ah) | m0 is kind 35 in **both** builds. The TS i64 is a stand-in |
| 808044D3, 808044D4, 80804BAC | start-request.ts | TS is hand-modelled. Both `.schmr`s agree with the alpha (kind 26, `{i8 1b bias1}`, kind 33) |
| 80800487, 80801A55, 808044EB | start-request.ts | no struct definition in either build (hand-modelled in TS) |

So the BAP message and family schemas carry over, except for the self/inspection character subtree and the
queuez checksums. A day0-alpha build folder needs the alpha checksums from `checksum` in the catalog.

## Network id → schema
- **Activity host** (`sub_710E40`): bitmask 0x7BFFFDA711F with jump table 0x205F750 → getter stubs at 0x156C1A0…
  (`lea rax,slot; mov rax,[rax]; mov eax,[rax]`) → class handle global → class table checksum → record. Names come
  from `sub_710E30` (table 0x205F5F0, 43 entries, same order as day0 `ActivityHostMessageType`). The dumper writes
  them all under `activityHostMessages`. 0 entity_slots_allocated 80800D64, 1 global_activity_state 80800E76,
  2 world_globals_state 80800DC1, 3 join_request 80800E98, 4 join_result 80800A58, 8 request_activity_host 808009C5,
  12/13 peer reservation 80800BB9/80800A1D, 14 80800E84, 17 state_refresh 808009E7, 19/20 entity indices
  80800D21/80800E22, 22 client_identity_update 80800C2D, 23–31 entity-slot authority 80800D58 … 80800CF6,
  32 80800A22, 33 80800A3D, 34 80800C31, 35 80800A17, 36 80800BD0, 37 heartbeat 80800D06, 39 script_event 80800C0A,
  40 80800EC9, 41 80800CAE, 42 80800ADC. Ids 5–7, 9–11, 15, 16, 18, 21 and 38 are outside the mask (custom
  serializers). The ids that 41375 also declares agree.
- **BAP**: there is no nid → schema table in the eboot (the only other getter stubs belong to incident-metadata
  vtables). On the 360 it is the server_message SharedDef in investment_globals, so it must come from the alpha packages.

## Caveats
- Kinds 12–40 are described from the encoder handlers only. Names are unknown, and only 26, 33, 34 and 35 occur in the 41375-declared schemas (once each).
- sizes[1]/[2] platform identity, header +0x0C/+0x10/+0x3C..+0x6F, the attribute objects and the member f32 are
  kept raw, not interpreted.
