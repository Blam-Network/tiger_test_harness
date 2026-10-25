// Client schemas, from the eboot's schema registry (scripts/rsat-descriptors.py
// dumps it): record address, PS4 size and checksum. Unnamed fields are
// unknownN, their member index in the record.

import { rsat } from "@blamnetwork/rsat";

// Schemas register by id when this runs, so only the build's loader calls it.
export function defineSelfSchemas() {
  // 80804613 @0x20b4f80, size 0x58
  const Unknown80804613 = rsat.schema(0x80804613, {
    soids: rsat.array(rsat.u64(), { lengthBits: 4, max: 10 }),
  });

  // 808047A7 @0x23b65f0, size 0x400
  const Unknown808047A7 = rsat.schema(0x808047a7, {
    unknown0: rsat.optionsArray(rsat.u64(), 128),
  });

  // 808041C5 @0x211e470, size 0x10
  const Unknown808041C5 = rsat.schema(0x808041c5, {
    unknown0: rsat.repeat(rsat.u32(), 4),
  });

  // 808016BA @0x1fa9540, size 0x410
  const Unknown808016BA = rsat.schema(0x808016ba, {
    unknown0: rsat.optional(rsat.nested(Unknown808047A7)),
    unknown1: rsat.optional(rsat.nested(Unknown808041C5)),
  });

  // 8080189B @0x2325580, size 0x8
  const Unknown8080189B = rsat.schema(0x8080189b, {
    unknown0: rsat.f32(),
    unknown1: rsat.f32(),
  });

  // 808016E5 @0x1ffa170, size 0x10
  const Unknown808016E5 = rsat.schema(0x808016e5, {
    unknown0: rsat.optional(rsat.nested(Unknown8080189B)),
    unknown1: rsat.optional(rsat.nested(Unknown8080189B)),
  });

  // 808018AC @0x2340d70, size 0xb
  const Unknown808018AC = rsat.schema(0x808018ac, {
    unknown0: rsat.optional(rsat.bool()),
    unknown1: rsat.optional(rsat.i8({ size: 3, bias: 1 })),
    unknown2: rsat.optional(rsat.i8({ size: 3, bias: 1 })),
    unknown3: rsat.optional(rsat.i8({ size: 4, bias: 1 })),
    unknown4: rsat.optional(rsat.i8({ size: 2, bias: 1 })),
    unknown5: rsat.optional(rsat.i8({ size: 2, bias: 1 })),
    unknown6: rsat.optional(rsat.i8({ size: 3, bias: 1 })),
    unknown7: rsat.optional(rsat.bool()),
    unknown8: rsat.optional(rsat.bool()),
    unknown9: rsat.optional(rsat.bool()),
    unknown10: rsat.optional(rsat.bool()),
  });

  // 80801839 @0x2251650, size 0x20
  const Unknown80801839 = rsat.schema(0x80801839, {
    unknown0: rsat.optional(rsat.nested(Unknown808016E5)),
    unknown1: rsat.optional(rsat.nested(Unknown808018AC)),
  });

  // 80801716 @0x2047b90, size 0x430
  const Unknown80801716 = rsat.schema(0x80801716, {
    unknown0: rsat.optional(rsat.nested(Unknown808016BA)),
    unknown1: rsat.optional(rsat.nested(Unknown80801839)),
  });

  // 808016C0 @0x1fb4ce0, size 0x18
  const Unknown808016C0 = rsat.schema(0x808016c0, {
    unknown0: rsat.optional(rsat.i16()),
    unknown1: rsat.optional(rsat.u64()),
    unknown2: rsat.optional(rsat.i32()),
    unknown3: rsat.optional(rsat.i32()),
  });

  // 80804589 @0x1fad840, size 0xc00
  const Unknown80804589 = rsat.schema(0x80804589, {
    unknown0: rsat.repeat(rsat.nested(Unknown808016C0), 128),
  });

  // 80804652 @0x211f580, size 0xc08
  const Unknown80804652 = rsat.schema(0x80804652, {
    unknown0: rsat.optional(rsat.i32()),
    unknown1: rsat.optional(rsat.nested(Unknown80804589)),
  });

  // 80804713 @0x228f5e0, size 0x200
  const Unknown80804713 = rsat.schema(0x80804713, {
    unknown0: rsat.optionsArray(rsat.i32(), 128),
  });

  // 8080458F @0x1fbc180, size 0x400
  const Unknown8080458F = rsat.schema(0x8080458f, {
    unknown0: rsat.optionsArray(rsat.i8({ size: 2, bias: 1 }), 1024),
  });

  // 808045FB @0x2082730, size 0x80
  const Unknown808045FB = rsat.schema(0x808045fb, {
    unknown0: rsat.optionsArray(rsat.i8({ size: 2, bias: 1 }), 128),
  });

  // 808017E3 @0x21a8580, size 0x81
  const Unknown808017E3 = rsat.schema(0x808017e3, {
    unknown0: rsat.bool(),
    unknown1: rsat.nested(Unknown808045FB),
  });

  // 80804677 @0x215d950, size 0x22
  const Unknown80804677 = rsat.schema(0x80804677, {
    unknown0: rsat.repeat(rsat.i16(), 17),
  });

  // 808046FA @0x225b1e0, size 0xa
  const Unknown808046FA = rsat.schema(0x808046fa, {
    unknown0: rsat.repeat(rsat.i16(), 5),
  });

  // 80801903 @0x23db7e0, size 0x8
  const Unknown80801903 = rsat.schema(0x80801903, {
    unknown0: rsat.optional(rsat.u32()),
    unknown1: rsat.optional(rsat.u32()),
  });

  // 80804618 @0x20be840, size 0x400
  const Unknown80804618 = rsat.schema(0x80804618, {
    unknown0: rsat.repeat(rsat.nested(Unknown80801903), 128),
  });

  // 8080187F @0x22f7170, size 0x1b58, headerChecksum 0xbc884568
  const Unknown8080187F = rsat.schema(0x8080187f, {
    soid: rsat.optional(rsat.u64()),
    roster: rsat.optional(rsat.nested(Unknown80804613)),
    characterSoid: rsat.optional(rsat.u64()),
    unknown3: rsat.optional(rsat.nested(Unknown80801716)),
    unknown4: rsat.optional(rsat.i8({ size: 2, bias: 1 })),
    unknown5: rsat.optional(rsat.nested(Unknown80804652)),
    unknown6: rsat.optional(rsat.nested(Unknown80804713)),
    unknown7: rsat.optional(rsat.nested(Unknown8080458F)),
    unknown8: rsat.nested(Unknown808017E3),
    unknown9: rsat.optional(rsat.nested(Unknown80804677)),
    unknown10: rsat.optional(rsat.nested(Unknown808046FA)),
    unknown11: rsat.optional(rsat.nested(Unknown80804618)),
  });

  // Queuez object header checksums: +8 of each schema's record.
  const SELF_CHECKSUM_PRIMARY = 0x56151ef3;

  // 80801788 @0x2119b80, size 0x1b58, headerChecksum 0x56151ef3
  const SelfPrimary = rsat.schema(0x80801788, {
    unknown0: rsat.nested(Unknown8080187F),
  });

  // 808017DB @0x219b910, size 0x3
  const Unknown808017DB = rsat.schema(0x808017db, {
    unknown0: rsat.optional(rsat.i8()),
    unknown1: rsat.optional(rsat.i8()),
    unknown2: rsat.optional(rsat.i8()),
  });

  // 808046EB @0x223a770, size 0x6
  const Unknown808046EB = rsat.schema(0x808046eb, {
    unknown0: rsat.i16(),
    unknown1: rsat.i16(),
    unknown2: rsat.i16(),
  });

  // 808017F4 @0x21c2990, size 0x24
  const Unknown808017F4 = rsat.schema(0x808017f4, {
    unknown0: rsat.i16(),
    unknown1: rsat.i8(),
    unknown2: rsat.i8(),
    unknown3: rsat.i8(),
    unknown4: rsat.i16(),
    unknown5: rsat.i16(),
    unknown6: rsat.i16(),
    unknown7: rsat.nested(Unknown808046EB),
    unknown8: rsat.nested(Unknown808046EB),
    unknown9: rsat.i16(),
    unknown10: rsat.u32(),
    unknown11: rsat.i8({ size: 2, bias: 1 }),
  });

  // 80804742 @0x2300c60, size 0x1800
  const Unknown80804742 = rsat.schema(0x80804742, {
    unknown0: rsat.repeat(rsat.nested(Unknown808016C0), 256),
  });

  // 80804637 @0x20f6810, size 0x1808
  const Unknown80804637 = rsat.schema(0x80804637, {
    unknown0: rsat.optional(rsat.i32()),
    unknown1: rsat.optional(rsat.nested(Unknown80804742)),
  });

  // 808045D1 @0x202c530, size 0xa0
  const Unknown808045D1 = rsat.schema(0x808045d1, {
    unknown0: rsat.repeat(rsat.u64(), 20),
  });

  // 80801799 @0x213d020, size 0x10
  const Unknown80801799 = rsat.schema(0x80801799, {
    unknown0: rsat.i16(),
    unknown1: rsat.i16(),
    unknown2: rsat.i32(),
    unknown3: rsat.u32(),
    unknown4: rsat.bool(),
  });

  // 808016B2 @0x1f9e190, size 0xc
  const Unknown808016B2 = rsat.schema(0x808016b2, {
    unknown0: rsat.optional(rsat.f32()),
    unknown1: rsat.optional(rsat.f32()),
    unknown2: rsat.optional(rsat.f32()),
  });

  // 80801780 @0x2106630, size 0x1c
  const Unknown80801780 = rsat.schema(0x80801780, {
    unknown0: rsat.optional(rsat.nested(Unknown808016B2)),
    unknown1: rsat.optional(rsat.nested(Unknown808041C5)),
  });

  // 80801850 @0x22936c0, size 0x3
  const Unknown80801850 = rsat.schema(0x80801850, {
    unknown0: rsat.i8(),
    unknown1: rsat.i8({ size: 3, bias: 1 }),
    unknown2: rsat.u8({ size: 5, bias: 0 }),
  });

  // 8080182A @0x2231980, size 0xc
  const Unknown8080182A = rsat.schema(0x8080182a, {
    unknown0: rsat.optional(rsat.nested(Unknown80801850)),
    unknown1: rsat.optional(rsat.i32()),
    unknown2: rsat.optional(rsat.i8()),
  });

  // 808016B6 @0x1fa2870, size 0x30
  const Unknown808016B6 = rsat.schema(0x808016b6, {
    unknown0: rsat.optional(rsat.u64()),
    unknown1: rsat.optional(rsat.i16()),
    unknown2: rsat.optional(rsat.nested(Unknown80804677)),
    unknown3: rsat.optional(rsat.u8({ size: 4, bias: 0 })),
  });

  // 808046D5 @0x2202b30, size 0x3c0
  const Unknown808046D5 = rsat.schema(0x808046d5, {
    unknown0: rsat.repeat(rsat.nested(Unknown808016B6), 20),
  });

  // 808018FC @0x23ce330, size 0x3d8
  const Unknown808018FC = rsat.schema(0x808018fc, {
    unknown0: rsat.optional(rsat.nested(Unknown808046D5)),
    unknown1: rsat.optional(rsat.u64()),
    unknown2: rsat.optional(rsat.i32()),
    unknown3: rsat.optional(rsat.f32()),
    unknown4: rsat.optional(rsat.f32()),
    unknown5: rsat.optional(rsat.i8()),
    unknown6: rsat.optional(rsat.i8()),
  });

  // 808043BB @0x23ae450, size 0x84
  const Unknown808043BB = rsat.schema(0x808043bb, {
    unknown0: rsat.array(rsat.u8(), { lengthBits: 8, max: 128 }),
  });

  // 808018D0 @0x2383e30, size 0x90
  const Unknown808018D0 = rsat.schema(0x808018d0, {
    unknown0: rsat.optional(rsat.nested(Unknown808043BB)),
    unknown1: rsat.optional(rsat.u64()),
  });

  // 80804425 @0x242eec0, size 0x20
  const Unknown80804425 = rsat.schema(0x80804425, {
    unknown0: rsat.repeat(rsat.u32(), 8),
  });

  // 80801728 @0x2067270, size 0x4a0
  const Unknown80801728 = rsat.schema(0x80801728, {
    unknown0: rsat.optional(rsat.nested(Unknown8080182A)),
    unknown1: rsat.optional(rsat.nested(Unknown808018FC)),
    unknown2: rsat.optional(rsat.nested(Unknown808018D0)),
    unknown3: rsat.optional(rsat.u32()),
    unknown4: rsat.optional(rsat.nested(Unknown80804425)),
  });

  // 808018CB @0x237ee80, size 0x4c0
  const Unknown808018CB = rsat.schema(0x808018cb, {
    unknown0: rsat.optional(rsat.nested(Unknown80801780)),
    unknown1: rsat.optional(rsat.nested(Unknown80801728)),
  });

  // 8080174D @0x20b5d10, size 0x10
  const Unknown8080174D = rsat.schema(0x8080174d, {
    unknown0: rsat.optional(rsat.i8()),
    unknown1: rsat.optional(rsat.i32()),
    unknown2: rsat.optional(rsat.i32()),
    unknown3: rsat.optional(rsat.i32()),
  });

  // 80804787 @0x2380fb0, size 0x7f4
  const Unknown80804787 = rsat.schema(0x80804787, {
    unknown0: rsat.array(rsat.nested(Unknown8080174D), {
      lengthBits: 7,
      max: 127,
    }),
  });

  // 80801794 @0x2131620, size 0x10
  const Unknown80801794 = rsat.schema(0x80801794, {
    unknown0: rsat.optional(rsat.bool()),
    unknown1: rsat.optional(rsat.u64()),
  });

  // 80801737 @0x2083cb0, size 0x38
  const Unknown80801737 = rsat.schema(0x80801737, {
    unknown0: rsat.optional(rsat.i32()),
    unknown1: rsat.optional(rsat.i32()),
    unknown2: rsat.optional(rsat.i32()),
    unknown3: rsat.optional(rsat.i32()),
    unknown4: rsat.optional(rsat.u64()),
    unknown5: rsat.optional(rsat.u64()),
    unknown6: rsat.optional(rsat.u64()),
    unknown7: rsat.optional(rsat.nested(Unknown80801794)),
  });

  // 808017CA @0x216f710, size 0x10
  const Unknown808017CA = rsat.schema(0x808017ca, {
    unknown0: rsat.i32(),
    unknown1: rsat.u64(),
  });

  // 808018D1 @0x2384b40, size 0x18
  const Unknown808018D1 = rsat.schema(0x808018d1, {
    unknown0: rsat.nested(Unknown808017CA),
    unknown1: rsat.i32(),
  });

  // 808017C9 @0x216c150, size 0x8
  const Unknown808017C9 = rsat.schema(0x808017c9, {
    unknown0: rsat.optional(rsat.i8()),
    unknown1: rsat.optional(rsat.i32()),
  });

  // 80804693 @0x218f0b0, size 0x14
  const Unknown80804693 = rsat.schema(0x80804693, {
    unknown0: rsat.array(rsat.nested(Unknown808017C9), {
      lengthBits: 2,
      max: 2,
    }),
  });

  // 808016F2 @0x200e1b0, size 0x2c
  const Unknown808016F2 = rsat.schema(0x808016f2, {
    unknown0: rsat.optional(rsat.nested(Unknown80804693)),
    unknown1: rsat.optional(rsat.nested(Unknown80804693)),
    unknown2: rsat.optional(rsat.i16()),
  });

  // 8080184F @0x228b350, size 0x44
  const Unknown8080184F = rsat.schema(0x8080184f, {
    unknown0: rsat.optional(rsat.nested(Unknown808016F2)),
    unknown1: rsat.optional(rsat.nested(Unknown80804693)),
    unknown2: rsat.optional(rsat.i8()),
  });

  // 80801804 @0x21e3bd0, size 0x70
  const Unknown80801804 = rsat.schema(0x80801804, {
    unknown0: rsat.optional(rsat.i16()),
    unknown1: rsat.optional(rsat.i32()),
    unknown2: rsat.optional(rsat.i8({ size: 3, bias: 1 })),
    unknown3: rsat.optional(rsat.nested(Unknown808018D1)),
    unknown4: rsat.optional(rsat.nested(Unknown8080184F)),
  });

  // 8080465F @0x2130a10, size 0x1c00
  const Unknown8080465F = rsat.schema(0x8080465f, {
    unknown0: rsat.repeat(rsat.nested(Unknown80801804), 64),
  });

  // 8080471E @0x22ac330, size 0x40
  const Unknown8080471E = rsat.schema(0x8080471e, {
    unknown0: rsat.optionsArray(rsat.f32(), 16),
  });

  // 80804702 @0x22718d0, size 0x30
  const Unknown80804702 = rsat.schema(0x80804702, {
    unknown0: rsat.optionsArray(rsat.f32(), 12),
  });

  // 808017A8 @0x21490f0, size 0x34
  const Unknown808017A8 = rsat.schema(0x808017a8, {
    unknown0: rsat.optional(rsat.nested(Unknown80804702)),
    unknown1: rsat.optional(rsat.i8()),
  });

  // 80804779 @0x2370000, size 0x340
  const Unknown80804779 = rsat.schema(0x80804779, {
    unknown0: rsat.repeat(rsat.nested(Unknown808017A8), 16),
  });

  // 8080190C @0x23e90e0, size 0x384
  const Unknown8080190C = rsat.schema(0x8080190c, {
    unknown0: rsat.optional(rsat.u32()),
    unknown1: rsat.optional(rsat.nested(Unknown8080471E)),
    unknown2: rsat.optional(rsat.nested(Unknown80804779)),
  });

  // 808016E1 @0x1ff1280, size 0x1fa0
  const Unknown808016E1 = rsat.schema(0x808016e1, {
    unknown0: rsat.optional(rsat.i32()),
    unknown1: rsat.optional(rsat.nested(Unknown8080465F)),
    unknown2: rsat.optional(rsat.nested(Unknown8080190C)),
    unknown3: rsat.optional(rsat.nested(Unknown808017CA)),
  });

  // 8080196F @0x231c240, size 0x18
  const Unknown8080196F = rsat.schema(0x8080196f, {
    unknown0: rsat.optional(rsat.i16()),
    unknown1: rsat.optional(rsat.u64()),
    unknown2: rsat.optional(rsat.i32()),
  });

  // 808054B9 @0x22d1a80, size 0x68
  const Unknown808054B9 = rsat.schema(0x808054b9, {
    unknown0: rsat.array(rsat.nested(Unknown8080196F), {
      lengthBits: 3,
      max: 4,
    }),
  });

  // 80801764 @0x20d9650, size 0x90
  const Unknown80801764 = rsat.schema(0x80801764, {
    unknown0: rsat.optional(rsat.nested(Unknown808054B9)),
    unknown1: rsat.optional(rsat.nested(Unknown8080196F)),
    unknown2: rsat.optional(rsat.i32()),
    unknown3: rsat.optional(rsat.u64()),
  });

  // 808046CC @0x21ebcc0, size 0x10e0
  const Unknown808046CC = rsat.schema(0x808046cc, {
    unknown0: rsat.repeat(rsat.nested(Unknown80801764), 30),
  });

  // 80801730 @0x2071820, size 0x10e8
  const Unknown80801730 = rsat.schema(0x80801730, {
    unknown0: rsat.optional(rsat.i32()),
    unknown1: rsat.optional(rsat.nested(Unknown808046CC)),
  });

  // 80804714 @0x2291bd0, size 0x80
  const Unknown80804714 = rsat.schema(0x80804714, {
    unknown0: rsat.optionsArray(rsat.i32(), 32),
  });

  // 808046F0 @0x22400d0, size 0x100
  const Unknown808046F0 = rsat.schema(0x808046f0, {
    unknown0: rsat.optionsArray(rsat.u64(), 32),
  });

  // 80804593 @0x1fc8a60, size 0x40
  const Unknown80804593 = rsat.schema(0x80804593, {
    unknown0: rsat.optionsArray(rsat.i16(), 32),
  });

  // 808046F5 @0x2248fb0, size 0x100
  const Unknown808046F5 = rsat.schema(0x808046f5, {
    unknown0: rsat.optionsArray(rsat.u64(), 32),
  });

  // 8080478C @0x23877e0, size 0x200
  const Unknown8080478C = rsat.schema(0x8080478c, {
    unknown0: rsat.optionsArray(rsat.bool(), 512),
  });

  // 80801708 @0x2032610, size 0x388
  const Unknown80801708 = rsat.schema(0x80801708, {
    unknown0: rsat.optional(rsat.nested(Unknown80804593)),
    unknown1: rsat.optional(rsat.nested(Unknown808046F5)),
    unknown2: rsat.optional(rsat.nested(Unknown80804593)),
    unknown3: rsat.optional(rsat.nested(Unknown8080478C)),
    unknown4: rsat.optional(rsat.u64()),
  });

  // 80801889 @0x2311ee0, size 0x8
  const Unknown80801889 = rsat.schema(0x80801889, {
    unknown0: rsat.optional(rsat.i8()),
    unknown1: rsat.optional(rsat.i32()),
  });

  // 80804745 @0x230e140, size 0x38
  const Unknown80804745 = rsat.schema(0x80804745, {
    unknown0: rsat.repeat(rsat.nested(Unknown80801889), 7),
  });

  // 808018E6 @0x23b3de0, size 0x3c
  const Unknown808018E6 = rsat.schema(0x808018e6, {
    unknown0: rsat.optional(rsat.bool()),
    unknown1: rsat.optional(rsat.nested(Unknown80804745)),
  });

  // 80801830 @0x223fa80, size 0x4
  const Unknown80801830 = rsat.schema(0x80801830, {
    unknown0: rsat.optional(rsat.i16()),
    unknown1: rsat.optional(rsat.i8({ size: 2, bias: 1 })),
  });

  // 80804629 @0x20e0ef0, size 0x18
  const Unknown80804629 = rsat.schema(0x80804629, {
    unknown0: rsat.array(rsat.nested(Unknown80801830), {
      lengthBits: 3,
      max: 5,
    }),
  });

  // 8080188F @0x231c460, size 0xa8
  const Unknown8080188F = rsat.schema(0x8080188f, {
    unknown0: rsat.optional(rsat.i32()),
    unknown1: rsat.optional(rsat.i32()),
    unknown2: rsat.optional(rsat.i16()),
    unknown3: rsat.optional(rsat.nested(Unknown808018E6)),
    unknown4: rsat.optional(rsat.nested(Unknown808018E6)),
    unknown5: rsat.optional(rsat.nested(Unknown80804629)),
    unknown6: rsat.optional(rsat.bool()),
    unknown7: rsat.optional(rsat.bool()),
    unknown8: rsat.optional(rsat.i32()),
    unknown9: rsat.optional(rsat.u32()),
  });

  // 808018F8 @0x23c6e20, size 0xc
  const Unknown808018F8 = rsat.schema(0x808018f8, {
    unknown0: rsat.optional(rsat.f32()),
    unknown1: rsat.optional(rsat.i32()),
    unknown2: rsat.optional(rsat.i16()),
  });

  // 808016D7 @0x1fe3a00, size 0x14
  const Unknown808016D7 = rsat.schema(0x808016d7, {
    unknown0: rsat.optional(rsat.i32()),
    unknown1: rsat.optional(rsat.f32()),
    unknown2: rsat.optional(rsat.nested(Unknown808018F8)),
  });

  // 80804685 @0x2173510, size 0x200
  const Unknown80804685 = rsat.schema(0x80804685, {
    unknown0: rsat.optionsArray(rsat.i8({ size: 2, bias: 1 }), 512),
  });

  // 808016D1 @0x1fe1b70, size 0x60a8, headerChecksum 0x158837b9
  const SelfCharacter = rsat.schema(0x808016d1, {
    soid: rsat.optional(rsat.u64()),
    unknown1: rsat.optional(rsat.nested(Unknown808017DB)),
    unknown2: rsat.optional(rsat.nested(Unknown808017F4)),
    unknown3: rsat.optional(rsat.nested(Unknown80804637)),
    unknown4: rsat.optional(rsat.nested(Unknown808045D1)),
    unknown5: rsat.optional(rsat.nested(Unknown80801799)),
    unknown6: rsat.optional(rsat.nested(Unknown808018CB)),
    unknown7: rsat.optional(rsat.nested(Unknown80804787)),
    unknown8: rsat.optional(rsat.nested(Unknown80801737)),
    unknown9: rsat.optional(rsat.nested(Unknown808016E1)),
    unknown10: rsat.optional(rsat.nested(Unknown80804685)),
    unknown11: rsat.optional(rsat.nested(Unknown80801730)),
    unknown12: rsat.optional(rsat.nested(Unknown80804714)),
    unknown13: rsat.optional(rsat.nested(Unknown80804714)),
    unknown14: rsat.optional(rsat.nested(Unknown808046F0)),
    unknown15: rsat.optional(rsat.nested(Unknown80801708)),
    unknown16: rsat.optional(rsat.nested(Unknown8080188F)),
    unknown17: rsat.optional(rsat.nested(Unknown80804713)),
    unknown18: rsat.optional(rsat.nested(Unknown808016D7)),
  });

  const SELF_CHECKSUM_INVENTORY = 0x50a234e4;

  // 8080177C @0x2100720, size 0x60a8, headerChecksum 0x50a234e4
  const SelfInventory = rsat.schema(0x8080177c, {
    unknown0: rsat.nested(SelfCharacter),
  });

  // 808018F5 @0x23c5e10, size 0x10
  const Unknown808018F5 = rsat.schema(0x808018f5, {
    unknown0: rsat.optional(rsat.i8({ size: 2, bias: 1 })),
    unknown1: rsat.optional(rsat.u64()),
  });

  // 808016E8 @0x20007b0, size 0x3, headerChecksum 0x1c128df9
  const Unknown808016E8 = rsat.schema(0x808016e8, {
    unknown0: rsat.i8(),
    unknown1: rsat.i8(),
    unknown2: rsat.i8(),
  });

  // 8080461C @0x20c5580, size 0xf
  const Unknown8080461C = rsat.schema(0x8080461c, {
    unknown0: rsat.repeat(rsat.nested(Unknown808016E8), 5),
  });

  // 808043C5 @0x23bb850, size 0x24
  const Unknown808043C5 = rsat.schema(0x808043c5, {
    unknown0: rsat.repeat(rsat.u8(), 36),
  });

  // 808046C3 @0x21e06d0, size 0x32
  const Unknown808046C3 = rsat.schema(0x808046c3, {
    unknown0: rsat.repeat(rsat.u8(), 50),
  });

  // 8080185E @0x22b08f0, size 0x58
  const Unknown8080185E = rsat.schema(0x8080185e, {
    unknown0: rsat.optional(rsat.i16()),
    unknown1: rsat.optional(rsat.nested(Unknown8080174D)),
    unknown2: rsat.optional(rsat.u8()),
    unknown3: rsat.optional(rsat.u8()),
    unknown4: rsat.optional(rsat.nested(Unknown808046C3)),
    unknown5: rsat.optional(rsat.nested(Unknown8080461C)),
  });

  const SELF_CHECKSUM_ITEM = 0xef75a292;

  // 8080190E @0x23ed5b0, size 0xa8, headerChecksum 0xef75a292
  const InventoryItem = rsat.schema(0x8080190e, {
    soid: rsat.optional(rsat.u64()),
    defIndex: rsat.optional(rsat.i16()),
    unknown2: rsat.optional(rsat.nested(Unknown808018F5)),
    unknown3: rsat.optional(rsat.nested(Unknown808016F2)),
    unknown4: rsat.optional(rsat.nested(Unknown8080185E)),
  });

  return {
    Unknown80804613,
    Unknown808047A7,
    Unknown808041C5,
    Unknown808016BA,
    Unknown8080189B,
    Unknown808016E5,
    Unknown808018AC,
    Unknown80801839,
    Unknown80801716,
    Unknown808016C0,
    Unknown80804589,
    Unknown80804652,
    Unknown80804713,
    Unknown8080458F,
    Unknown808045FB,
    Unknown808017E3,
    Unknown80804677,
    Unknown808046FA,
    Unknown80801903,
    Unknown80804618,
    Unknown8080187F,
    SELF_CHECKSUM_PRIMARY,
    SelfPrimary,
    Unknown808017DB,
    Unknown808046EB,
    Unknown808017F4,
    Unknown80804742,
    Unknown80804637,
    Unknown808045D1,
    Unknown80801799,
    Unknown808016B2,
    Unknown80801780,
    Unknown80801850,
    Unknown8080182A,
    Unknown808016B6,
    Unknown808046D5,
    Unknown808018FC,
    Unknown808043BB,
    Unknown808018D0,
    Unknown80804425,
    Unknown80801728,
    Unknown808018CB,
    Unknown8080174D,
    Unknown80804787,
    Unknown80801794,
    Unknown80801737,
    Unknown808017CA,
    Unknown808018D1,
    Unknown808017C9,
    Unknown80804693,
    Unknown808016F2,
    Unknown8080184F,
    Unknown80801804,
    Unknown8080465F,
    Unknown8080471E,
    Unknown80804702,
    Unknown808017A8,
    Unknown80804779,
    Unknown8080190C,
    Unknown808016E1,
    Unknown8080196F,
    Unknown808054B9,
    Unknown80801764,
    Unknown808046CC,
    Unknown80801730,
    Unknown80804714,
    Unknown808046F0,
    Unknown80804593,
    Unknown808046F5,
    Unknown8080478C,
    Unknown80801708,
    Unknown80801889,
    Unknown80804745,
    Unknown808018E6,
    Unknown80801830,
    Unknown80804629,
    Unknown8080188F,
    Unknown808018F8,
    Unknown808016D7,
    Unknown80804685,
    SelfCharacter,
    SELF_CHECKSUM_INVENTORY,
    SelfInventory,
    Unknown808018F5,
    Unknown808016E8,
    Unknown8080461C,
    Unknown808043C5,
    Unknown808046C3,
    Unknown8080185E,
    SELF_CHECKSUM_ITEM,
    InventoryItem,
  };
}

export type SelfSchemas = ReturnType<typeof defineSelfSchemas>;

export type SelfPrimaryValue = rsat.Infer<SelfSchemas["SelfPrimary"]>;
export type SelfCharacterValue = rsat.Infer<SelfSchemas["SelfCharacter"]>;
export type InventoryItemValue = rsat.Infer<SelfSchemas["InventoryItem"]>;
