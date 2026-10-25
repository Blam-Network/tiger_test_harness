import { rsat } from "@blamnetwork/rsat";

export function defineRosterSchemas() {
  // 808017CC — roster type-0.
  const RosterPrimary = rsat.schema(0x808017cc, {
    soid: rsat.optional(rsat.u64()),
    unk1: rsat.optional(rsat.u64()),
    unk2: rsat.optional(rsat.rawBytes()),
  });
  return { RosterPrimary };
}
