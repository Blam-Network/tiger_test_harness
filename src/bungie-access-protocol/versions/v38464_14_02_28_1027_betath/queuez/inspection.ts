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
  const { Unknown808016EE } = selectCharacter;
  const {
    Unknown808016C0,
    Unknown808017DB,
    Unknown808045D1,
    Unknown80804787,
    Unknown808017F4,
    Unknown80804714,
    Unknown80801708,
    Unknown808018F8,
    Unknown80804685,
  } = self;
  // Header checksum: +8 of the schema's record.
  const INSPECTION_CHECKSUM_PRIMARY = 0xe56d2ea1;

  // 808018EF @0x23c0030, size 0x10, headerChecksum 0xe56d2ea1
  const InspectionPrimary = rsat.schema(0x808018ef, {
    soid: rsat.optional(rsat.u64()),
    characterSoid: rsat.u64(),
  });

  // 808046E5 @0x222dcc0, size 0x1e0
  const Unknown808046E5 = rsat.schema(0x808046e5, {
    unknown0: rsat.repeat(rsat.nested(Unknown808016C0), 20),
  });

  // 80804795 @0x23a0660, size 0x1e8
  const Unknown80804795 = rsat.schema(0x80804795, {
    unknown0: rsat.optional(rsat.i32()),
    unknown1: rsat.optional(rsat.nested(Unknown808046E5)),
  });

  const INSPECTION_CHECKSUM_CHARACTER = 0xb1a67206;

  // 80801866 @0x22c3430, size 0x18b8, headerChecksum 0xb1a67206
  const InspectionCharacter = rsat.schema(0x80801866, {
    soid: rsat.optional(rsat.u64()),
    unknown1: rsat.optional(rsat.nested(Unknown808017DB)),
    unknown2: rsat.optional(rsat.nested(Unknown808017F4)),
    unknown3: rsat.optional(rsat.nested(Unknown80804787)),
    unknown4: rsat.optional(rsat.nested(Unknown80804795)),
    unknown5: rsat.optional(rsat.nested(Unknown808045D1)),
    unknown6: rsat.optional(rsat.nested(Unknown80804685)),
    unknown7: rsat.optional(rsat.nested(Unknown80804714)),
    unknown8: rsat.optional(rsat.nested(Unknown80804714)),
    unknown9: rsat.optional(rsat.nested(Unknown80801708)),
    unknown10: rsat.optional(rsat.nested(Unknown808016EE)),
    unknown11: rsat.optional(rsat.nested(Unknown808018F8)),
  });

  return {
    INSPECTION_CHECKSUM_PRIMARY,
    InspectionPrimary,
    Unknown808046E5,
    Unknown80804795,
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
