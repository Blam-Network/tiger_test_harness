// Client schemas, from the eboot's schema registry (scripts/rsat-descriptors.py
// dumps it): record address, PS4 size and checksum. Unnamed fields are
// unknownN, their member index in the record.

import { rsat } from "@blamnetwork/rsat";
import type { SelfSchemas } from "./self";

// Schemas register by id when this runs, so only the build's loader calls it.
export function defineSelectCharacterSchemas(self: SelfSchemas) {
  const {
    Unknown80804677,
    Unknown808017DB,
    Unknown808017F4,
    Unknown80801737,
    Unknown808018F8,
    Unknown80804613,
    Unknown808046FA,
  } = self;
  const SELECT_CHARACTER_CHECKSUM_PRIMARY = 0xf8a92b6c;

  // 80801927 @0x241e4d0, size 0x90, headerChecksum 0xf8a92b6c
  const SelectCharacterPrimary = rsat.schema(0x80801927, {
    soid: rsat.optional(rsat.u64()),
    roster: rsat.optional(rsat.nested(Unknown80804613)),
    unknown2: rsat.optional(rsat.nested(Unknown80804677)),
    unknown3: rsat.optional(rsat.nested(Unknown808046FA)),
  });

  // 80804343 @0x2312ac0, size 0x20
  const Unknown80804343 = rsat.schema(0x80804343, {
    unknown0: rsat.repeat(rsat.u32(), 8),
  });

  // 80801943 @0x2027aa0, size 0x24
  const Unknown80801943 = rsat.schema(0x80801943, {
    unknown0: rsat.optional(rsat.i8()),
    unknown1: rsat.optional(rsat.nested(Unknown80804343)),
  });

  // 808054BB @0x233b820, size 0xb4
  const Unknown808054BB = rsat.schema(0x808054bb, {
    unknown0: rsat.repeat(rsat.nested(Unknown80801943), 5),
  });

  // 808040CE @0x1fee1d0, size 0x80
  const Unknown808040CE = rsat.schema(0x808040ce, {
    unknown0: rsat.repeat(rsat.u32(), 32),
  });

  // 808016E4 @0x1ff5f30, size 0x4
  const Unknown808016E4 = rsat.schema(0x808016e4, {
    unknown0: rsat.optional(rsat.i8()),
    unknown1: rsat.optional(rsat.i16()),
  });

  // 808046A6 @0x21b04b0, size 0x18
  const Unknown808046A6 = rsat.schema(0x808046a6, {
    unknown0: rsat.repeat(rsat.nested(Unknown808016E4), 6),
  });

  // 80801815 @0x2202740, size 0x28
  const Unknown80801815 = rsat.schema(0x80801815, {
    unknown0: rsat.optional(rsat.u64()),
    unknown1: rsat.optional(rsat.i16()),
    unknown2: rsat.optional(rsat.i8()),
    unknown3: rsat.optional(rsat.i16()),
    unknown4: rsat.optional(rsat.nested(Unknown808046A6)),
  });

  // 808045D0 @0x2027c50, size 0x320
  const Unknown808045D0 = rsat.schema(0x808045d0, {
    unknown0: rsat.repeat(rsat.nested(Unknown80801815), 20),
  });

  // 808016FC @0x201f4e0, size 0x10
  const Unknown808016FC = rsat.schema(0x808016fc, {
    unknown0: rsat.optional(rsat.i16()),
    unknown1: rsat.optional(rsat.u64()),
  });

  // 8080475D @0x232b0e0, size 0x80
  const Unknown8080475D = rsat.schema(0x8080475d, {
    unknown0: rsat.repeat(rsat.nested(Unknown808016FC), 8),
  });

  // 808046C0 @0x21da6d0, size 0x34
  const Unknown808046C0 = rsat.schema(0x808046c0, {
    unknown0: rsat.optionsArray(rsat.i16(), 26),
  });

  // 808045BD @0x2005210, size 0x20
  const Unknown808045BD = rsat.schema(0x808045bd, {
    unknown0: rsat.optionsArray(rsat.i16(), 16),
  });

  // 808017C5 @0x2164580, size 0x8
  const Unknown808017C5 = rsat.schema(0x808017c5, {
    unknown0: rsat.optional(rsat.i8()),
    unknown1: rsat.optional(rsat.i32()),
  });

  // 808046E8 @0x2235610, size 0x80
  const Unknown808046E8 = rsat.schema(0x808046e8, {
    unknown0: rsat.repeat(rsat.nested(Unknown808017C5), 16),
  });

  // 808016EE @0x20040b0, size 0x770
  const Unknown808016EE = rsat.schema(0x808016ee, {
    unknown0: rsat.optional(rsat.i32()),
    unknown1: rsat.optional(rsat.nested(Unknown808054BB)),
    unknown2: rsat.optional(rsat.nested(Unknown808040CE)),
    unknown3: rsat.optional(rsat.nested(Unknown808045D0)),
    unknown4: rsat.optional(rsat.nested(Unknown8080475D)),
    unknown5: rsat.optional(rsat.nested(Unknown808046C0)),
    unknown6: rsat.optional(rsat.nested(Unknown808045BD)),
    unknown7: rsat.optional(rsat.nested(Unknown808045BD)),
    unknown8: rsat.optional(rsat.nested(Unknown808045BD)),
    unknown9: rsat.optional(rsat.nested(Unknown808046E8)),
    unknown10: rsat.optional(rsat.nested(Unknown808046E8)),
    unknown11: rsat.optional(rsat.nested(Unknown808046E8)),
    unknown12: rsat.optional(rsat.nested(Unknown808046E8)),
  });

  const SELECT_CHARACTER_CHECKSUM_CHARACTER = 0xf0f937db;

  // 80801912 @0x23f6160, size 0x7e8, headerChecksum 0xf0f937db
  const SelectCharacterCharacter = rsat.schema(0x80801912, {
    soid: rsat.optional(rsat.u64()),
    unknown1: rsat.optional(rsat.nested(Unknown808017DB)),
    unknown2: rsat.optional(rsat.nested(Unknown808017F4)),
    unknown3: rsat.optional(rsat.nested(Unknown80801737)),
    unknown4: rsat.optional(rsat.nested(Unknown808016EE)),
    unknown5: rsat.optional(rsat.nested(Unknown808018F8)),
  });

  return {
    SELECT_CHARACTER_CHECKSUM_PRIMARY,
    SelectCharacterPrimary,
    Unknown80804343,
    Unknown80801943,
    Unknown808054BB,
    Unknown808040CE,
    Unknown808016E4,
    Unknown808046A6,
    Unknown80801815,
    Unknown808045D0,
    Unknown808016FC,
    Unknown8080475D,
    Unknown808046C0,
    Unknown808045BD,
    Unknown808017C5,
    Unknown808046E8,
    Unknown808016EE,
    SELECT_CHARACTER_CHECKSUM_CHARACTER,
    SelectCharacterCharacter,
  };
}

export type SelectCharacterSchemas = ReturnType<
  typeof defineSelectCharacterSchemas
>;

export type SelectCharacterPrimaryValue = rsat.Infer<
  SelectCharacterSchemas["SelectCharacterPrimary"]
>;
export type SelectCharacterCharacterValue = rsat.Infer<
  SelectCharacterSchemas["SelectCharacterCharacter"]
>;
