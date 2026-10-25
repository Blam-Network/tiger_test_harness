// Client schemas, from the eboot's schema registry (scripts/rsat-descriptors.py
// dumps it): record address, PS4 size and checksum. Unnamed fields are
// unknownN, their member index in the record.

import { rsat } from "@blamnetwork/rsat";

// Schemas register by id when this runs, so only the build's loader calls it.
export function defineSelfSchemas() {
  // 80804621 @0x212ebc0, size 0x58
  const Unknown80804621 = rsat.schema(0x80804621, {
    soids: rsat.array(rsat.u64(), { lengthBits: 4, max: 10 }),
  });

  // 808047C9 @0x244c960, size 0x400
  const Unknown808047C9 = rsat.schema(0x808047c9, {
    unknown0: rsat.optionsArray(rsat.u64(), 128),
  });

  // 808041C3 @0x2195ce0, size 0x10
  const Unknown808041C3 = rsat.schema(0x808041c3, {
    unknown0: rsat.repeat(rsat.u32(), 4),
  });

  // 8080172C @0x20bb4a0, size 0x410
  const Unknown8080172C = rsat.schema(0x8080172c, {
    unknown0: rsat.optional(rsat.nested(Unknown808047C9)),
    unknown1: rsat.optional(rsat.nested(Unknown808041C3)),
  });

  // 808018C5 @0x23b7030, size 0x8
  const Unknown808018C5 = rsat.schema(0x808018c5, {
    unknown0: rsat.f32(),
    unknown1: rsat.f32(),
  });

  // 80801705 @0x20792d0, size 0x10
  const Unknown80801705 = rsat.schema(0x80801705, {
    unknown0: rsat.optional(rsat.nested(Unknown808018C5)),
    unknown1: rsat.optional(rsat.nested(Unknown808018C5)),
  });

  // 808017F0 @0x21fc4a0, size 0xb
  const Unknown808017F0 = rsat.schema(0x808017f0, {
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

  // 808017D6 @0x21d40a0, size 0x20
  const Unknown808017D6 = rsat.schema(0x808017d6, {
    unknown0: rsat.optional(rsat.nested(Unknown80801705)),
    unknown1: rsat.optional(rsat.nested(Unknown808017F0)),
  });

  // 80801716 @0x2091ca0, size 0x430
  const Unknown80801716 = rsat.schema(0x80801716, {
    unknown0: rsat.optional(rsat.nested(Unknown8080172C)),
    unknown1: rsat.optional(rsat.nested(Unknown808017D6)),
  });

  // 808016E0 @0x202dcd0, size 0x18
  const Unknown808016E0 = rsat.schema(0x808016e0, {
    unknown0: rsat.optional(rsat.i16()),
    unknown1: rsat.optional(rsat.u64()),
    unknown2: rsat.optional(rsat.i32()),
    unknown3: rsat.optional(rsat.i32()),
  });

  // 80804591 @0x2027330, size 0xc00
  const Unknown80804591 = rsat.schema(0x80804591, {
    unknown0: rsat.repeat(rsat.nested(Unknown808016E0), 128),
  });

  // 80804662 @0x2197060, size 0xc08
  const Unknown80804662 = rsat.schema(0x80804662, {
    unknown0: rsat.optional(rsat.i32()),
    unknown1: rsat.optional(rsat.nested(Unknown80804591)),
  });

  // 8080472B @0x231d330, size 0x200
  const Unknown8080472B = rsat.schema(0x8080472b, {
    unknown0: rsat.optionsArray(rsat.i32(), 128),
  });

  // 80804595 @0x2036110, size 0x400
  const Unknown80804595 = rsat.schema(0x80804595, {
    unknown0: rsat.optionsArray(rsat.i8({ size: 2, bias: 1 }), 1024),
  });

  // 80804607 @0x20fad30, size 0x80
  const Unknown80804607 = rsat.schema(0x80804607, {
    unknown0: rsat.optionsArray(rsat.i8({ size: 2, bias: 1 }), 128),
  });

  // 80801807 @0x2227300, size 0x81
  const Unknown80801807 = rsat.schema(0x80801807, {
    unknown0: rsat.bool(),
    unknown1: rsat.nested(Unknown80804607),
  });

  // 8080468C @0x21d9550, size 0x22
  const Unknown8080468C = rsat.schema(0x8080468c, {
    unknown0: rsat.repeat(rsat.i16(), 17),
  });

  // 80804712 @0x22eda10, size 0xa
  const Unknown80804712 = rsat.schema(0x80804712, {
    unknown0: rsat.repeat(rsat.i16(), 5),
  });

  // 8080192E @0x2470960, size 0x8
  const Unknown8080192E = rsat.schema(0x8080192e, {
    unknown0: rsat.optional(rsat.u32()),
    unknown1: rsat.optional(rsat.u32()),
  });

  // 80804663 @0x219bb80, size 0x408
  const Unknown80804663 = rsat.schema(0x80804663, {
    unknown0: rsat.repeat(rsat.nested(Unknown8080192E), 129),
  });

  // 808018C7 @0x23bca70, size 0x1b68, headerChecksum 0xc6de35f0
  const Unknown808018C7 = rsat.schema(0x808018c7, {
    soid: rsat.optional(rsat.u64()),
    roster: rsat.optional(rsat.nested(Unknown80804621)),
    characterSoid: rsat.optional(rsat.u64()),
    unknown3: rsat.optional(rsat.nested(Unknown80801716)),
    unknown4: rsat.optional(rsat.i8({ size: 2, bias: 1 })),
    unknown5: rsat.optional(rsat.nested(Unknown80804662)),
    unknown6: rsat.optional(rsat.nested(Unknown8080472B)),
    unknown7: rsat.optional(rsat.nested(Unknown80804595)),
    unknown8: rsat.nested(Unknown80801807),
    unknown9: rsat.optional(rsat.nested(Unknown8080468C)),
    unknown10: rsat.optional(rsat.nested(Unknown80804712)),
    unknown11: rsat.optional(rsat.nested(Unknown80804663)),
    unknown12: rsat.optional(rsat.u32()),
  });

  // Queuez object header checksums: +8 of each schema's record.
  const SELF_CHECKSUM_PRIMARY = 0x759e0ecb;

  // 80801803 @0x2224c10, size 0x1b68, headerChecksum 0x759e0ecb
  const SelfPrimary = rsat.schema(0x80801803, {
    unknown0: rsat.nested(Unknown808018C7),
  });

  // 808017FC @0x2219860, size 0x3
  const Unknown808017FC = rsat.schema(0x808017fc, {
    unknown0: rsat.optional(rsat.i8()),
    unknown1: rsat.optional(rsat.i8()),
    unknown2: rsat.optional(rsat.i8()),
  });

  // 80804705 @0x22cc650, size 0x6
  const Unknown80804705 = rsat.schema(0x80804705, {
    unknown0: rsat.i16(),
    unknown1: rsat.i16(),
    unknown2: rsat.i16(),
  });

  // 8080181A @0x2244af0, size 0x24
  const Unknown8080181A = rsat.schema(0x8080181a, {
    unknown0: rsat.i16(),
    unknown1: rsat.i8(),
    unknown2: rsat.i8(),
    unknown3: rsat.i8(),
    unknown4: rsat.i16(),
    unknown5: rsat.i16(),
    unknown6: rsat.i16(),
    unknown7: rsat.nested(Unknown80804705),
    unknown8: rsat.nested(Unknown80804705),
    unknown9: rsat.i16(),
    unknown10: rsat.u32(),
    unknown11: rsat.i8({ size: 2, bias: 1 }),
  });

  // 80804764 @0x23904a0, size 0x1800
  const Unknown80804764 = rsat.schema(0x80804764, {
    unknown0: rsat.repeat(rsat.nested(Unknown808016E0), 256),
  });

  // 80804645 @0x216ba10, size 0x1808
  const Unknown80804645 = rsat.schema(0x80804645, {
    unknown0: rsat.optional(rsat.i32()),
    unknown1: rsat.optional(rsat.nested(Unknown80804764)),
  });

  // 808045DA @0x20a6310, size 0xa0
  const Unknown808045DA = rsat.schema(0x808045da, {
    unknown0: rsat.repeat(rsat.u64(), 20),
  });

  // 808017B9 @0x21b89c0, size 0x10
  const Unknown808017B9 = rsat.schema(0x808017b9, {
    unknown0: rsat.i16(),
    unknown1: rsat.i16(),
    unknown2: rsat.i32(),
    unknown3: rsat.u32(),
    unknown4: rsat.bool(),
  });

  // 808016D2 @0x20170d0, size 0xc
  const Unknown808016D2 = rsat.schema(0x808016d2, {
    unknown0: rsat.optional(rsat.f32()),
    unknown1: rsat.optional(rsat.f32()),
    unknown2: rsat.optional(rsat.f32()),
  });

  // 8080179E @0x217c2d0, size 0x1c
  const Unknown8080179E = rsat.schema(0x8080179e, {
    unknown0: rsat.optional(rsat.nested(Unknown808016D2)),
    unknown1: rsat.optional(rsat.nested(Unknown808041C3)),
  });

  // 808018E5 @0x23ee130, size 0x4
  const Unknown808018E5 = rsat.schema(0x808018e5, {
    unknown0: rsat.i8(),
    unknown1: rsat.i8(),
    unknown2: rsat.i8({ size: 3, bias: 1 }),
    unknown3: rsat.u8({ size: 5, bias: 0 }),
  });

  // 808018DB @0x23dfad0, size 0xc
  const Unknown808018DB = rsat.schema(0x808018db, {
    unknown0: rsat.optional(rsat.nested(Unknown808018E5)),
    unknown1: rsat.optional(rsat.i32()),
    unknown2: rsat.optional(rsat.i8()),
  });

  // 808016D7 @0x201be00, size 0x30
  const Unknown808016D7 = rsat.schema(0x808016d7, {
    unknown0: rsat.optional(rsat.u64()),
    unknown1: rsat.optional(rsat.i16()),
    unknown2: rsat.optional(rsat.nested(Unknown8080468C)),
    unknown3: rsat.optional(rsat.u8({ size: 4, bias: 0 })),
  });

  // 808046EE @0x22910a0, size 0x3c0
  const Unknown808046EE = rsat.schema(0x808046ee, {
    unknown0: rsat.repeat(rsat.nested(Unknown808016D7), 20),
  });

  // 80801927 @0x2462d40, size 0x3d8
  const Unknown80801927 = rsat.schema(0x80801927, {
    unknown0: rsat.optional(rsat.nested(Unknown808046EE)),
    unknown1: rsat.optional(rsat.u64()),
    unknown2: rsat.optional(rsat.i32()),
    unknown3: rsat.optional(rsat.f32()),
    unknown4: rsat.optional(rsat.f32()),
    unknown5: rsat.optional(rsat.i8()),
    unknown6: rsat.optional(rsat.i8()),
  });

  // 808043BC @0x24440f0, size 0x84
  const Unknown808043BC = rsat.schema(0x808043bc, {
    unknown0: rsat.array(rsat.u8(), { lengthBits: 8, max: 128 }),
  });

  // 808018FE @0x241b650, size 0x90
  const Unknown808018FE = rsat.schema(0x808018fe, {
    unknown0: rsat.optional(rsat.nested(Unknown808043BC)),
    unknown1: rsat.optional(rsat.u64()),
  });

  // 80804422 @0x24bdc40, size 0x20
  const Unknown80804422 = rsat.schema(0x80804422, {
    unknown0: rsat.repeat(rsat.u32(), 8),
  });

  // 808018DD @0x23e21b0, size 0x4a0
  const Unknown808018DD = rsat.schema(0x808018dd, {
    unknown0: rsat.optional(rsat.nested(Unknown808018DB)),
    unknown1: rsat.optional(rsat.nested(Unknown80801927)),
    unknown2: rsat.optional(rsat.nested(Unknown808018FE)),
    unknown3: rsat.optional(rsat.u32()),
    unknown4: rsat.optional(rsat.nested(Unknown80804422)),
  });

  // 8080193C @0x248a6e0, size 0x4c0
  const Unknown8080193C = rsat.schema(0x8080193c, {
    unknown0: rsat.optional(rsat.nested(Unknown8080179E)),
    unknown1: rsat.optional(rsat.nested(Unknown808018DD)),
  });

  // 8080176B @0x212f9d0, size 0x10
  const Unknown8080176B = rsat.schema(0x8080176b, {
    unknown0: rsat.optional(rsat.i8()),
    unknown1: rsat.optional(rsat.i32()),
    unknown2: rsat.optional(rsat.i32()),
    unknown3: rsat.optional(rsat.i32()),
  });

  // 808047A7 @0x2418b40, size 0x7f4
  const Unknown808047A7 = rsat.schema(0x808047a7, {
    unknown0: rsat.array(rsat.nested(Unknown8080176B), {
      lengthBits: 7,
      max: 127,
    }),
  });

  // 808017B4 @0x21ada30, size 0x10
  const Unknown808017B4 = rsat.schema(0x808017b4, {
    unknown0: rsat.optional(rsat.bool()),
    unknown1: rsat.optional(rsat.u64()),
  });

  // 80801755 @0x20fc2b0, size 0x38
  const Unknown80801755 = rsat.schema(0x80801755, {
    unknown0: rsat.optional(rsat.i32()),
    unknown1: rsat.optional(rsat.i32()),
    unknown2: rsat.optional(rsat.i32()),
    unknown3: rsat.optional(rsat.i32()),
    unknown4: rsat.optional(rsat.u64()),
    unknown5: rsat.optional(rsat.u64()),
    unknown6: rsat.optional(rsat.u64()),
    unknown7: rsat.optional(rsat.nested(Unknown808017B4)),
  });

  // 808017E8 @0x21eb780, size 0x10
  const Unknown808017E8 = rsat.schema(0x808017e8, {
    unknown0: rsat.i32(),
    unknown1: rsat.u64(),
  });

  // 808018FF @0x241c220, size 0x18
  const Unknown808018FF = rsat.schema(0x808018ff, {
    unknown0: rsat.nested(Unknown808017E8),
    unknown1: rsat.i32(),
  });

  // 808017E7 @0x21e9250, size 0x8
  const Unknown808017E7 = rsat.schema(0x808017e7, {
    unknown0: rsat.optional(rsat.i8()),
    unknown1: rsat.optional(rsat.i32()),
  });

  // 808046A9 @0x2209a40, size 0x14
  const Unknown808046A9 = rsat.schema(0x808046a9, {
    unknown0: rsat.array(rsat.nested(Unknown808017E7), {
      lengthBits: 2,
      max: 2,
    }),
  });

  // 80801711 @0x208ba30, size 0x2c
  const Unknown80801711 = rsat.schema(0x80801711, {
    unknown0: rsat.optional(rsat.nested(Unknown808046A9)),
    unknown1: rsat.optional(rsat.nested(Unknown808046A9)),
    unknown2: rsat.optional(rsat.i16()),
  });

  // 8080187A @0x2319470, size 0x44
  const Unknown8080187A = rsat.schema(0x8080187a, {
    unknown0: rsat.optional(rsat.nested(Unknown80801711)),
    unknown1: rsat.optional(rsat.nested(Unknown808046A9)),
    unknown2: rsat.optional(rsat.i8()),
  });

  // 80801829 @0x2272410, size 0x70
  const Unknown80801829 = rsat.schema(0x80801829, {
    unknown0: rsat.optional(rsat.i16()),
    unknown1: rsat.optional(rsat.i32()),
    unknown2: rsat.optional(rsat.i8({ size: 3, bias: 1 })),
    unknown3: rsat.optional(rsat.nested(Unknown808018FF)),
    unknown4: rsat.optional(rsat.nested(Unknown8080187A)),
  });

  // 80804671 @0x21ace20, size 0x1c00
  const Unknown80804671 = rsat.schema(0x80804671, {
    unknown0: rsat.repeat(rsat.nested(Unknown80801829), 64),
  });

  // 80804736 @0x233b440, size 0x40
  const Unknown80804736 = rsat.schema(0x80804736, {
    unknown0: rsat.optionsArray(rsat.f32(), 16),
  });

  // 8080471B @0x2302470, size 0x30
  const Unknown8080471B = rsat.schema(0x8080471b, {
    unknown0: rsat.optionsArray(rsat.f32(), 12),
  });

  // 808017C8 @0x21c41b0, size 0x34
  const Unknown808017C8 = rsat.schema(0x808017c8, {
    unknown0: rsat.optional(rsat.nested(Unknown8080471B)),
    unknown1: rsat.optional(rsat.i8()),
  });

  // 8080479B @0x24064a0, size 0x340
  const Unknown8080479B = rsat.schema(0x8080479b, {
    unknown0: rsat.repeat(rsat.nested(Unknown808017C8), 16),
  });

  // 80801936 @0x247bc60, size 0x384
  const Unknown80801936 = rsat.schema(0x80801936, {
    unknown0: rsat.optional(rsat.u32()),
    unknown1: rsat.optional(rsat.nested(Unknown80804736)),
    unknown2: rsat.optional(rsat.nested(Unknown8080479B)),
  });

  // 80801701 @0x2070300, size 0x1fa0
  const Unknown80801701 = rsat.schema(0x80801701, {
    unknown0: rsat.optional(rsat.i32()),
    unknown1: rsat.optional(rsat.nested(Unknown80804671)),
    unknown2: rsat.optional(rsat.nested(Unknown80801936)),
    unknown3: rsat.optional(rsat.nested(Unknown808017E8)),
  });

  // 80801997 @0x23acf30, size 0x18
  const Unknown80801997 = rsat.schema(0x80801997, {
    unknown0: rsat.optional(rsat.i16()),
    unknown1: rsat.optional(rsat.u64()),
    unknown2: rsat.optional(rsat.i32()),
  });

  // 80805511 @0x2360910, size 0x68
  const Unknown80805511 = rsat.schema(0x80805511, {
    unknown0: rsat.array(rsat.nested(Unknown80801997), {
      lengthBits: 3,
      max: 4,
    }),
  });

  // 80801781 @0x214e770, size 0x90
  const Unknown80801781 = rsat.schema(0x80801781, {
    unknown0: rsat.optional(rsat.nested(Unknown80805511)),
    unknown1: rsat.optional(rsat.nested(Unknown80801997)),
    unknown2: rsat.optional(rsat.i32()),
    unknown3: rsat.optional(rsat.u64()),
  });

  // 808046E2 @0x227b690, size 0x10e0
  const Unknown808046E2 = rsat.schema(0x808046e2, {
    unknown0: rsat.repeat(rsat.nested(Unknown80801781), 30),
  });

  // 8080174F @0x20e90d0, size 0x10e8
  const Unknown8080174F = rsat.schema(0x8080174f, {
    unknown0: rsat.optional(rsat.i32()),
    unknown1: rsat.optional(rsat.nested(Unknown808046E2)),
  });

  // 8080472C @0x231f850, size 0x80
  const Unknown8080472C = rsat.schema(0x8080472c, {
    unknown0: rsat.optionsArray(rsat.i32(), 32),
  });

  // 80804707 @0x22d3390, size 0x100
  const Unknown80804707 = rsat.schema(0x80804707, {
    unknown0: rsat.optionsArray(rsat.u64(), 32),
  });

  // 80804599 @0x2042cb0, size 0x40
  const Unknown80804599 = rsat.schema(0x80804599, {
    unknown0: rsat.optionsArray(rsat.i16(), 32),
  });

  // 8080470E @0x22dc120, size 0x100
  const Unknown8080470E = rsat.schema(0x8080470e, {
    unknown0: rsat.optionsArray(rsat.u64(), 32),
  });

  // 808047AC @0x2420210, size 0x200
  const Unknown808047AC = rsat.schema(0x808047ac, {
    unknown0: rsat.optionsArray(rsat.bool(), 512),
  });

  // 80801724 @0x20aeae0, size 0x388
  const Unknown80801724 = rsat.schema(0x80801724, {
    unknown0: rsat.optional(rsat.nested(Unknown80804599)),
    unknown1: rsat.optional(rsat.nested(Unknown8080470E)),
    unknown2: rsat.optional(rsat.nested(Unknown80804599)),
    unknown3: rsat.optional(rsat.nested(Unknown808047AC)),
    unknown4: rsat.optional(rsat.u64()),
  });

  // 808018B6 @0x23a1ce0, size 0x8
  const Unknown808018B6 = rsat.schema(0x808018b6, {
    unknown0: rsat.optional(rsat.i8()),
    unknown1: rsat.optional(rsat.i32()),
  });

  // 80804768 @0x239e640, size 0x38
  const Unknown80804768 = rsat.schema(0x80804768, {
    unknown0: rsat.repeat(rsat.nested(Unknown808018B6), 7),
  });

  // 80801912 @0x2449f40, size 0x3c
  const Unknown80801912 = rsat.schema(0x80801912, {
    unknown0: rsat.optional(rsat.bool()),
    unknown1: rsat.optional(rsat.nested(Unknown80804768)),
  });

  // 8080185C @0x22d2e10, size 0x4
  const Unknown8080185C = rsat.schema(0x8080185c, {
    unknown0: rsat.optional(rsat.i16()),
    unknown1: rsat.optional(rsat.i8({ size: 2, bias: 1 })),
  });

  // 80804636 @0x2154db0, size 0x18
  const Unknown80804636 = rsat.schema(0x80804636, {
    unknown0: rsat.array(rsat.nested(Unknown8080185C), {
      lengthBits: 3,
      max: 5,
    }),
  });

  // 808018BB @0x23ad150, size 0xa8
  const Unknown808018BB = rsat.schema(0x808018bb, {
    unknown0: rsat.optional(rsat.i32()),
    unknown1: rsat.optional(rsat.i32()),
    unknown2: rsat.optional(rsat.i16()),
    unknown3: rsat.optional(rsat.nested(Unknown80801912)),
    unknown4: rsat.optional(rsat.nested(Unknown80801912)),
    unknown5: rsat.optional(rsat.nested(Unknown80804636)),
    unknown6: rsat.optional(rsat.bool()),
    unknown7: rsat.optional(rsat.bool()),
    unknown8: rsat.optional(rsat.i32()),
    unknown9: rsat.optional(rsat.u32()),
  });

  // 80801923 @0x245b3f0, size 0xc
  const Unknown80801923 = rsat.schema(0x80801923, {
    unknown0: rsat.optional(rsat.f32()),
    unknown1: rsat.optional(rsat.i32()),
    unknown2: rsat.optional(rsat.i16()),
  });

  // 808016F8 @0x2063ad0, size 0x14
  const Unknown808016F8 = rsat.schema(0x808016f8, {
    unknown0: rsat.optional(rsat.i32()),
    unknown1: rsat.optional(rsat.f32()),
    unknown2: rsat.optional(rsat.nested(Unknown80801923)),
  });

  // 8080469B @0x21eef40, size 0x200
  const Unknown8080469B = rsat.schema(0x8080469b, {
    unknown0: rsat.optionsArray(rsat.i8({ size: 2, bias: 1 }), 512),
  });

  // 80801714 @0x208fb60, size 0x60a8, headerChecksum 0x201864e5
  const SelfCharacter = rsat.schema(0x80801714, {
    soid: rsat.optional(rsat.u64()),
    unknown1: rsat.optional(rsat.nested(Unknown808017FC)),
    unknown2: rsat.optional(rsat.nested(Unknown8080181A)),
    unknown3: rsat.optional(rsat.nested(Unknown80804645)),
    unknown4: rsat.optional(rsat.nested(Unknown808045DA)),
    unknown5: rsat.optional(rsat.nested(Unknown808017B9)),
    unknown6: rsat.optional(rsat.nested(Unknown8080193C)),
    unknown7: rsat.optional(rsat.nested(Unknown808047A7)),
    unknown8: rsat.optional(rsat.nested(Unknown80801755)),
    unknown9: rsat.optional(rsat.nested(Unknown80801701)),
    unknown10: rsat.optional(rsat.nested(Unknown8080469B)),
    unknown11: rsat.optional(rsat.nested(Unknown8080174F)),
    unknown12: rsat.optional(rsat.nested(Unknown8080472C)),
    unknown13: rsat.optional(rsat.nested(Unknown8080472C)),
    unknown14: rsat.optional(rsat.nested(Unknown80804707)),
    unknown15: rsat.optional(rsat.nested(Unknown80801724)),
    unknown16: rsat.optional(rsat.nested(Unknown808018BB)),
    unknown17: rsat.optional(rsat.nested(Unknown8080472B)),
    unknown18: rsat.optional(rsat.nested(Unknown808016F8)),
  });

  const SELF_CHECKSUM_INVENTORY = 0x2eb86cb3;

  // 80801743 @0x20d3ce0, size 0x60a8, headerChecksum 0x2eb86cb3
  const SelfInventory = rsat.schema(0x80801743, {
    unknown0: rsat.nested(SelfCharacter),
  });

  // 80801920 @0x245a790, size 0x10
  const Unknown80801920 = rsat.schema(0x80801920, {
    unknown0: rsat.optional(rsat.i8({ size: 2, bias: 1 })),
    unknown1: rsat.optional(rsat.u64()),
  });

  // 80801708 @0x207ec60, size 0x3, headerChecksum 0x1c128df9
  const Unknown80801708 = rsat.schema(0x80801708, {
    unknown0: rsat.i8(),
    unknown1: rsat.i8(),
    unknown2: rsat.i8(),
  });

  // 80804629 @0x213c050, size 0xf
  const Unknown80804629 = rsat.schema(0x80804629, {
    unknown0: rsat.repeat(rsat.nested(Unknown80801708), 5),
  });

  // 808043C6 @0x2452410, size 0x24
  const Unknown808043C6 = rsat.schema(0x808043c6, {
    unknown0: rsat.repeat(rsat.u8(), 36),
  });

  // 8080405E @0x23ecfa0, size 0x8
  const Unknown8080405E = rsat.schema(0x8080405e, {
    unknown0: rsat.repeat(rsat.u8(), 8),
  });

  // 80801846 @0x22a27d0, size 0x54
  const Unknown80801846 = rsat.schema(0x80801846, {
    unknown0: rsat.optional(rsat.i16()),
    unknown1: rsat.optional(rsat.nested(Unknown8080176B)),
    unknown2: rsat.optional(rsat.u8()),
    unknown3: rsat.optional(rsat.u8()),
    unknown4: rsat.optional(rsat.nested(Unknown808043C6)),
    unknown5: rsat.optional(rsat.nested(Unknown8080405E)),
    unknown6: rsat.optional(rsat.nested(Unknown80804629)),
  });

  const SELF_CHECKSUM_ITEM = 0x2b06e968;

  // 80801732 @0x20c2390, size 0xa0, headerChecksum 0x2b06e968
  const InventoryItem = rsat.schema(0x80801732, {
    soid: rsat.optional(rsat.u64()),
    defIndex: rsat.optional(rsat.i16()),
    unknown2: rsat.optional(rsat.nested(Unknown80801920)),
    unknown3: rsat.optional(rsat.nested(Unknown80801711)),
    unknown4: rsat.optional(rsat.nested(Unknown80801846)),
  });

  return {
    Unknown80804621,
    Unknown808047C9,
    Unknown808041C3,
    Unknown8080172C,
    Unknown808018C5,
    Unknown80801705,
    Unknown808017F0,
    Unknown808017D6,
    Unknown80801716,
    Unknown808016E0,
    Unknown80804591,
    Unknown80804662,
    Unknown8080472B,
    Unknown80804595,
    Unknown80804607,
    Unknown80801807,
    Unknown8080468C,
    Unknown80804712,
    Unknown8080192E,
    Unknown80804663,
    Unknown808018C7,
    SELF_CHECKSUM_PRIMARY,
    SelfPrimary,
    Unknown808017FC,
    Unknown80804705,
    Unknown8080181A,
    Unknown80804764,
    Unknown80804645,
    Unknown808045DA,
    Unknown808017B9,
    Unknown808016D2,
    Unknown8080179E,
    Unknown808018E5,
    Unknown808018DB,
    Unknown808016D7,
    Unknown808046EE,
    Unknown80801927,
    Unknown808043BC,
    Unknown808018FE,
    Unknown80804422,
    Unknown808018DD,
    Unknown8080193C,
    Unknown8080176B,
    Unknown808047A7,
    Unknown808017B4,
    Unknown80801755,
    Unknown808017E8,
    Unknown808018FF,
    Unknown808017E7,
    Unknown808046A9,
    Unknown80801711,
    Unknown8080187A,
    Unknown80801829,
    Unknown80804671,
    Unknown80804736,
    Unknown8080471B,
    Unknown808017C8,
    Unknown8080479B,
    Unknown80801936,
    Unknown80801701,
    Unknown80801997,
    Unknown80805511,
    Unknown80801781,
    Unknown808046E2,
    Unknown8080174F,
    Unknown8080472C,
    Unknown80804707,
    Unknown80804599,
    Unknown8080470E,
    Unknown808047AC,
    Unknown80801724,
    Unknown808018B6,
    Unknown80804768,
    Unknown80801912,
    Unknown8080185C,
    Unknown80804636,
    Unknown808018BB,
    Unknown80801923,
    Unknown808016F8,
    Unknown8080469B,
    SelfCharacter,
    SELF_CHECKSUM_INVENTORY,
    SelfInventory,
    Unknown80801920,
    Unknown80801708,
    Unknown80804629,
    Unknown808043C6,
    Unknown8080405E,

    Unknown80801846,
    SELF_CHECKSUM_ITEM,
    InventoryItem,
  };
}

export type SelfSchemas = ReturnType<typeof defineSelfSchemas>;

export type SelfPrimaryValue = rsat.Infer<SelfSchemas["SelfPrimary"]>;
export type SelfCharacterValue = rsat.Infer<SelfSchemas["SelfCharacter"]>;
export type InventoryItemValue = rsat.Infer<SelfSchemas["InventoryItem"]>;
