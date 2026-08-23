import { rsat } from "@blamnetwork/rsat";
import {
  AppearanceEc,
  AppearanceF0,
  Unknown80801C03,
  Unknown808017D2,
  Unknown808017D3,
  Unknown808019E1,
  Unknown80801768,
} from "../shared";

export const Unknown8080024A = rsat.schema(0x8080024a, {
  unknown0: rsat.repeat(rsat.u8(), 16),
});

export const Unknown80800E26 = rsat.schema(0x80800e26, {
  unknown0: rsat.repeat(rsat.u32(), 4),
});

export const Unknown80800E31 = rsat.schema(0x80800e31, {
  unknown0: rsat.repeat(rsat.u8(), 8),
});

export const Unknown80800E38 = rsat.schema(0x80800e38, {
  unknown0: rsat.repeat(rsat.u8(), 36),
});

export const Unknown80801BD0 = rsat.schema(0x80801bd0, {
  unknown0: rsat.optionsArray(rsat.i8({ size: 2, bias: 1 }), 128),
});

export const Unknown808017AF = rsat.schema(0x808017af, {
  unknown0: rsat.bool(),
  unknown1: rsat.nested(Unknown80801BD0),
});

export const Unknown808017B5 = rsat.schema(0x808017b5, {
  unknown0: rsat.f32(),
  unknown1: rsat.f32(),
});

export const Unknown808017B6 = rsat.schema(0x808017b6, {
  unknown0: rsat.optional(rsat.nested(Unknown808017B5)),
  unknown1: rsat.optional(rsat.nested(Unknown808017B5)),
});

export const Unknown808017BF = rsat.schema(0x808017bf, {
  unknown0: rsat.optional(rsat.i8({ size: 3, bias: 1 })),
  unknown1: rsat.optional(rsat.i8({ size: 3, bias: 1 })),
  unknown2: rsat.optional(rsat.i8({ size: 4, bias: 1 })),
  unknown3: rsat.presentOptions(rsat.i8({ size: 2, bias: 1 }), 4),
  unknown7: rsat.optional(rsat.i8({ size: 3, bias: 1 })),
  unknown8: rsat.optional(rsat.bool()),
  unknown9: rsat.optional(rsat.bool()),
  unknown10: rsat.optional(rsat.bool()),
});

export const Unknown808017C3 = rsat.schema(0x808017c3, {
  unknown0: rsat.optional(rsat.nested(Unknown808017B6)),
  unknown1: rsat.optional(rsat.nested(Unknown808017BF)),
});

export const Unknown80801BD2 = rsat.schema(0x80801bd2, {
  unknown0: rsat.presentOptions(rsat.u64(), 128),
});

export const Unknown808017C4 = rsat.schema(0x808017c4, {
  unknown0: rsat.optional(rsat.nested(Unknown80801BD2)),
  unknown1: rsat.optional(rsat.nested(Unknown808017C3)),
});

export const Unknown808017C9 = rsat.schema(0x808017c9, {
  soid: rsat.optional(rsat.u64()),
  unknown1: rsat.optional(rsat.rawBytes()),
  characterSoid: rsat.optional(rsat.u64()),
  unknown3: rsat.optional(rsat.rawBytes()),
  unknown4: rsat.optional(rsat.i8({ size: 2, bias: 1 })),
  unknown5: rsat.optional(rsat.rawBytes()),
  unknown6: rsat.optional(rsat.rawBytes()),
  unknown7: rsat.nested(Unknown808017AF),
  unknown8: rsat.optional(rsat.rawBytes()),
});

export const Unknown8080181E = rsat.schema(0x8080181e, {
  unknown0: rsat.i32(),
  unknown1: rsat.u64(),
});

export const Unknown8080181F = rsat.schema(0x8080181f, {
  unknown0: rsat.nested(Unknown8080181E),
  unknown1: rsat.i32(),
});

export const Unknown8080187A = rsat.schema(0x8080187a, {
  defIndex: rsat.optional(rsat.i16({ bias: 0x8000 })),
  soid: rsat.optional(rsat.u64()),
  unknown2: rsat.optional(rsat.i32({ bias: 0x80000000 })),
  unknown3: rsat.optional(rsat.i32({ bias: 0x80000000 })),
});

