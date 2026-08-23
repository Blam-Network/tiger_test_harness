import { rsat } from "@blamnetwork/rsat";

/** 808017CC — roster type-0. */
export const RosterPrimary = rsat.schema(0x808017cc, {
  soid: rsat.optional(rsat.u64()),
  unk1: rsat.optional(rsat.u64()),
  unk2: rsat.optional(rsat.rawBytes()),
});
