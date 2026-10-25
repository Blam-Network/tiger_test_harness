// Client schemas, from the .schmr table. Unnamed fields are unknownN,
// their member index in the record.

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
    Unknown80804595,
  } = self;
  // Header checksum: pinned by the family's slot table (sub_82780688).
  const INSPECTION_CHECKSUM_PRIMARY = 0xc7b033bc;

  // 8080191C @0x8233932c, size 0x10, headerChecksum 0xc7b033bc
  const InspectionPrimary = rsat.schema(0x8080191c, {
    soid: rsat.optional(rsat.u64()),
    characterSoid: rsat.u64(),
  });

  // 808046FE @0x822cb30c, size 0x1e0
  const Unknown808046FE = rsat.schema(0x808046fe, {
    unknown0: rsat.repeat(rsat.nested(Unknown808016E0), 20),
  });

  // 808047B7 @0x822104a4, size 0x1e8
  const Unknown808047B7 = rsat.schema(0x808047b7, {
    unknown0: rsat.optional(rsat.i32()),
    unknown1: rsat.optional(rsat.nested(Unknown808046FE)),
  });

  const INSPECTION_CHECKSUM_CHARACTER = 0x75723741;

  // 808017A5 @0x822dba34, size 0x1778, headerChecksum 0x75723741
  const InspectionCharacter = rsat.schema(0x808017a5, {
    soid: rsat.optional(rsat.u64()),
    unknown1: rsat.optional(rsat.nested(Unknown808017FC)),
    unknown2: rsat.optional(rsat.nested(Unknown8080181A)),
    unknown3: rsat.optional(rsat.nested(Unknown808047A7)),
    unknown4: rsat.optional(rsat.nested(Unknown808047B7)),
    unknown5: rsat.optional(rsat.nested(Unknown808045DA)),
    unknown6: rsat.optional(rsat.nested(Unknown80804595)),
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