export const Unknown8080188A = rsat.schema(0x8080188a, {
  unknown0: rsat.optional(rsat.i8()),
  unknown1: rsat.optional(rsat.i32()),
});

export const Unknown80804BAA = rsat.schema(0x80804baa, {
  unknown0: rsat.optional(rsat.i16()),
  unknown1: rsat.optional(rsat.u64()),
  unknown2: rsat.optional(rsat.i32()),
});

export const Unknown80804BAB = rsat.schema(0x80804bab, {
  unknown0: rsat.array(rsat.nested(Unknown80804BAA), { lengthBits: 3, max: 4 }),
});

export const Unknown8080188D = rsat.schema(0x8080188d, {
  unknown0: rsat.optional(rsat.nested(Unknown80804BAB)),
  unknown1: rsat.optional(rsat.nested(Unknown80804BAA)),
  unknown2: rsat.optional(rsat.i32()),
  unknown3: rsat.optional(rsat.u64()),
});

export const Unknown80801BE0 = rsat.schema(0x80801be0, {
  unknown0: rsat.repeat(rsat.nested(Unknown8080188D), 30),
});

export const Unknown8080188F = rsat.schema(0x8080188f, {
  unknown0: rsat.optional(rsat.i32()),
  unknown1: rsat.optional(rsat.nested(Unknown80801BE0)),
});

export const Unknown80801BE1 = rsat.schema(0x80801be1, {
  unknown0: rsat.nested(Unknown8080188A),
  unknown1: rsat.nested(Unknown8080188A),
});

export const Unknown80801890 = rsat.schema(0x80801890, {
  unknown0: rsat.array(rsat.nested(Unknown80801BE1), { lengthBits: 2, max: 3 }),
});

export const Unknown808018E2 = rsat.schema(0x808018e2, {
  unknown0: rsat.optional(rsat.i8()),
  unknown1: rsat.optional(rsat.i32()),
});

export const Unknown80801BE9 = rsat.schema(0x80801be9, {
  unknown0: rsat.repeat(rsat.nested(Unknown808018E2), 7),
});

export const Unknown808018E5 = rsat.schema(0x808018e5, {
  unknown0: rsat.optional(rsat.bool()),
  unknown1: rsat.optional(rsat.nested(Unknown80801BE9)),
});

export const Unknown808018E6 = rsat.schema(0x808018e6, {
  unknown0: rsat.array(rsat.nested(Unknown80801768), { lengthBits: 3, max: 5 }),
});

export const Unknown808018E7 = rsat.schema(0x808018e7, {
  unknown0: rsat.optional(rsat.i32()),
  unknown1: rsat.optional(rsat.i32()),
  unknown2: rsat.optional(rsat.i16()),
  unknown3: rsat.optional(rsat.nested(Unknown808018E5)),
  unknown4: rsat.optional(rsat.nested(Unknown808018E5)),
  unknown5: rsat.optional(rsat.nested(Unknown808018E6)),
  unknown6: rsat.optional(rsat.bool()),
  unknown7: rsat.optional(rsat.i32()),
});

export const Unknown808018F2 = rsat.schema(0x808018f2, {
  unknown0: rsat.optional(rsat.nested(Unknown80801890)),
  unknown1: rsat.optional(rsat.i16()),
});

export const Unknown80801BEB = rsat.schema(0x80801beb, {
  unknown0: rsat.presentOptions(rsat.f32(), 12),
});

export const Unknown80801925 = rsat.schema(0x80801925, {
  unknown0: rsat.optional(rsat.nested(Unknown80801BEB)),
  unknown1: rsat.optional(rsat.i8()),
});

export const Unknown8080195F = rsat.schema(0x8080195f, {
  unknown0: rsat.optional(rsat.i16()),
  unknown1: rsat.optional(rsat.i32()),
  unknown2: rsat.optional(rsat.i8({ size: 3, bias: 1 })),
  unknown3: rsat.optional(rsat.nested(Unknown8080181F)),
  unknown4: rsat.optional(rsat.nested(Unknown808018F2)),
});

