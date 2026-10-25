// Client schemas, from the eboot's schema registry (scripts/rsat-descriptors.py
// dumps it): record address, PS4 size and checksum. Unnamed fields are
// unknownN, their member index in the record.

import { rsat } from "@blamnetwork/rsat";
import type { SelectCharacterSchemas } from "./select-character";
import type { SelfSchemas } from "./self";

// Schemas register by id when this runs, so only the build's loader calls it.
export function definePeerSchemas(
  selectCharacter: SelectCharacterSchemas,
  self: SelfSchemas
) {
  const { Unknown808016EE } = selectCharacter;
  const {
    Unknown80804677,
    Unknown808017DB,
    Unknown808017F4,
    Unknown808018F8,
    Unknown808046FA,
  } = self;
  // Header checksum: +8 of the schema's record.
  const PEER_CHECKSUM_PRIMARY = 0xe6f9acaf;

  // 808018F6 @0x23c64c0, size 0x40, headerChecksum 0xe6f9acaf
  const PeerPrimary = rsat.schema(0x808018f6, {
    soid: rsat.optional(rsat.u64()),
    characterSoid: rsat.optional(rsat.u64()),
    unknown2: rsat.optional(rsat.nested(Unknown80804677)),
    unknown3: rsat.optional(rsat.nested(Unknown808046FA)),
  });

  const PEER_CHECKSUM_CHARACTER = 0x71cfe44b;

  // 808017D9 @0x2195ff0, size 0x7b0, headerChecksum 0x71cfe44b
  const PeerCharacter = rsat.schema(0x808017d9, {
    soid: rsat.optional(rsat.u64()),
    unknown1: rsat.optional(rsat.nested(Unknown808017DB)),
    unknown2: rsat.optional(rsat.nested(Unknown808017F4)),
    unknown3: rsat.optional(rsat.nested(Unknown808016EE)),
    unknown4: rsat.optional(rsat.nested(Unknown808018F8)),
  });

  return {
    PEER_CHECKSUM_PRIMARY,
    PeerPrimary,
    PEER_CHECKSUM_CHARACTER,
    PeerCharacter,
  };
}

type PeerSchemas = ReturnType<typeof definePeerSchemas>;

export type PeerPrimaryValue = rsat.Infer<PeerSchemas["PeerPrimary"]>;
export type PeerCharacterValue = rsat.Infer<PeerSchemas["PeerCharacter"]>;
