import { rsat } from "@blamnetwork/rsat";

export const AppearanceEc = rsat.schema(0x808018ec, {
  race: rsat.optional(rsat.i8({ bias: 128 })),
  gender: rsat.optional(rsat.i8({ bias: 128 })),
  classIndex: rsat.optional(rsat.i8({ bias: 128 })),
});

export const AppearanceF0 = rsat.schema(0x808018f0, {
  faceIndex: rsat.i16({ bias: 0x8000 }),
  hairIndex: rsat.i8({ bias: 128 }),
  featureIndex: rsat.i8({ bias: 128 }),
  decalIndex: rsat.i8({ bias: 128 }),
  skinColor: rsat.i16({ bias: 0x8000 }),
  lipColor: rsat.i16({ bias: 0x8000 }),
  eyeColor: rsat.i16({ bias: 0x8000 }),
  hairColor: rsat.i16({ bias: 0x8000 }),
  featureColor: rsat.i16({ bias: 0x8000 }),
  decalColor: rsat.i16({ bias: 0x8000 }),
  personalityId: rsat.u32({ bias: 0 }),
  helmetPreference: rsat.i8({ size: 2, bias: 1 }),
});

export const Unknown80800E3F = rsat.schema(0x80800e3f, {
  unknown0: rsat.repeat(rsat.u32({ bias: 0 }), 8),
});

export const Unknown80800E47 = rsat.schema(0x80800e47, {
  unknown0: rsat.repeat(rsat.u32({ bias: 0 }), 32),
});

export const Unknown80801768 = rsat.schema(0x80801768, {
  unknown0: rsat.optional(rsat.i16()),
  unknown1: rsat.optional(rsat.i8({ size: 2, bias: 1 })),
});

export const Unknown808017D2 = rsat.schema(0x808017d2, {
  unknown0: rsat.optional(rsat.i8({ bias: 128 })),
  unknown1: rsat.optional(rsat.i32({ bias: 0x80000000 })),
  unknown2: rsat.optional(rsat.i32({ bias: 0x80000000 })),
  unknown3: rsat.optional(rsat.i32({ bias: 0x80000000 })),
});

export const Unknown808017D3 = rsat.schema(0x808017d3, {
  unknown0: rsat.array(rsat.nested(Unknown808017D2), {
    lengthBits: 7,
    max: 127,
  }),
});

export const Unknown80801BF0 = rsat.schema(0x80801bf0, {
  unknown0: rsat.presentOptions(rsat.i16(), 32),
});

export const Unknown80801BF1 = rsat.schema(0x80801bf1, {
  unknown0: rsat.presentOptions(rsat.u64(), 32),
});

export const Unknown80801BF2 = rsat.schema(0x80801bf2, {
  unknown0: rsat.presentOptions(rsat.bool(), 512),
});

export const Unknown80801976 = rsat.schema(0x80801976, {
  unknown0: rsat.optional(rsat.nested(Unknown80801BF0)),
  unknown1: rsat.optional(rsat.nested(Unknown80801BF1)),
  unknown2: rsat.optional(rsat.nested(Unknown80801BF0)),
  unknown3: rsat.optional(rsat.nested(Unknown80801BF2)),
  unknown4: rsat.optional(rsat.u64()),
});

export const Unknown808019C2 = rsat.schema(0x808019c2, {
  unknown0: rsat.optional(rsat.i8({ bias: 128 })),
  unknown1: rsat.optional(rsat.i16({ bias: 0x8000 })),
});

export const Unknown808019C3 = rsat.schema(0x808019c3, {
  unknown0: rsat.optional(rsat.i16({ bias: 0x8000 })),
  soid: rsat.optional(rsat.u64()),
});

export const Unknown808019C5 = rsat.schema(0x808019c5, {
  unknown0: rsat.optional(rsat.i8({ bias: 128 })),
  unknown1: rsat.optional(rsat.i32({ bias: 0x80000000 })),
});

export const Unknown80801BF6 = rsat.schema(0x80801bf6, {
  unknown0: rsat.repeat(rsat.nested(Unknown808019C2), 6),
});

export const Unknown808019C7 = rsat.schema(0x808019c7, {
  soid: rsat.optional(rsat.u64()),
  defIndex: rsat.optional(rsat.i16({ bias: 0x8000 })),
  unknown2: rsat.optional(rsat.i8({ bias: 128 })),
  unknown3: rsat.optional(rsat.i16({ bias: 0x8000 })),
  unknown4: rsat.optional(rsat.nested(Unknown80801BF6)),
});

