// Client schemas, from the eboot's schema registry (scripts/rsat-descriptors.py
// dumps it): record address, PS4 size and checksum. Unnamed fields are
// unknownN, their member index in the record.

import { rsat } from "@blamnetwork/rsat";
import type { SelfSchemas } from "./self";

// Schemas register by id when this runs, so only the build's loader calls it.
export function defineRosterSchemas(self: SelfSchemas) {
  const { Unknown80805AF2, Unknown808016F8, Unknown808018DB, Unknown80804712 } =
    self;
  // Header checksum: +8 of the schema's record.
  const ROSTER_CHECKSUM_PRIMARY = 0x3e3ace74;

  // 808018B7 @0x1906e88, size 0x50, headerChecksum 0x3e3ace74
  const RosterPrimary = rsat.schema(0x808018b7, {
    soid: rsat.optional(rsat.u64()),
    characterSoid: rsat.optional(rsat.u64()),
    unknown2: rsat.optional(rsat.nested(Unknown80805AF2)),
    unknown3: rsat.optional(rsat.nested(Unknown80804712)),
  });

  const ROSTER_CHECKSUM_MEMBER = 0x3c0fe770;

  // 80801810 @0x1877b50, size 0x30, headerChecksum 0x3c0fe770
  const RosterMember = rsat.schema(0x80801810, {
    soid: rsat.optional(rsat.u64()),
    unknown1: rsat.optional(rsat.i16()),
    unknown2: rsat.optional(rsat.i8()),
    unknown3: rsat.optional(rsat.nested(Unknown808016F8)),
    unknown4: rsat.optional(rsat.nested(Unknown808018DB)),
  });

  return {
    ROSTER_CHECKSUM_PRIMARY,
    RosterPrimary,
    ROSTER_CHECKSUM_MEMBER,
    RosterMember,
  };
}

type RosterSchemas = ReturnType<typeof defineRosterSchemas>;

export type RosterMemberValue = rsat.Infer<RosterSchemas["RosterMember"]>;