export const Unknown80801BEC = rsat.schema(0x80801bec, {
  unknown0: rsat.presentOptions(rsat.f32(), 16),
});

export const Unknown80801BED = rsat.schema(0x80801bed, {
  unknown0: rsat.repeat(rsat.nested(Unknown80801925), 16),
});

export const Unknown80801964 = rsat.schema(0x80801964, {
  unknown0: rsat.optional(rsat.u32()),
  unknown1: rsat.optional(rsat.nested(Unknown80801BEC)),
  unknown2: rsat.optional(rsat.nested(Unknown80801BED)),
});

export const Unknown80801BEE = rsat.schema(0x80801bee, {
  unknown0: rsat.repeat(rsat.nested(Unknown8080195F), 64),
});

export const Unknown80801966 = rsat.schema(0x80801966, {
  unknown0: rsat.optional(rsat.i32()),
  unknown1: rsat.optional(rsat.nested(Unknown80801BEE)),
  unknown2: rsat.optional(rsat.nested(Unknown80801964)),
});

export const Unknown8080198F = rsat.schema(0x8080198f, {
  unknown0: rsat.i8(),
  unknown1: rsat.i32(),
});

export const Unknown808019AE = rsat.schema(0x808019ae, {
  unknown0: rsat.optional(rsat.i16({ bias: 0x8000 })),
  unknown1: rsat.optional(rsat.nested(Unknown808017D2)),
  unknown2: rsat.optional(rsat.u8()),
  unknown3: rsat.optional(rsat.u8()),
  unknown4: rsat.optional(rsat.rawBytes()),
  unknown5: rsat.optional(rsat.rawBytes()),
});

export const Unknown80801BFD = rsat.schema(0x80801bfd, {
  unknown0: rsat.repeat(rsat.nested(Unknown8080187A), 256),
});

export const Unknown808019DA = rsat.schema(0x808019da, {
  unknown0: rsat.optional(rsat.i32({ bias: 0x80000000 })),
  unknown1: rsat.optional(rsat.nested(Unknown80801BFD)),
});

export const Unknown808019DF = rsat.schema(0x808019df, {
  unknown0: rsat.i16({ bias: 0x8000 }),
  unknown1: rsat.i32({ bias: 0x80000000 }),
  unknown2: rsat.u32({ bias: 0 }),
  unknown3: rsat.bool(),
});

export const Unknown808019E2 = rsat.schema(0x808019e2, {
  unknown0: rsat.optional(rsat.f32()),
  unknown1: rsat.optional(rsat.f32()),
  unknown2: rsat.optional(rsat.f32()),
});

export const Unknown808019E4 = rsat.schema(0x808019e4, {
  unknown0: rsat.optional(rsat.nested(Unknown808019E2)),
  unknown1: rsat.optional(rsat.nested(Unknown80800E26)),
});

export const Unknown808019E6 = rsat.schema(0x808019e6, {
  unknown0: rsat.i8(),
  unknown1: rsat.i8({ size: 3, bias: 1 }),
});

export const Unknown808019E7 = rsat.schema(0x808019e7, {
  unknown0: rsat.optional(rsat.nested(Unknown808019E6)),
  unknown1: rsat.optional(rsat.i32()),
  unknown2: rsat.optional(rsat.i8()),
});

export const Unknown80801BFF = rsat.schema(0x80801bff, {
  unknown0: rsat.repeat(rsat.i16(), 17),
});

export const Unknown808019E9 = rsat.schema(0x808019e9, {
  unknown0: rsat.optional(rsat.u64()),
  unknown1: rsat.optional(rsat.i8()),
  unknown2: rsat.optional(rsat.nested(Unknown80801BFF)),
  unknown3: rsat.optional(rsat.u8({ size: 4, bias: 0 })),
});

export const Unknown808044B3 = rsat.schema(0x808044b3, {
  unknown0: rsat.nested(Unknown80800E31),
  unknown1: rsat.nested(Unknown80800E38),
  unknown2: rsat.nested(Unknown8080024A),
});

export const Unknown808019EC = rsat.schema(0x808019ec, {
  unknown0: rsat.optional(rsat.nested(Unknown808044B3)),
  unknown1: rsat.optional(rsat.u64()),
});