export const Unknown80801BF8 = rsat.schema(0x80801bf8, {
  unknown0: rsat.repeat(rsat.nested(Unknown808019C7), 20),
});

export const Unknown80801BF9 = rsat.schema(0x80801bf9, {
  unknown0: rsat.repeat(rsat.nested(Unknown808019C3), 8),
});

export const Unknown80801BFA = rsat.schema(0x80801bfa, {
  unknown0: rsat.presentOptions(rsat.i16({ bias: 0x8000 }), 26),
});

export const Unknown80801BFB = rsat.schema(0x80801bfb, {
  unknown0: rsat.presentOptions(rsat.i16({ bias: 0x8000 }), 16),
});

export const Unknown80801BFC = rsat.schema(0x80801bfc, {
  unknown0: rsat.repeat(rsat.nested(Unknown808019C5), 16),
});

export const Unknown80804BC7 = rsat.schema(0x80804bc7, {
  unknown0: rsat.optional(rsat.i8({ bias: 128 })),
  unknown1: rsat.optional(rsat.nested(Unknown80800E3F)),
});

export const Unknown80804BE1 = rsat.schema(0x80804be1, {
  unknown0: rsat.repeat(rsat.nested(Unknown80804BC7), 5),
});

export const Unknown808019CF = rsat.schema(0x808019cf, {
  unknown0: rsat.optional(rsat.i32({ bias: 0x80000000 })),
  unknown1: rsat.optional(rsat.nested(Unknown80804BE1)),
  unknown2: rsat.optional(rsat.nested(Unknown80800E47)),
  unknown3: rsat.optional(rsat.nested(Unknown80801BF8)),
  unknown4: rsat.optional(rsat.nested(Unknown80801BF9)),
  unknown5: rsat.optional(rsat.nested(Unknown80801BFA)),
  unknown6: rsat.optional(rsat.nested(Unknown80801BFB)),
  unknown7: rsat.optional(rsat.nested(Unknown80801BFB)),
  unknown8: rsat.optional(rsat.nested(Unknown80801BFB)),
  unknown9: rsat.optional(rsat.nested(Unknown80801BFC)),
  unknown10: rsat.optional(rsat.nested(Unknown80801BFC)),
  unknown11: rsat.optional(rsat.nested(Unknown80801BFC)),
  unknown12: rsat.optional(rsat.nested(Unknown80801BFC)),
});

export const Unknown808019E0 = rsat.schema(0x808019e0, {
  unknown0: rsat.optional(rsat.bool()),
  soid: rsat.optional(rsat.u64()),
});

export const Unknown808019E1 = rsat.schema(0x808019e1, {
  unknown0: rsat.optional(rsat.i32({ bias: 0x80000000 })),
  unknown1: rsat.optional(rsat.i32({ bias: 0x80000000 })),
  unknown2: rsat.optional(rsat.i32({ bias: 0x80000000 })),
  unknown3: rsat.optional(rsat.i32({ bias: 0x80000000 })),
  unknown4: rsat.optional(rsat.u64()),
  unknown5: rsat.optional(rsat.u64()),
  unknown6: rsat.optional(rsat.u64()),
  unknown7: rsat.optional(rsat.nested(Unknown808019E0)),
});

export const Unknown80801BCF = rsat.schema(0x80801bcf, {
  unknown0: rsat.presentOptions(rsat.i8({ size: 2, bias: 1 }), 512),
});

export const Unknown80801BD3 = rsat.schema(0x80801bd3, {
  unknown0: rsat.repeat(rsat.u64(), 10),
});

export const Unknown80801BD4 = rsat.schema(0x80801bd4, {
  unknown0: rsat.repeat(rsat.i16(), 16),
});

export const Unknown80801BD5 = rsat.schema(0x80801bd5, {
  unknown0: rsat.repeat(rsat.nested(Unknown808017D2), 127),
});

export const Unknown80801C03 = rsat.schema(0x80801c03, {
  unknown0: rsat.repeat(rsat.u64(), 20),
});

export const Unknown80801C04 = rsat.schema(0x80801c04, {
  unknown0: rsat.presentOptions(rsat.i32(), 32),
});

export type AppearanceEcValue = rsat.Infer<typeof AppearanceEc>;
export type AppearanceF0Value = rsat.Infer<typeof AppearanceF0>;
export type GearCfValue = rsat.Infer<typeof Unknown808019CF>;
