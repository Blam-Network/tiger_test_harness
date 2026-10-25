// Client schemas, from the eboot's schema registry (scripts/rsat-descriptors.py
// dumps it): record address, PS4 size and checksum. Unnamed fields are
// unknownN, their member index in the record.

import { rsat } from "@blamnetwork/rsat";
import type { SelectCharacterSchemas } from "./select-character";
import type { SelfSchemas } from "./self";

// Schemas register by id when this runs, so only the build's loader calls it.
export function defineInspectionSchemas(
  selectCharacter: SelectCharacterSchemas,
  self: SelfSchemas
) {
  const { Unknown80801855 } = selectCharacter;
  const {
    Unknown808016E0,
    Unknown808017FC,
    Unknown808045DA,
    Unknown808047A7,
    Unknown8080181A,
    Unknown8080472C,
    Unknown80801724,
    Unknown80801923,
    Unknown8080469B,
  } = self;
  // Header checksum: +8 of the schema's record.
  const INSPECTION_CHECKSUM_PRIMARY = 0xe56d2ea1;

  // 8080191C @0x2454a30, size 0x10, headerChecksum 0xe56d2ea1
  const InspectionPrimary = rsat.schema(0x8080191c, {
    soid: rsat.optional(rsat.u64()),
    characterSoid: rsat.u64(),
  });

  // 808046FE @0x22bed60, size 0x1e0
  const Unknown808046FE = rsat.schema(0x808046fe, {
    unknown0: rsat.repeat(rsat.nested(Unknown808016E0), 20),
  });

  // 808047B7 @0x24377f0, size 0x1e8
  const Unknown808047B7 = rsat.schema(0x808047b7, {
    unknown0: rsat.optional(rsat.i32()),
    unknown1: rsat.optional(rsat.nested(Unknown808046FE)),
  });

  const INSPECTION_CHECKSUM_CHARACTER = 0x54c65304;

  // 808017A5 @0x218c3c0, size 0x18b8, headerChecksum 0x54c65304
  const InspectionCharacter = rsat.schema(0x808017a5, {
    soid: rsat.optional(rsat.u64()),
    unknown1: rsat.optional(rsat.nested(Unknown808017FC)),
    unknown2: rsat.optional(rsat.nested(Unknown8080181A)),
    unknown3: rsat.optional(rsat.nested(Unknown808047A7)),
    unknown4: rsat.optional(rsat.nested(Unknown808047B7)),
    unknown5: rsat.optional(rsat.nested(Unknown808045DA)),
    unknown6: rsat.optional(rsat.nested(Unknown8080469B)),
    unknown7: rsat.optional(rsat.nested(Unknown8080472C)),
    unknown8: rsat.optional(rsat.nested(Unknown8080472C)),
    unknown9: rsat.optional(rsat.nested(Unknown80801724)),
    unknown10: rsat.optional(rsat.nested(Unknown80801855)),
    unknown11: rsat.optional(rsat.nested(Unknown80801923)),
  });

  return {
    INSPECTION_CHECKSUM_PRIMARY,
    InspectionPrimary,
    Unknown808046FE,
    Unknown808047B7,
    INSPECTION_CHECKSUM_CHARACTER,
    InspectionCharacter,
  };
}

type InspectionSchemas = ReturnType<typeof defineInspectionSchemas>;

export type InspectionPrimaryValue = rsat.Infer<
  InspectionSchemas["InspectionPrimary"]
>;
export type InspectionCharacterValue = rsat.Infer<
  InspectionSchemas["InspectionCharacter"]
>;
