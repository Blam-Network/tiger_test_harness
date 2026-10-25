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
  const { Unknown80801855 } = selectCharacter;
  const {
    Unknown8080468C,
    Unknown808017FC,
    Unknown8080181A,
    Unknown80801923,
    Unknown80804712,
  } = self;
  // Header checksum: +8 of the schema's record.
  const PEER_CHECKSUM_PRIMARY = 0xe6f9acaf;

  // 80801921 @0x245ae40, size 0x40, headerChecksum 0xe6f9acaf
  const PeerPrimary = rsat.schema(0x80801921, {
    soid: rsat.optional(rsat.u64()),
    characterSoid: rsat.optional(rsat.u64()),
    unknown2: rsat.optional(rsat.nested(Unknown8080468C)),
    unknown3: rsat.optional(rsat.nested(Unknown80804712)),
  });

  const PEER_CHECKSUM_CHARACTER = 0x734c48f4;

  // 808017FD @0x2219e90, size 0x7b0, headerChecksum 0x734c48f4
  const PeerCharacter = rsat.schema(0x808017fd, {
    soid: rsat.optional(rsat.u64()),
    unknown1: rsat.optional(rsat.nested(Unknown808017FC)),
    unknown2: rsat.optional(rsat.nested(Unknown8080181A)),
    unknown3: rsat.optional(rsat.nested(Unknown80801855)),
    unknown4: rsat.optional(rsat.nested(Unknown80801923)),
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
