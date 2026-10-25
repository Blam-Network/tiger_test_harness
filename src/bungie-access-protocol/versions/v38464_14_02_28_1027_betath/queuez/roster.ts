// Client schemas, from the eboot's schema registry (scripts/rsat-descriptors.py
// dumps it): record address, PS4 size and checksum. Unnamed fields are
// unknownN, their member index in the record.

import { rsat } from "@blamnetwork/rsat";
import type { SelfSchemas } from "./self";

// Schemas register by id when this runs, so only the build's loader calls it.
export function defineRosterSchemas(self: SelfSchemas) {
  const { Unknown80804677, Unknown808016D7, Unknown8080182A, Unknown808046FA } =
    self;
  // Header checksum: +8 of the schema's record.
  const ROSTER_CHECKSUM_PRIMARY = 0xc17f7c5b;

  // 8080188A @0x23133f0, size 0x40, headerChecksum 0xc17f7c5b
  const RosterPrimary = rsat.schema(0x8080188a, {
    soid: rsat.optional(rsat.u64()),
    characterSoid: rsat.optional(rsat.u64()),
    unknown2: rsat.optional(rsat.nested(Unknown80804677)),
    unknown3: rsat.optional(rsat.nested(Unknown808046FA)),
  });

  const ROSTER_CHECKSUM_MEMBER = 0xe5a56896;

  // 808018F0 @0x23c11f0, size 0x30, headerChecksum 0xe5a56896
  const RosterMember = rsat.schema(0x808018f0, {
    soid: rsat.optional(rsat.u64()),
    unknown1: rsat.optional(rsat.i16()),
    unknown2: rsat.optional(rsat.i8()),
    unknown3: rsat.optional(rsat.nested(Unknown808016D7)),
    unknown4: rsat.optional(rsat.nested(Unknown8080182A)),
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
