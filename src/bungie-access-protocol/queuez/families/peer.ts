import { rsat } from "@blamnetwork/rsat";
import { AppearanceEc, AppearanceF0, Unknown808019CF } from "../shared";

/** 808017CA — peer type-0. */
export const PeerPrimary = rsat.schema(0x808017ca, {
  soid: rsat.optional(rsat.u64()),
  characterSoid: rsat.u64(),
  unk2: rsat.optional(rsat.rawBytes()),
});

/** 808019FD — peer type-1 character. */
export const PeerCharacter = rsat.schema(0x808019fd, {
  soid: rsat.optional(rsat.u64()),
  unknown1: rsat.optional(rsat.nested(AppearanceEc)),
  unknown2: rsat.optional(rsat.nested(AppearanceF0)),
  unknown3: rsat.optional(rsat.nested(Unknown808019CF)),
});

export type PeerCharacterValue = rsat.Infer<typeof PeerCharacter>;
