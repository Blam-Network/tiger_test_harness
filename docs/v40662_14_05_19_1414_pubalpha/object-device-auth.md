# Object auth, device and interactable on the PS4 alpha (40662 pubalpha) — 2026-10-22

// Question: does the alpha's ObjectAuth / device / interactable wire differ from 41375 (TU0), so
// that day0's copied encoder is misread (The Dark Within: the Ghost keeps scanning the door
// console, o_door01 never opens)? Sources: eboot IDA :13342 (alpha-40662-CUSA00942/eboot.bin.i64,
// server_health checked), TU0 default.xex IDA :13340, the catalog rsat-descriptors.json, the
// day0 run logs/start-pubalpha-20261022-032915.out and its datamine (logs/datamine/33ed3eee…).
// Compares cited from disassembly were read in the listing, not only the decompiler.

## The wire is the same as 41375 and as what day0 writes

// - 808007D9 ObjectAuth (224 B): i32 generation (32 b, bias 0x80000000), bool present, nested
//   808004B1 SensorClientRef, nested 80804117. Catalog member list = the hand-written encoder;
//   schemas.test.ts also checks the zero body (89 bits).
// - 80804117: i32 count (2 bits), then 80804153 = three kind-34 members (array, max 3).
// - Kind 34: decode 0x157D1B0 / encode 0x15785B0 (tables 0x2061B80 / 0x2061660 + 34*8, resolved
//   through DT_SCE_RELA). Both first run the header schema *0x20D8548 = 80800046 (one kind-23
//   member), then, when the handle at +0 is not -1, the body at +0x10 in that handle's schema.
//   Kind 23 (enc 0x1577EC0, dec 0x157CD80): 1 present bit (value != -1), then 32 raw bits.
//   So an element is: present bit + 32-bit class handle + body, exactly what encodeObjectAuth writes.
// - The class handles are the registry handles: sub_535230 stores sub_48D780's result,
//   index | (table << 13 & 0x7FFE000) | 0x80000000, into each class global. Device global
//   0x25AFC30 (slot 0x20F5668) = 8080279A, interactable 0x25AFD10 (slot 0x20F56A0) = 80802140.
//   Checksums 97403A95 / CCC5CE82 are unique in the catalog.
// - 8080279A device: 9 members, i32/i32/f32 x3, all 32 bits. 80802140 interactable: i8 2b bias 1,
//   808004B1, i32, bool. Same as 41375.

## The client apply paths match TU0 too

// - Object auth received: alpha sub_5860B0 (handler table 0x2065040, hash 3088896A) ~ TU0
//   sub_825D0C90 (table 0x82022D9C). Both memcpy the 224-byte auth, then apply the vec with
//   sub_587D80 / sub_825D0510, gated the same way: an entity must exist, and for a row whose
//   definition flag is set (alpha def+0xA4, TU0 def+0x68) the entity's creation generation must
//   equal auth.generation.
// - Device apply: alpha sub_9FB700 (table 0x20E8FF8, hash D82AE4E3) ~ TU0 sub_82804E48. Both test
//   the entity's bit in the mask dword_2332580 (TU0 dword_83508920; bit 0 of entity +0x110, set by
//   sub_73EA00), find the 8080279A element, and take each triple when its stamp is greater than the
//   kept one. Alpha init (0x9F9BB7..0x9F9BE6): power/lock/position stamps 0, their second i32 -1,
//   power 1.0. The second i32 of a triple passes a snap flag to the setter (0x9FB80F, 0x9FB85C).
// - Interactable: sub_821130 (mode, filter), sub_8215A0 (used latch +0x2BC / stamp +0x2C0, the
//   newer of the auth's and the sense's stamp wins), use sub_821430 (def+0x288 mode: 0/2 one-shot,
//   1 toggle; then the use action def+0x28C via sub_820B00).
// - The Ghost: c_action_impl_ghost_interact (typeinfo 0x20852E0, vtable 0x2085270; start
//   sub_7DF270) picks its animation from a list of {name, range} entries against a float of the
//   object, consistent with the scan following the console's device. Not traced to the end.

## o_door01: no create

// The pubalpha script (a TU0 port) never calls o_door01.create(); the TU0 one doesn't either. The
// row stays absent (incarnation 0), so the client has no door entity and sub_587D80 has nothing to
// apply the device to: "device position 1 stamp 1" goes nowhere. The beacons and chests log
// "object present" because their scripts create them. The only o_door01 create in the run is the
// debugger's (03:39:07, gen 4, then position 1 stamp 3). evil's enc_dome_a_m1.es gained
// o_door01.create() on 2026-10-20. Retail (2.3.1, act_cosmo_m4_dome_c, 799.7 s) sends
// enc_dome_a_m4's o_door01 as incarnation 1, present, device {0,0,1, 0,0,0, 1,0,1} in one update.
// Fixed 2026-10-22: tiger fukugen-daihon v40662 enc_dome_a_m1.es creates it at startup.

## Still open: the console's device

// Nothing found on the wire or in the client that ignores the console's device writes
// (0.4 stamp 1, then 1 stamp 2). Divergences from retail that remain:
// - interactable_placement re-arms the console 3 s after the use (usedStamp 1, used false) while
//   the Ghost is still scanning, because obj_m1_o1b keeps its activity flag up 6.9 s. In retail
//   Devil's Lair (2026-10-03_02-51-47 cosmo_portal_1, 153.6 s) the flag drops with the use and the
//   interactable stays {1, filter, 0, false} to the end. sub_8215A0 takes our stamp 1 (> 0).
// - retail creates device objects with the 8080279A component already on (power 1, stamps 0);
//   ours adds it on the first set_device_position, a tick after the create.
// The day0 sense walk could not read an ObjectSense with components (kind 34 was opaque), so
// every row after it in a sense update was dropped. ah.ts now decodes the vec (80802A74 device and
// 80802021 interactable twins added, catalog-checked) and the session logs
// "activities:script: object 0x… #N sense device position P stamp S" on each change. Whether that
// stamp reaches 2 on the console after "device position 1 stamp 2" answers whether the client
// took the write.
