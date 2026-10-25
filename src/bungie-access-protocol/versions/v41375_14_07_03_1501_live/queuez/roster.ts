// Client schemas, from the .schmr table. Unnamed fields are unknownN,
// their member index in the record.

import { rsat } from "@blamnetwork/rsat";
import type { SelfSchemas } from "./self";

// Schemas register by id when this runs, so only the build's loader calls it.
export function defineRosterSchemas(self: SelfSchemas) {
  const { Unknown80805AF2, Unknown808016F8, Unknown808018DB, Unknown80804712 } =
    self;
  // Header checksum: pinned by the family's slot table (sub_82780688). Matches
  // the 2.3.1 capture.
  const ROSTER_CHECKSUM_PRIMARY = 0x3e3ace74;

  // 808018B7 @0x822ae988, size 0x50, headerChecksum 0x3e3ace74
  const RosterPrimary = rsat.schema(0x808018b7, {
    soid: rsat.optional(rsat.u64()),
    characterSoid: rsat.optional(rsat.u64()),
    unknown2: rsat.optional(rsat.nested(Unknown80805AF2)),
    unknown3: rsat.optional(rsat.nested(Unknown80804712)),
  });

  const ROSTER_CHECKSUM_MEMBER = 0x3c0fe770;

  // 80801810 @0x82205c2c, size 0x30, headerChecksum 0x3c0fe770
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
