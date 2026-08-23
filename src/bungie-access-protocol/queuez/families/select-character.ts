import { rsat } from "@blamnetwork/rsat";
import {
  AppearanceEc,
  AppearanceF0,
  Unknown808019CF,
  Unknown808019E1,
} from "../shared";

/** 808017C5 — select_character roster soid list. */
export const SelectCharacterRoster = rsat.schema(0x808017c5, {
  soids: rsat.array(rsat.u64(), { lengthBits: 4, max: 10 }),
});

/** 808017CF — select_character type-0. */
export const SelectCharacterPrimary = rsat.schema(0x808017cf, {
  soid: rsat.optional(rsat.u64()),
  roster: rsat.optional(rsat.nested(SelectCharacterRoster)),
  unk2: rsat.optional(rsat.rawBytes()),
});

/** 80801A00 — select_character type-1 character. */
export const SelectCharacterCharacter = rsat.schema(0x80801a00, {
  soid: rsat.optional(rsat.u64()),
  appearanceEc: rsat.optional(rsat.nested(AppearanceEc)),
  appearanceF0: rsat.optional(rsat.nested(AppearanceF0)),
  progression: rsat.optional(rsat.nested(Unknown808019E1)),
  unknown4: rsat.optional(rsat.i32({ bias: 0x80000000 })),
  gear: rsat.optional(rsat.nested(Unknown808019CF)),
});

export type SelectCharacterPrimaryValue = rsat.Infer<
  typeof SelectCharacterPrimary
>;
export type SelectCharacterCharacterValue = rsat.Infer<
  typeof SelectCharacterCharacter
>;