export const Unknown808019EE = rsat.schema(0x808019ee, {
  unknown0: rsat.optional(rsat.i32()),
  unknown1: rsat.optional(rsat.f32()),
});

export const Unknown80801C00 = rsat.schema(0x80801c00, {
  unknown0: rsat.repeat(rsat.nested(Unknown808019E9), 20),
});

export const Unknown80801C01 = rsat.schema(0x80801c01, {
  unknown0: rsat.repeat(rsat.u32(), 8),
});

export const Unknown808019F2 = rsat.schema(0x808019f2, {
  unknown0: rsat.optional(rsat.nested(Unknown808019E7)),
  unknown1: rsat.optional(rsat.nested(Unknown80801C00)),
  unknown2: rsat.optional(rsat.nested(Unknown808019EC)),
  unknown3: rsat.optional(rsat.u32()),
  unknown4: rsat.optional(rsat.nested(Unknown80801C01)),
});

export const Unknown808019F3 = rsat.schema(0x808019f3, {
  unknown0: rsat.optional(rsat.nested(Unknown808019E4)),
  unknown1: rsat.optional(rsat.nested(Unknown808019F2)),
});

export const Unknown80801A0B = rsat.schema(0x80801a0b, {
  unknown0: rsat.optional(rsat.i8({ size: 2, bias: 1 })),
  unknown1: rsat.optional(rsat.u64()),
});

export const Unknown80801BD1 = rsat.schema(0x80801bd1, {
  unknown0: rsat.presentOptions(rsat.i32(), 128),
});

export const Unknown80801BEA = rsat.schema(0x80801bea, {
  unknown0: rsat.repeat(rsat.nested(Unknown80801768), 5),
});

export const Unknown80801BF3 = rsat.schema(0x80801bf3, {
  unknown0: rsat.repeat(rsat.u8(), 50),
});

export const Unknown80801BF4 = rsat.schema(0x80801bf4, {
  unknown0: rsat.repeat(rsat.nested(Unknown8080198F), 5),
});

export const Unknown80801C05 = rsat.schema(0x80801c05, {
  unknown0: rsat.presentOptions(rsat.u64(), 32),
});

export const Unknown80804BE0 = rsat.schema(0x80804be0, {
  unknown0: rsat.repeat(rsat.nested(Unknown80804BAA), 4),
});

export const InventoryItem = rsat.schema(0x80801a25, {
  soid: rsat.optional(rsat.u64()),
  defIndex: rsat.optional(rsat.i16({ bias: 0x8000 })),
  unknown2: rsat.optional(rsat.nested(Unknown80801A0B)),
  unknown3: rsat.optional(rsat.rawBytes()),
  unknown4: rsat.optional(rsat.nested(Unknown808019AE)),
});

/** 808017D0 — self type-0. */
export const SelfPrimary = rsat.schema(0x808017d0, {
  unknown0: rsat.nested(Unknown808017C9),
});

/** 808019FC — self type-1 character. */
export const SelfCharacter = rsat.schema(0x808019fc, {
  soid: rsat.optional(rsat.u64()),
  unknown1: rsat.optional(rsat.nested(AppearanceEc)),
  unknown2: rsat.optional(rsat.nested(AppearanceF0)),
  unknown3: rsat.optional(rsat.nested(Unknown808019DA)),
  unknown4: rsat.optional(rsat.nested(Unknown80801C03)),
  unknown5: rsat.optional(rsat.nested(Unknown808019DF)),
  unknown6: rsat.optional(rsat.rawBytes()),
  unknown7: rsat.optional(rsat.nested(Unknown808017D3)),
  unknown8: rsat.optional(rsat.nested(Unknown808019E1)),
  unknown9: rsat.optional(rsat.rawBytes()),
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

/** 80801A01 — self type-1 inventory wrapper. */
export const SelfInventory = rsat.schema(0x80801a01, {
  unknown0: rsat.nested(SelfCharacter),
});

export type SelfCharacterValue = rsat.Infer<typeof SelfCharacter>;
export type InventoryItemValue = rsat.Infer<typeof InventoryItem>;
