// Client schemas, from the eboot's schema registry (scripts/rsat-descriptors.py
// dumps it): record address, PS4 size and checksum. Unnamed fields are
// unknownN, their member index in the record.

import { rsat } from "@blamnetwork/rsat";
import type { SelfSchemas } from "./self";

// Schemas register by id when this runs, so only the build's loader calls it.
export function defineSelectCharacterSchemas(self: SelfSchemas) {
  const {
    Unknown8080468C,
    Unknown808017FC,
    Unknown8080181A,
    Unknown80801755,
    Unknown80801923,
    Unknown80804621,
    Unknown80804712,
  } = self;
  const SELECT_CHARACTER_CHECKSUM_PRIMARY = 0xf8a92b6c;

  // 80801951 @0x24ac3a0, size 0x90, headerChecksum 0xf8a92b6c
  const SelectCharacterPrimary = rsat.schema(0x80801951, {
    soid: rsat.optional(rsat.u64()),
    roster: rsat.optional(rsat.nested(Unknown80804621)),
    unknown2: rsat.optional(rsat.nested(Unknown8080468C)),
    unknown3: rsat.optional(rsat.nested(Unknown80804712)),
  });

  // 80804345 @0x23a27b0, size 0x20
  const Unknown80804345 = rsat.schema(0x80804345, {
    unknown0: rsat.repeat(rsat.u32(), 8),
  });

  // 8080196C @0x20a27a0, size 0x24
  const Unknown8080196C = rsat.schema(0x8080196c, {
    unknown0: rsat.optional(rsat.i8()),
    unknown1: rsat.optional(rsat.nested(Unknown80804345)),
  });

  // 80805513 @0x23cf6a0, size 0xb4
  const Unknown80805513 = rsat.schema(0x80805513, {
    unknown0: rsat.repeat(rsat.nested(Unknown8080196C), 5),
  });

  // 808040D1 @0x206bc80, size 0x80
  const Unknown808040D1 = rsat.schema(0x808040d1, {
    unknown0: rsat.repeat(rsat.u32(), 32),
  });

  // 80801704 @0x20751b0, size 0x4
  const Unknown80801704 = rsat.schema(0x80801704, {
    unknown0: rsat.optional(rsat.i8()),
    unknown1: rsat.optional(rsat.i16()),
  });

  // 808046BC @0x22311f0, size 0x18
  const Unknown808046BC = rsat.schema(0x808046bc, {
    unknown0: rsat.repeat(rsat.nested(Unknown80801704), 6),
  });

  // 8080183C @0x2290cb0, size 0x28
  const Unknown8080183C = rsat.schema(0x8080183c, {
    unknown0: rsat.optional(rsat.u64()),
    unknown1: rsat.optional(rsat.i16()),
    unknown2: rsat.optional(rsat.i8()),
    unknown3: rsat.optional(rsat.i16()),
    unknown4: rsat.optional(rsat.nested(Unknown808046BC)),
  });

  // 808045D9 @0x20a2950, size 0x320
  const Unknown808045D9 = rsat.schema(0x808045d9, {
    unknown0: rsat.repeat(rsat.nested(Unknown8080183C), 20),
  });

  // 80801889 @0x2338fb0, size 0x10
  const Unknown80801889 = rsat.schema(0x80801889, {
    unknown0: rsat.optional(rsat.i8()),

    unknown1: rsat.optional(rsat.u64()),
  });

  // 808045AD @0x206b540, size 0x80
  const Unknown808045AD = rsat.schema(0x808045ad, {
    unknown0: rsat.repeat(rsat.nested(Unknown80801889), 8),
  });

  // 808046D7 @0x226a940, size 0x34
  const Unknown808046D7 = rsat.schema(0x808046d7, {
    unknown0: rsat.optionsArray(rsat.i16(), 26),
  });

  // 808045C4 @0x20828d0, size 0x20
  const Unknown808045C4 = rsat.schema(0x808045c4, {
    unknown0: rsat.optionsArray(rsat.i16(), 16),
  });

  // 808017E3 @0x21e0ef0, size 0x8
  const Unknown808017E3 = rsat.schema(0x808017e3, {
    unknown0: rsat.optional(rsat.i8()),
    unknown1: rsat.optional(rsat.i32()),
  });

  // 80804703 @0x22c6dc0, size 0x80
  const Unknown80804703 = rsat.schema(0x80804703, {
    unknown0: rsat.repeat(rsat.nested(Unknown808017E3), 16),
  });

  // 80801855 @0x22bd110, size 0x770
  const Unknown80801855 = rsat.schema(0x80801855, {
    unknown0: rsat.optional(rsat.i32()),
    unknown1: rsat.optional(rsat.nested(Unknown80805513)),
    unknown2: rsat.optional(rsat.nested(Unknown808040D1)),
    unknown3: rsat.optional(rsat.nested(Unknown808045D9)),
    unknown4: rsat.optional(rsat.nested(Unknown808045AD)),
    unknown5: rsat.optional(rsat.nested(Unknown808046D7)),
    unknown6: rsat.optional(rsat.nested(Unknown808045C4)),
    unknown7: rsat.optional(rsat.nested(Unknown808045C4)),
    unknown8: rsat.optional(rsat.nested(Unknown808045C4)),
    unknown9: rsat.optional(rsat.nested(Unknown80804703)),
    unknown10: rsat.optional(rsat.nested(Unknown80804703)),
    unknown11: rsat.optional(rsat.nested(Unknown80804703)),
    unknown12: rsat.optional(rsat.nested(Unknown80804703)),
  });

  const SELECT_CHARACTER_CHECKSUM_CHARACTER = 0xf94f449d;

  // 80801954 @0x24ae570, size 0x7e8, headerChecksum 0xf94f449d
  const SelectCharacterCharacter = rsat.schema(0x80801954, {
    soid: rsat.optional(rsat.u64()),
    unknown1: rsat.optional(rsat.nested(Unknown808017FC)),
    unknown2: rsat.optional(rsat.nested(Unknown8080181A)),
    unknown3: rsat.optional(rsat.nested(Unknown80801755)),
    unknown4: rsat.optional(rsat.nested(Unknown80801855)),
    unknown5: rsat.optional(rsat.nested(Unknown80801923)),
  });

  return {
    SELECT_CHARACTER_CHECKSUM_PRIMARY,
    SelectCharacterPrimary,
    Unknown80804345,
    Unknown8080196C,
    Unknown80805513,
    Unknown808040D1,
    Unknown80801704,
    Unknown808046BC,
    Unknown8080183C,
    Unknown808045D9,
    Unknown80801889,
    Unknown808045AD,
    Unknown808046D7,
    Unknown808045C4,
    Unknown808017E3,
    Unknown80804703,
    Unknown80801855,
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
