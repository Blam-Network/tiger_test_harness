import { rsat } from "@blamnetwork/rsat";
import type { SelectCharacterSchemas } from "./select-character";
import type { SharedSchemas } from "./shared";

export function defineSelfSchemas(
  deps: Pick<
    SharedSchemas,
    | "AppearanceEc"
    | "AppearanceF0"
    | "Unknown80801C03"
    | "Unknown808017D2"
    | "Unknown808017D3"
    | "Unknown808019E1"
    | "Unknown80801768"
  > &
    Pick<SelectCharacterSchemas, "SelectCharacterRoster">
) {
  const {
    AppearanceEc,
    AppearanceF0,
    Unknown80801C03,
    Unknown808017D2,
    Unknown808017D3,
    Unknown808019E1,
    Unknown80801768,
    SelectCharacterRoster,
  } = deps;

  const Unknown8080024A = rsat.schema(0x8080024a, {
    unknown0: rsat.repeat(rsat.u8(), 16),
  });

  const Unknown80800E26 = rsat.schema(0x80800e26, {
    unknown0: rsat.repeat(rsat.u32(), 4),
  });

  const Unknown80800E31 = rsat.schema(0x80800e31, {
    unknown0: rsat.repeat(rsat.u8(), 8),
  });

  const Unknown80800E38 = rsat.schema(0x80800e38, {
    unknown0: rsat.repeat(rsat.u8(), 36),
  });

  const Unknown80801BD0 = rsat.schema(0x80801bd0, {
    unknown0: rsat.optionsArray(rsat.i8({ size: 2, bias: 1 }), 128),
  });

  const Unknown808017AF = rsat.schema(0x808017af, {
    unknown0: rsat.bool(),
    unknown1: rsat.nested(Unknown80801BD0),
  });

  const Unknown808017B5 = rsat.schema(0x808017b5, {
    unknown0: rsat.f32(),
    unknown1: rsat.f32(),
  });

  const Unknown808017B6 = rsat.schema(0x808017b6, {
    unknown0: rsat.optional(rsat.nested(Unknown808017B5)),
    unknown1: rsat.optional(rsat.nested(Unknown808017B5)),
  });

  const Unknown808017BF = rsat.schema(0x808017bf, {
    unknown0: rsat.optional(rsat.i8({ size: 3, bias: 1 })),
    unknown1: rsat.optional(rsat.i8({ size: 3, bias: 1 })),
    unknown2: rsat.optional(rsat.i8({ size: 4, bias: 1 })),
    unknown3: rsat.presentOptions(rsat.i8({ size: 2, bias: 1 }), 4),
    unknown7: rsat.optional(rsat.i8({ size: 3, bias: 1 })),
    unknown8: rsat.optional(rsat.bool()),
    unknown9: rsat.optional(rsat.bool()),
    unknown10: rsat.optional(rsat.bool()),
  });

  const Unknown808017C3 = rsat.schema(0x808017c3, {
    unknown0: rsat.optional(rsat.nested(Unknown808017B6)),
    unknown1: rsat.optional(rsat.nested(Unknown808017BF)),
  });

  const Unknown80801BD2 = rsat.schema(0x80801bd2, {
    unknown0: rsat.presentOptions(rsat.u64(), 128),
  });

  const Unknown808017C4 = rsat.schema(0x808017c4, {
    unknown0: rsat.optional(rsat.nested(Unknown80801BD2)),
    unknown1: rsat.optional(rsat.nested(Unknown808017C3)),
  });

  const Unknown808017C9 = rsat.schema(0x808017c9, {
    soid: rsat.optional(rsat.u64()),
    // The roster of the account's characters. Item-changed callbacks resolve
    // an item's owner by walking this roster's bags; without it any item
    // update asserts.
    unknown1: rsat.optional(rsat.nested(SelectCharacterRoster)),
    characterSoid: rsat.optional(rsat.u64()),
    unknown3: rsat.optional(rsat.rawBytes()),
    unknown4: rsat.optional(rsat.i8({ size: 2, bias: 1 })),
    unknown5: rsat.optional(rsat.rawBytes()),
    unknown6: rsat.optional(rsat.rawBytes()),
    unknown7: rsat.nested(Unknown808017AF),
    unknown8: rsat.optional(rsat.rawBytes()),
  });

  const Unknown8080181E = rsat.schema(0x8080181e, {
    unknown0: rsat.i32(),
    unknown1: rsat.u64(),
  });

  const Unknown8080181F = rsat.schema(0x8080181f, {
    unknown0: rsat.nested(Unknown8080181E),
    unknown1: rsat.i32(),
  });

  const Unknown8080187A = rsat.schema(0x8080187a, {
    defIndex: rsat.optional(rsat.i16({ bias: 0x8000 })),
    soid: rsat.optional(rsat.u64()),
    unknown2: rsat.optional(rsat.i32({ bias: 0x80000000 })),
    unknown3: rsat.optional(rsat.i32({ bias: 0x80000000 })),
  });

  // A {stat index, value} pair of the item's stat block. Biases: index 0x80,
  // value 0x80000000, as in the ability-binding pair 8080198F below.
  const Unknown8080188A = rsat.schema(0x8080188a, {
    unknown0: rsat.optional(rsat.i8({ bias: 0x80 })),
    unknown1: rsat.optional(rsat.i32({ bias: 0x80000000 })),
  });

  const Unknown80804BAA = rsat.schema(0x80804baa, {
    unknown0: rsat.optional(rsat.i16()),
    unknown1: rsat.optional(rsat.u64()),
    unknown2: rsat.optional(rsat.i32()),
  });

  const Unknown80804BAB = rsat.schema(0x80804bab, {
    unknown0: rsat.array(rsat.nested(Unknown80804BAA), {
      lengthBits: 3,
      max: 4,
    }),
  });

  const Unknown8080188D = rsat.schema(0x8080188d, {
    unknown0: rsat.optional(rsat.nested(Unknown80804BAB)),
    unknown1: rsat.optional(rsat.nested(Unknown80804BAA)),
    unknown2: rsat.optional(rsat.i32()),
    unknown3: rsat.optional(rsat.u64()),
  });

  const Unknown80801BE0 = rsat.schema(0x80801be0, {
    unknown0: rsat.repeat(rsat.nested(Unknown8080188D), 30),
  });

  const Unknown8080188F = rsat.schema(0x8080188f, {
    unknown0: rsat.optional(rsat.i32()),
    unknown1: rsat.optional(rsat.nested(Unknown80801BE0)),
  });

  // A 2-bit count and that many 8-byte {key, value} stat slots, up to two: the
  // client's own schema, the same shape as 808017D3. Packing both slots into
  // one array element puts a second slot on the wire that the client reads as
  // the i16 and the talent grid's presence bit (items show 21/16 instead of
  // their power and lose their talent grid).
  const Unknown80801890 = rsat.schema(0x80801890, {
    unknown0: rsat.array(rsat.nested(Unknown8080188A), {
      lengthBits: 2,
      max: 2,
    }),
  });

  const Unknown808018E2 = rsat.schema(0x808018e2, {
    unknown0: rsat.optional(rsat.i8()),
    unknown1: rsat.optional(rsat.i32()),
  });

  const Unknown80801BE9 = rsat.schema(0x80801be9, {
    unknown0: rsat.repeat(rsat.nested(Unknown808018E2), 7),
  });

  const Unknown808018E5 = rsat.schema(0x808018e5, {
    unknown0: rsat.optional(rsat.bool()),
    unknown1: rsat.optional(rsat.nested(Unknown80801BE9)),
  });

  const Unknown808018E6 = rsat.schema(0x808018e6, {
    unknown0: rsat.array(rsat.nested(Unknown80801768), {
      lengthBits: 3,
      max: 5,
    }),
  });

  const Unknown808018E7 = rsat.schema(0x808018e7, {
    unknown0: rsat.optional(rsat.i32()),
    unknown1: rsat.optional(rsat.i32()),
    unknown2: rsat.optional(rsat.i16()),
    unknown3: rsat.optional(rsat.nested(Unknown808018E5)),
    unknown4: rsat.optional(rsat.nested(Unknown808018E5)),
    unknown5: rsat.optional(rsat.nested(Unknown808018E6)),
    unknown6: rsat.optional(rsat.bool()),
    unknown7: rsat.optional(rsat.i32()),
  });

  // The item instance's stat block: unknown0 is up to 2 stat {key, value}
  // pairs (80801890), unknown1 a lone i16 bias 0x8000 pre-curve scalar. This is
  // the power input: the client scans unknown0 for the key-0 slot and feeds its
  // value into the scaling curve (the RoF / handling tables are a different
  // path).
  const Unknown808018F2 = rsat.schema(0x808018f2, {
    unknown0: rsat.optional(rsat.nested(Unknown80801890)),
    unknown1: rsat.optional(rsat.i16({ bias: 0x8000 })),
  });

  const Unknown80801BEB = rsat.schema(0x80801beb, {
    unknown0: rsat.presentOptions(rsat.f32(), 12),
  });

  const Unknown80801925 = rsat.schema(0x80801925, {
    unknown0: rsat.optional(rsat.nested(Unknown80801BEB)),
    unknown1: rsat.optional(rsat.i8()),
  });

  // A loot slot: unknown0 item def index (0xFFFF empty; rsat's i16 default,
  // bias 0x8000), unknown1 quantity (i32 default, bias 2^31), unknown2 state
  // (3/5 = on the ground), unknown3 the loot nonce, unknown4 the bauble
  // cosmetic nest (always sent absent).
  const Unknown8080195F = rsat.schema(0x8080195f, {
    unknown0: rsat.optional(rsat.i16()),
    unknown1: rsat.optional(rsat.i32()),
    unknown2: rsat.optional(rsat.i8({ size: 3, bias: 1 })),
    unknown3: rsat.optional(rsat.nested(Unknown8080181F)),
    unknown4: rsat.optional(rsat.nested(Unknown808018F2)),
  });

  const Unknown80801BEC = rsat.schema(0x80801bec, {
    unknown0: rsat.presentOptions(rsat.f32(), 16),
  });

  const Unknown80801BED = rsat.schema(0x80801bed, {
    unknown0: rsat.repeat(rsat.nested(Unknown80801925), 16),
  });

  const Unknown80801964 = rsat.schema(0x80801964, {
    unknown0: rsat.optional(rsat.u32()),
    unknown1: rsat.optional(rsat.nested(Unknown80801BEC)),
    unknown2: rsat.optional(rsat.nested(Unknown80801BED)),
  });

  // The loot slot table: 64 slots, always present once the parent's unknown1
  // is; each slot's own fields stay individually optional (like the bag's
  // 256 x 8080187A in Unknown80801BFD below).
  const Unknown80801BEE = rsat.schema(0x80801bee, {
    unknown0: rsat.repeat(rsat.nested(Unknown8080195F), 64),
  });

  // SelfCharacter.unknown9: unknown1 is the loot slot table; unknown0 and
  // unknown2 are unread by the loot code and always sent absent.
  const Unknown80801966 = rsat.schema(0x80801966, {
    unknown0: rsat.optional(rsat.i32()),
    unknown1: rsat.optional(rsat.nested(Unknown80801BEE)),
    unknown2: rsat.optional(rsat.nested(Unknown80801964)),
  });

  // {node, step} ability binding pair. Biases: node 0x80, step 0x80000000.
  const Unknown8080198F = rsat.schema(0x8080198f, {
    unknown0: rsat.i8({ bias: 0x80 }),
    unknown1: rsat.i32({ bias: 0x80000000 }),
  });

  // 80801BF3: 50 u8 activated-step count per talent grid node. 80801BF4: 5 x
  // {node, step} ability-binding pairs, sentinel {-1,-1}. Both nest into
  // 808019AE below.
  const Unknown80801BF3 = rsat.schema(0x80801bf3, {
    unknown0: rsat.repeat(rsat.u8(), 50),
  });

  const Unknown80801BF4 = rsat.schema(0x80801bf4, {
    unknown0: rsat.repeat(rsat.nested(Unknown8080198F), 5),
  });

  const Unknown808019AE = rsat.schema(0x808019ae, {
    unknown0: rsat.optional(rsat.i16({ bias: 0x8000 })),
    unknown1: rsat.optional(rsat.nested(Unknown808017D2)),
    unknown2: rsat.optional(rsat.u8()),
    unknown3: rsat.optional(rsat.u8()),
    unknown4: rsat.optional(rsat.nested(Unknown80801BF3)),
    unknown5: rsat.optional(rsat.nested(Unknown80801BF4)),
  });

  const Unknown80801BFD = rsat.schema(0x80801bfd, {
    unknown0: rsat.repeat(rsat.nested(Unknown8080187A), 256),
  });

  const Unknown808019DA = rsat.schema(0x808019da, {
    unknown0: rsat.optional(rsat.i32({ bias: 0x80000000 })),
    unknown1: rsat.optional(rsat.nested(Unknown80801BFD)),
  });

  const Unknown808019DF = rsat.schema(0x808019df, {
    unknown0: rsat.i16({ bias: 0x8000 }),
    unknown1: rsat.i32({ bias: 0x80000000 }),
    unknown2: rsat.u32({ bias: 0 }),
    unknown3: rsat.bool(),
  });

  const Unknown808019E2 = rsat.schema(0x808019e2, {
    unknown0: rsat.optional(rsat.f32()),
    unknown1: rsat.optional(rsat.f32()),
    unknown2: rsat.optional(rsat.f32()),
  });

  const Unknown808019E4 = rsat.schema(0x808019e4, {
    unknown0: rsat.optional(rsat.nested(Unknown808019E2)),
    unknown1: rsat.optional(rsat.nested(Unknown80800E26)),
  });

  const Unknown808019E6 = rsat.schema(0x808019e6, {
    unknown0: rsat.i8(),
    unknown1: rsat.i8({ size: 3, bias: 1 }),
  });

  const Unknown808019E7 = rsat.schema(0x808019e7, {
    unknown0: rsat.optional(rsat.nested(Unknown808019E6)),
    unknown1: rsat.optional(rsat.i32()),
    unknown2: rsat.optional(rsat.i8()),
  });

  const Unknown80801BFF = rsat.schema(0x80801bff, {
    unknown0: rsat.repeat(rsat.i16(), 17),
  });

  const Unknown808019E9 = rsat.schema(0x808019e9, {
    unknown0: rsat.optional(rsat.u64()),
    unknown1: rsat.optional(rsat.i8()),
    unknown2: rsat.optional(rsat.nested(Unknown80801BFF)),
    unknown3: rsat.optional(rsat.u8({ size: 4, bias: 0 })),
  });

  const Unknown808044B3 = rsat.schema(0x808044b3, {
    unknown0: rsat.nested(Unknown80800E31),
    unknown1: rsat.nested(Unknown80800E38),
    unknown2: rsat.nested(Unknown8080024A),
  });

  const Unknown808019EC = rsat.schema(0x808019ec, {
    unknown0: rsat.optional(rsat.nested(Unknown808044B3)),
    unknown1: rsat.optional(rsat.u64()),
  });

  const Unknown808019EE = rsat.schema(0x808019ee, {
    unknown0: rsat.optional(rsat.i32()),
    unknown1: rsat.optional(rsat.f32()),
  });

  const Unknown80801C00 = rsat.schema(0x80801c00, {
    unknown0: rsat.repeat(rsat.nested(Unknown808019E9), 20),
  });

  const Unknown80801C01 = rsat.schema(0x80801c01, {
    unknown0: rsat.repeat(rsat.u32(), 8),
  });

  const Unknown808019F2 = rsat.schema(0x808019f2, {
    unknown0: rsat.optional(rsat.nested(Unknown808019E7)),
    unknown1: rsat.optional(rsat.nested(Unknown80801C00)),
    unknown2: rsat.optional(rsat.nested(Unknown808019EC)),
    unknown3: rsat.optional(rsat.u32()),
    unknown4: rsat.optional(rsat.nested(Unknown80801C01)),
  });

  const Unknown808019F3 = rsat.schema(0x808019f3, {
    unknown0: rsat.optional(rsat.nested(Unknown808019E4)),
    unknown1: rsat.optional(rsat.nested(Unknown808019F2)),
  });

  const Unknown80801A0B = rsat.schema(0x80801a0b, {
    unknown0: rsat.optional(rsat.i8({ size: 2, bias: 1 })),
    unknown1: rsat.optional(rsat.u64()),
  });

  const Unknown80801BD1 = rsat.schema(0x80801bd1, {
    unknown0: rsat.presentOptions(rsat.i32(), 128),
  });

  const Unknown80801BEA = rsat.schema(0x80801bea, {
    unknown0: rsat.repeat(rsat.nested(Unknown80801768), 5),
  });

  const Unknown80801C05 = rsat.schema(0x80801c05, {
    unknown0: rsat.presentOptions(rsat.u64(), 32),
  });

  const Unknown80804BE0 = rsat.schema(0x80804be0, {
    unknown0: rsat.repeat(rsat.nested(Unknown80804BAA), 4),
  });

  const InventoryItem = rsat.schema(0x80801a25, {
    soid: rsat.optional(rsat.u64()),
    defIndex: rsat.optional(rsat.i16({ bias: 0x8000 })),
    unknown2: rsat.optional(rsat.nested(Unknown80801A0B)),
    // The item's stat block (808018F2), sent present with the item's own
    // power in the key-0 slot (values.ts): without it the client renders the
    // curve floor (power 10) whatever a vendor lists. The authored number
    // lives in the vendor purchase entry, not the item def.
    unknown3: rsat.optional(rsat.nested(Unknown808018F2)),
    unknown4: rsat.optional(rsat.nested(Unknown808019AE)),
  });

  // 808017D0 — self type-0.
  const SelfPrimary = rsat.schema(0x808017d0, {
    unknown0: rsat.nested(Unknown808017C9),
  });

  // 808019FC — self type-1 character.
  const SelfCharacter = rsat.schema(0x808019fc, {
    soid: rsat.optional(rsat.u64()),
    unknown1: rsat.optional(rsat.nested(AppearanceEc)),
    unknown2: rsat.optional(rsat.nested(AppearanceF0)),
    unknown3: rsat.optional(rsat.nested(Unknown808019DA)),
    unknown4: rsat.optional(rsat.nested(Unknown80801C03)),
    unknown5: rsat.optional(rsat.nested(Unknown808019DF)),
    // Character profile (808019F3): 808019E4.808019E2 holds the per-weapon-slot
    // ammo fractions (primary/special/heavy) the guest fills weapons from on
    // load; the client writes it back with profile_set_character_profile (702).
    unknown6: rsat.optional(rsat.nested(Unknown808019F3)),
    unknown7: rsat.optional(rsat.nested(Unknown808017D3)),
    unknown8: rsat.optional(rsat.nested(Unknown808019E1)),
    // Loot slot table: 64 ground-loot records the
    // client spawns baubles from. Absent keeps whatever the client already
    // has; a fresh character sends this absent too (nothing to say yet).
    unknown9: rsat.optional(rsat.nested(Unknown80801966)),
    unknown10: rsat.optional(rsat.rawBytes()),
    unknown11: rsat.optional(rsat.rawBytes()),
    unknown12: rsat.optional(rsat.rawBytes()),
    unknown13: rsat.optional(rsat.rawBytes()),
    unknown14: rsat.optional(rsat.rawBytes()),
    unknown15: rsat.optional(rsat.rawBytes()),
    unknown16: rsat.optional(rsat.rawBytes()),
    unknown17: rsat.optional(rsat.rawBytes()),
    unknown18: rsat.optional(rsat.rawBytes()),
  });

  // 80801A01 — self type-1 inventory wrapper.
  const SelfInventory = rsat.schema(0x80801a01, {
    unknown0: rsat.nested(SelfCharacter),
  });
  return {
    Unknown8080024A,
    Unknown80800E26,
    Unknown80800E31,
    Unknown80800E38,
    Unknown80801BD0,
    Unknown808017AF,
    Unknown808017B5,
    Unknown808017B6,
    Unknown808017BF,
    Unknown808017C3,
    Unknown80801BD2,
    Unknown808017C4,
    Unknown808017C9,
    Unknown8080181E,
    Unknown8080181F,
    Unknown8080187A,
    Unknown8080188A,
    Unknown80804BAA,
    Unknown80804BAB,
    Unknown8080188D,
    Unknown80801BE0,
    Unknown8080188F,
    Unknown80801890,
    Unknown808018E2,
    Unknown80801BE9,
    Unknown808018E5,
    Unknown808018E6,
    Unknown808018E7,
    Unknown808018F2,
    Unknown80801BEB,
    Unknown80801925,
    Unknown8080195F,
    Unknown80801BEC,
    Unknown80801BED,
    Unknown80801964,
    Unknown80801BEE,
    Unknown80801966,
    Unknown8080198F,
    Unknown80801BF3,
    Unknown80801BF4,
    Unknown808019AE,
    Unknown80801BFD,
    Unknown808019DA,
    Unknown808019DF,
    Unknown808019E2,
    Unknown808019E4,
    Unknown808019E6,
    Unknown808019E7,
    Unknown80801BFF,
    Unknown808019E9,
    Unknown808044B3,
    Unknown808019EC,
    Unknown808019EE,
    Unknown80801C00,
    Unknown80801C01,
    Unknown808019F2,
    Unknown808019F3,
    Unknown80801A0B,
    Unknown80801BD1,
    Unknown80801BEA,
    Unknown80801C05,
    Unknown80804BE0,
    InventoryItem,
    SelfPrimary,
    SelfCharacter,
    SelfInventory,
  };
}

export type SelfSchemas = ReturnType<typeof defineSelfSchemas>;

export type SelfCharacterValue = rsat.Infer<SelfSchemas["SelfCharacter"]>;
export type InventoryItemValue = rsat.Infer<SelfSchemas["InventoryItem"]>;
