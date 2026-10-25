// Client schemas, from the eboot's schema registry (scripts/rsat-descriptors.py
// dumps it): record address, PS4 size and checksum. Unnamed fields are
// unknownN, their member index in the record.

import { rsat } from "@blamnetwork/rsat";

// Schemas register by id when this runs, so only the build's loader calls it.
export function defineSelfSchemas() {
  // 80804621 @0x18ae390, size 0x58
  const Unknown80804621 = rsat.schema(0x80804621, {
    soids: rsat.array(rsat.u64(), { lengthBits: 4, max: 10 }),
  });

  // 808047C9 @0x19c0040, size 0x400
  const Unknown808047C9 = rsat.schema(0x808047c9, {
    unknown0: rsat.optionsArray(rsat.u64(), 128),
  });

  // 808041C3 @0x1923ab0, size 0x10
  const Unknown808041C3 = rsat.schema(0x808041c3, {
    unknown0: rsat.repeat(rsat.u32(), 4),
  });

  // 8080172C @0x18bf840, size 0x410
  const Unknown8080172C = rsat.schema(0x8080172c, {
    unknown0: rsat.optional(rsat.nested(Unknown808047C9)),
    unknown1: rsat.optional(rsat.nested(Unknown808041C3)),
  });

  // 808018C5 @0x196ade0, size 0x8
  const Unknown808018C5 = rsat.schema(0x808018c5, {
    unknown0: rsat.f32(),
    unknown1: rsat.f32(),
  });

  // 80801705 @0x19742c8, size 0x10
  const Unknown80801705 = rsat.schema(0x80801705, {
    unknown0: rsat.optional(rsat.nested(Unknown808018C5)),
    unknown1: rsat.optional(rsat.nested(Unknown808018C5)),
  });

  // 808017F0 @0x1911860, size 0xc
  const Unknown808017F0 = rsat.schema(0x808017f0, {
    unknown0: rsat.optional(rsat.bool()),
    unknown1: rsat.optional(rsat.i8({ size: 4, bias: 1 })),
    unknown2: rsat.optional(rsat.i8({ size: 3, bias: 1 })),
    unknown3: rsat.optional(rsat.i8({ size: 4, bias: 1 })),
    unknown4: rsat.optional(rsat.i8({ size: 2, bias: 1 })),
    unknown5: rsat.optional(rsat.i8({ size: 2, bias: 1 })),
    unknown6: rsat.optional(rsat.i8({ size: 3, bias: 1 })),
    unknown7: rsat.optional(rsat.bool()),
    unknown8: rsat.optional(rsat.bool()),
    unknown9: rsat.optional(rsat.bool()),
    unknown10: rsat.optional(rsat.bool()),
    unknown11: rsat.optional(rsat.bool()),
  });

  // 808017D6 @0x1926668, size 0x20
  const Unknown808017D6 = rsat.schema(0x808017d6, {
    unknown0: rsat.optional(rsat.nested(Unknown80801705)),
    unknown1: rsat.optional(rsat.nested(Unknown808017F0)),
  });

  // 80801716 @0x190fb60, size 0x430
  const Unknown80801716 = rsat.schema(0x80801716, {
    unknown0: rsat.optional(rsat.nested(Unknown8080172C)),
    unknown1: rsat.optional(rsat.nested(Unknown808017D6)),
  });

  // 808016E0 @0x18c0070, size 0x18
  const Unknown808016E0 = rsat.schema(0x808016e0, {
    unknown0: rsat.optional(rsat.i16()),
    unknown1: rsat.optional(rsat.u64()),
    unknown2: rsat.optional(rsat.i32()),
    unknown3: rsat.optional(rsat.i32()),
  });

  // 80804591 @0x1971b48, size 0xc00
  const Unknown80804591 = rsat.schema(0x80804591, {
    unknown0: rsat.repeat(rsat.nested(Unknown808016E0), 128),
  });

  // 80804662 @0x1872d40, size 0xc08
  const Unknown80804662 = rsat.schema(0x80804662, {
    unknown0: rsat.optional(rsat.i32()),
    unknown1: rsat.optional(rsat.nested(Unknown80804591)),
  });

  // 8080472B @0x198c6f8, size 0x200
  const Unknown8080472B = rsat.schema(0x8080472b, {
    unknown0: rsat.optionsArray(rsat.i32(), 128),
  });

  // 80804595 @0x19e2770, size 0x400
  const Unknown80804595 = rsat.schema(0x80804595, {
    unknown0: rsat.optionsArray(rsat.i8({ size: 2, bias: 1 }), 1024),
  });

  // 808047D8 @0x1960b48, size 0x100
  const Unknown808047D8 = rsat.schema(0x808047d8, {
    unknown0: rsat.optionsArray(rsat.i8({ size: 2, bias: 1 }), 256),
  });

  // 80801807 @0x18f9760, size 0x101
  const Unknown80801807 = rsat.schema(0x80801807, {
    unknown0: rsat.bool(),
    unknown1: rsat.nested(Unknown808047D8),
  });

  // 80805AF2 @0x18aeb60, size 0x36
  const Unknown80805AF2 = rsat.schema(0x80805af2, {
    unknown0: rsat.repeat(rsat.i16(), 27),
  });

  // 80804712 @0x189b520, size 0xa
  const Unknown80804712 = rsat.schema(0x80804712, {
    unknown0: rsat.repeat(rsat.i16(), 5),
  });

  // 8080192E @0x19237c0, size 0x8
  const Unknown8080192E = rsat.schema(0x8080192e, {
    unknown0: rsat.optional(rsat.u32()),
    unknown1: rsat.optional(rsat.u32()),
  });

  // 80804625 @0x196bfb8, size 0x800
  const Unknown80804625 = rsat.schema(0x80804625, {
    unknown0: rsat.repeat(rsat.nested(Unknown8080192E), 256),
  });

  // 808018C7 @0x18d50a8, size 0x1ff8, headerChecksum 0x1231f678
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
    unknown9: rsat.optional(rsat.nested(Unknown80805AF2)),
    unknown10: rsat.optional(rsat.nested(Unknown80804712)),
    unknown11: rsat.optional(rsat.nested(Unknown80804625)),
    unknown12: rsat.optional(rsat.i32()),
    unknown13: rsat.optional(rsat.u32()),
  });

  // Queuez object header checksums: +8 of each schema's record.
  const SELF_CHECKSUM_PRIMARY = 0x21c2fdac;

  // 80801803 @0x186e620, size 0x1ff8, headerChecksum 0x21c2fdac
  const SelfPrimary = rsat.schema(0x80801803, {
    unknown0: rsat.nested(Unknown808018C7),
  });

  // 808017FC @0x188c050, size 0x3
  const Unknown808017FC = rsat.schema(0x808017fc, {
    unknown0: rsat.optional(rsat.i8()),
    unknown1: rsat.optional(rsat.i8()),
    unknown2: rsat.optional(rsat.i8()),
  });

  // 80804705 @0x1872160, size 0x6
  const Unknown80804705 = rsat.schema(0x80804705, {
    unknown0: rsat.i16(),
    unknown1: rsat.i16(),
    unknown2: rsat.i16(),
  });

  // 8080181A @0x19b1420, size 0x24
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

  // 80804764 @0x19ad508, size 0x1800
  const Unknown80804764 = rsat.schema(0x80804764, {
    unknown0: rsat.repeat(rsat.nested(Unknown808016E0), 256),
  });

  // 80804645 @0x18b1490, size 0x1808
  const Unknown80804645 = rsat.schema(0x80804645, {
    unknown0: rsat.optional(rsat.i32()),
    unknown1: rsat.optional(rsat.nested(Unknown80804764)),
  });

  // 808045DA @0x19fa500, size 0xa0
  const Unknown808045DA = rsat.schema(0x808045da, {
    unknown0: rsat.repeat(rsat.u64(), 20),
  });

  // 808017B9 @0x1884a60, size 0x10
  const Unknown808017B9 = rsat.schema(0x808017b9, {
    unknown0: rsat.i16(),
    unknown1: rsat.i16(),
    unknown2: rsat.i32(),
    unknown3: rsat.u32(),
    unknown4: rsat.bool(),
  });

  // 808016D2 @0x18878c0, size 0xc
  const Unknown808016D2 = rsat.schema(0x808016d2, {
    unknown0: rsat.optional(rsat.f32()),
    unknown1: rsat.optional(rsat.f32()),
    unknown2: rsat.optional(rsat.f32()),
  });

  // 8080179E @0x18863f0, size 0x20
  const Unknown8080179E = rsat.schema(0x8080179e, {
    unknown0: rsat.optional(rsat.nested(Unknown808016D2)),
    unknown1: rsat.optional(rsat.nested(Unknown808041C3)),
    unknown2: rsat.optional(rsat.f32()),
  });

  // 808018E5 @0x1994410, size 0x4
  const Unknown808018E5 = rsat.schema(0x808018e5, {
    unknown0: rsat.i8(),
    unknown1: rsat.i8(),
    unknown2: rsat.i8({ size: 3, bias: 1 }),
    unknown3: rsat.u8({ size: 5, bias: 0 }),
  });

  // 808018DB @0x1875830, size 0xc
  const Unknown808018DB = rsat.schema(0x808018db, {
    unknown0: rsat.optional(rsat.nested(Unknown808018E5)),
    unknown1: rsat.optional(rsat.i32()),
    unknown2: rsat.optional(rsat.i8()),
  });

  // 8080468C @0x18860b0, size 0x22
  const Unknown8080468C = rsat.schema(0x8080468c, {
    unknown0: rsat.repeat(rsat.i16(), 17),
  });

  // 808016D7 @0x1943a70, size 0x30
  const Unknown808016D7 = rsat.schema(0x808016d7, {
    unknown0: rsat.optional(rsat.u64()),
    unknown1: rsat.optional(rsat.i16()),
    unknown2: rsat.optional(rsat.nested(Unknown8080468C)),
    unknown3: rsat.optional(rsat.u8({ size: 4, bias: 0 })),
  });

  // 808046EE @0x1997990, size 0x3c0
  const Unknown808046EE = rsat.schema(0x808046ee, {
    unknown0: rsat.repeat(rsat.nested(Unknown808016D7), 20),
  });

  // 80801927 @0x187eed0, size 0x3e0
  const Unknown80801927 = rsat.schema(0x80801927, {
    unknown0: rsat.optional(rsat.nested(Unknown808046EE)),
    unknown1: rsat.optional(rsat.u64()),
    unknown2: rsat.optional(rsat.u64()),
    unknown3: rsat.optional(rsat.f32()),
    unknown4: rsat.optional(rsat.f32()),
    unknown5: rsat.optional(rsat.i8()),
    unknown6: rsat.optional(rsat.i8()),
  });

  // 808043BC @0x18774c0, size 0x84
  const Unknown808043BC = rsat.schema(0x808043bc, {
    unknown0: rsat.array(rsat.u8(), { lengthBits: 8, max: 128 }),
  });

  // 808018FE @0x1a085f0, size 0x90
  const Unknown808018FE = rsat.schema(0x808018fe, {
    unknown0: rsat.optional(rsat.nested(Unknown808043BC)),
    unknown1: rsat.optional(rsat.u64()),
  });

  // 80804422 @0x1a07788, size 0x20
  const Unknown80804422 = rsat.schema(0x80804422, {
    unknown0: rsat.repeat(rsat.u32(), 8),
  });

  // 80805B5D @0x18da7c0, size 0x400
  const Unknown80805B5D = rsat.schema(0x80805b5d, {
    unknown0: rsat.repeat(rsat.i32(), 256),
  });

  // 80801805 @0x18bc3a8, size 0x420
  const Unknown80801805 = rsat.schema(0x80801805, {
    unknown0: rsat.optional(rsat.nested(Unknown80804422)),
    unknown1: rsat.optional(rsat.nested(Unknown80805B5D)),
  });

  // 808018DD @0x186eb10, size 0x8a8
  const Unknown808018DD = rsat.schema(0x808018dd, {
    unknown0: rsat.optional(rsat.nested(Unknown808018DB)),
    unknown1: rsat.optional(rsat.nested(Unknown80801927)),
    unknown2: rsat.optional(rsat.nested(Unknown808018FE)),
    unknown3: rsat.optional(rsat.u32()),
    unknown4: rsat.optional(rsat.nested(Unknown80801805)),
  });

  // 8080193C @0x19c70d8, size 0x8c8
  const Unknown8080193C = rsat.schema(0x8080193c, {
    unknown0: rsat.optional(rsat.nested(Unknown8080179E)),
    unknown1: rsat.optional(rsat.nested(Unknown808018DD)),
  });

  // 8080176B @0x19a42c8, size 0x10
  const Unknown8080176B = rsat.schema(0x8080176b, {
    unknown0: rsat.optional(rsat.i16()),
    unknown1: rsat.optional(rsat.i32()),
    unknown2: rsat.optional(rsat.i32()),
    unknown3: rsat.optional(rsat.i32()),
  });

  // 808047A7 @0x188e670, size 0x7f4
  const Unknown808047A7 = rsat.schema(0x808047a7, {
    unknown0: rsat.array(rsat.nested(Unknown8080176B), {
      lengthBits: 7,
      max: 127,
    }),
  });

  // 808017B4 @0x195ad88, size 0x10
  const Unknown808017B4 = rsat.schema(0x808017b4, {
    unknown0: rsat.optional(rsat.bool()),
    unknown1: rsat.optional(rsat.u64()),
  });

  // 80801755 @0x19a4a28, size 0x38
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

  // 808017E8 @0x1a017b0, size 0x10
  const Unknown808017E8 = rsat.schema(0x808017e8, {
    unknown0: rsat.i32(),
    unknown1: rsat.u64(),
  });

  // 808018FF @0x191bf70, size 0x18
  const Unknown808018FF = rsat.schema(0x808018ff, {
    unknown0: rsat.nested(Unknown808017E8),
    unknown1: rsat.i32(),
  });

  // 80801711 @0x18a5cf0, size 0xc
  const Unknown80801711 = rsat.schema(0x80801711, {
    unknown0: rsat.optional(rsat.i32()),
    unknown1: rsat.optional(rsat.i32()),
    unknown2: rsat.optional(rsat.i16()),
  });

  // 8080187A @0x193e160, size 0x10
  const Unknown8080187A = rsat.schema(0x8080187a, {
    unknown0: rsat.optional(rsat.nested(Unknown80801711)),
    unknown1: rsat.optional(rsat.i8()),
  });

  // 80801829 @0x18a6120, size 0x38
  const Unknown80801829 = rsat.schema(0x80801829, {
    unknown0: rsat.optional(rsat.i16()),
    unknown1: rsat.optional(rsat.i32()),
    unknown2: rsat.optional(rsat.i8({ size: 3, bias: 1 })),
    unknown3: rsat.optional(rsat.nested(Unknown808018FF)),
    unknown4: rsat.optional(rsat.nested(Unknown8080187A)),
  });

  // 80804671 @0x19dfa08, size 0xe00
  const Unknown80804671 = rsat.schema(0x80804671, {
    unknown0: rsat.repeat(rsat.nested(Unknown80801829), 64),
  });

  // 808047CC @0x19b00e8, size 0x80
  const Unknown808047CC = rsat.schema(0x808047cc, {
    unknown0: rsat.optionsArray(rsat.f32(), 32),
  });

  // 8080471B @0x1942388, size 0x30
  const Unknown8080471B = rsat.schema(0x8080471b, {
    unknown0: rsat.optionsArray(rsat.f32(), 12),
  });

  // 808017C8 @0x19de938, size 0x34
  const Unknown808017C8 = rsat.schema(0x808017c8, {
    unknown0: rsat.optional(rsat.nested(Unknown8080471B)),
    unknown1: rsat.optional(rsat.i8()),
  });

  // 8080479B @0x18e54c0, size 0x340
  const Unknown8080479B = rsat.schema(0x8080479b, {
    unknown0: rsat.repeat(rsat.nested(Unknown808017C8), 16),
  });

  // 80801936 @0x188db70, size 0x3c4
  const Unknown80801936 = rsat.schema(0x80801936, {
    unknown0: rsat.optional(rsat.u32()),
    unknown1: rsat.optional(rsat.nested(Unknown808047CC)),
    unknown2: rsat.optional(rsat.nested(Unknown8080479B)),
  });

  // 80801701 @0x1960230, size 0x11e0
  const Unknown80801701 = rsat.schema(0x80801701, {
    unknown0: rsat.optional(rsat.i32()),
    unknown1: rsat.optional(rsat.nested(Unknown80804671)),
    unknown2: rsat.optional(rsat.nested(Unknown80801936)),
    unknown3: rsat.optional(rsat.nested(Unknown808017E8)),
  });

  // 80801997 @0x18931e0, size 0x18
  const Unknown80801997 = rsat.schema(0x80801997, {
    unknown0: rsat.optional(rsat.i16()),
    unknown1: rsat.optional(rsat.u64()),
    unknown2: rsat.optional(rsat.i32()),
  });

  // 80805511 @0x1892440, size 0x68
  const Unknown80805511 = rsat.schema(0x80805511, {
    unknown0: rsat.array(rsat.nested(Unknown80801997), {
      lengthBits: 3,
      max: 4,
    }),
  });

  // 80801781 @0x1915b08, size 0x90
  const Unknown80801781 = rsat.schema(0x80801781, {
    unknown0: rsat.optional(rsat.nested(Unknown80805511)),
    unknown1: rsat.optional(rsat.nested(Unknown80801997)),
    unknown2: rsat.optional(rsat.i32()),
    unknown3: rsat.optional(rsat.u64()),
  });

  // 808046E2 @0x19b7ca8, size 0x10e0
  const Unknown808046E2 = rsat.schema(0x808046e2, {
    unknown0: rsat.repeat(rsat.nested(Unknown80801781), 30),
  });

  // 8080174F @0x196f058, size 0x10e8
  const Unknown8080174F = rsat.schema(0x8080174f, {
    unknown0: rsat.optional(rsat.i32()),
    unknown1: rsat.optional(rsat.nested(Unknown808046E2)),
  });

  // 8080472C @0x1996b58, size 0x80
  const Unknown8080472C = rsat.schema(0x8080472c, {
    unknown0: rsat.optionsArray(rsat.i32(), 32),
  });

  // 80804707 @0x198b108, size 0x100
  const Unknown80804707 = rsat.schema(0x80804707, {
    unknown0: rsat.optionsArray(rsat.u64(), 32),
  });

  // 80804599 @0x190f2a8, size 0x40
  const Unknown80804599 = rsat.schema(0x80804599, {
    unknown0: rsat.optionsArray(rsat.i16(), 32),
  });

  // 8080470E @0x18d5688, size 0x100
  const Unknown8080470E = rsat.schema(0x8080470e, {
    unknown0: rsat.optionsArray(rsat.u64(), 32),
  });

  // 808047AC @0x19ca4c8, size 0x200
  const Unknown808047AC = rsat.schema(0x808047ac, {
    unknown0: rsat.optionsArray(rsat.bool(), 512),
  });

  // 80801724 @0x1889910, size 0x388
  const Unknown80801724 = rsat.schema(0x80801724, {
    unknown0: rsat.optional(rsat.nested(Unknown80804599)),
    unknown1: rsat.optional(rsat.nested(Unknown8080470E)),
    unknown2: rsat.optional(rsat.nested(Unknown80804599)),
    unknown3: rsat.optional(rsat.nested(Unknown808047AC)),
    unknown4: rsat.optional(rsat.u64()),
  });

  // 808018B6 @0x1988790, size 0x8
  const Unknown808018B6 = rsat.schema(0x808018b6, {
    unknown0: rsat.optional(rsat.i8()),
    unknown1: rsat.optional(rsat.i32()),
  });

  // 80804768 @0x18a73c0, size 0x38
  const Unknown80804768 = rsat.schema(0x80804768, {
    unknown0: rsat.repeat(rsat.nested(Unknown808018B6), 7),
  });

  // 80801912 @0x19c9618, size 0x3c
  const Unknown80801912 = rsat.schema(0x80801912, {
    unknown0: rsat.optional(rsat.bool()),
    unknown1: rsat.optional(rsat.nested(Unknown80804768)),
  });

  // 8080185C @0x1924c88, size 0x4
  const Unknown8080185C = rsat.schema(0x8080185c, {
    unknown0: rsat.optional(rsat.i16()),
    unknown1: rsat.optional(rsat.i8({ size: 2, bias: 1 })),
  });

  // 80804636 @0x1874650, size 0x18
  const Unknown80804636 = rsat.schema(0x80804636, {
    unknown0: rsat.array(rsat.nested(Unknown8080185C), {
      lengthBits: 3,
      max: 5,
    }),
  });

  // 808018BB @0x1926fe0, size 0xa8
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

  // 80801923 @0x1885e00, size 0xc
  const Unknown80801923 = rsat.schema(0x80801923, {
    unknown0: rsat.optional(rsat.f32()),
    unknown1: rsat.optional(rsat.i32()),
    unknown2: rsat.optional(rsat.i16()),
  });

  // 808016F8 @0x188ef20, size 0x14
  const Unknown808016F8 = rsat.schema(0x808016f8, {
    unknown0: rsat.optional(rsat.i32()),
    unknown1: rsat.optional(rsat.f32()),
    unknown2: rsat.optional(rsat.nested(Unknown80801923)),
  });

  // 80801714 @0x18752e0, size 0x58f0, headerChecksum 0x354e2318
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
    unknown10: rsat.optional(rsat.nested(Unknown80804595)),
    unknown11: rsat.optional(rsat.nested(Unknown8080174F)),
    unknown12: rsat.optional(rsat.nested(Unknown8080472C)),
    unknown13: rsat.optional(rsat.nested(Unknown8080472C)),
    unknown14: rsat.optional(rsat.nested(Unknown80804707)),
    unknown15: rsat.optional(rsat.nested(Unknown80801724)),
    unknown16: rsat.optional(rsat.nested(Unknown808018BB)),
    unknown17: rsat.optional(rsat.nested(Unknown8080472B)),
    unknown18: rsat.optional(rsat.nested(Unknown808016F8)),
  });

  const SELF_CHECKSUM_INVENTORY = 0xd34abc22;

  // 80801743 @0x18ad600, size 0x58f0, headerChecksum 0xd34abc22
  const SelfInventory = rsat.schema(0x80801743, {
    unknown0: rsat.nested(SelfCharacter),
  });

  // 80801920 @0x18e7b40, size 0x10
  const Unknown80801920 = rsat.schema(0x80801920, {
    unknown0: rsat.i8({ size: 2, bias: 1 }),
    unknown1: rsat.u64(),
  });

  // 808019A5 @0x18cca40, size 0x2
  const Unknown808019A5 = rsat.schema(0x808019a5, {
    unknown0: rsat.i8(),
    unknown1: rsat.i8(),
  });

  // 80801708 @0x19a1100, size 0x3, headerChecksum 0xba4058ab
  const Unknown80801708 = rsat.schema(0x80801708, {
    unknown0: rsat.nested(Unknown808019A5),
    unknown1: rsat.i8(),
  });

  // 80804629 @0x189ee40, size 0xf
  const Unknown80804629 = rsat.schema(0x80804629, {
    unknown0: rsat.repeat(rsat.nested(Unknown80801708), 5),
  });

  // 808043C6 @0x19e0770, size 0x24
  const Unknown808043C6 = rsat.schema(0x808043c6, {
    unknown0: rsat.repeat(rsat.u8(), 36),
  });

  // 8080405E @0x19c2468, size 0x8
  const Unknown8080405E = rsat.schema(0x8080405e, {
    unknown0: rsat.repeat(rsat.u8(), 8),
  });

  // 80801846 @0x191c258, size 0x50
  const Unknown80801846 = rsat.schema(0x80801846, {
    unknown0: rsat.optional(rsat.i16()),
    unknown1: rsat.optional(rsat.nested(Unknown8080176B)),
    unknown2: rsat.optional(rsat.u8()),
    unknown3: rsat.optional(rsat.nested(Unknown808043C6)),
    unknown4: rsat.optional(rsat.nested(Unknown8080405E)),
    unknown5: rsat.optional(rsat.nested(Unknown80804629)),
  });

  const SELF_CHECKSUM_ITEM = 0x11205aee;

  // 80801732 @0x1867690, size 0x80, headerChecksum 0x11205aee
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
    Unknown808047D8,
    Unknown80801807,
    Unknown80805AF2,
    Unknown80804712,
    Unknown8080192E,
    Unknown80804625,
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
    Unknown8080468C,
    Unknown808016D7,
    Unknown808046EE,
    Unknown80801927,
    Unknown808043BC,
    Unknown808018FE,
    Unknown80804422,
    Unknown80805B5D,
    Unknown80801805,
    Unknown808018DD,
    Unknown8080193C,
    Unknown8080176B,
    Unknown808047A7,
    Unknown808017B4,
    Unknown80801755,
    Unknown808017E8,
    Unknown808018FF,
    Unknown80801711,
    Unknown8080187A,
    Unknown80801829,
    Unknown80804671,
    Unknown808047CC,
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
    SelfCharacter,
    SELF_CHECKSUM_INVENTORY,
    SelfInventory,
    Unknown80801920,
    Unknown808019A5,
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
