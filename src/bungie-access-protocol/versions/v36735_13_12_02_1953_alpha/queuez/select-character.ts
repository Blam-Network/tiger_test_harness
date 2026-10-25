import { rsat } from "@blamnetwork/rsat";
import type { SharedSchemas } from "./shared";

export function defineSelectCharacterSchemas(
  deps: Pick<
    SharedSchemas,
    "AppearanceEc" | "AppearanceF0" | "Unknown808019CF" | "Unknown808019E1"
  >
) {
  const { AppearanceEc, AppearanceF0, Unknown808019CF, Unknown808019E1 } = deps;

  // 808017C5 — select_character roster soid list.
  const SelectCharacterRoster = rsat.schema(0x808017c5, {
    soids: rsat.array(rsat.u64(), { lengthBits: 4, max: 10 }),
  });

  // 808017CF — select_character type-0.
  const SelectCharacterPrimary = rsat.schema(0x808017cf, {
    soid: rsat.optional(rsat.u64()),
    roster: rsat.optional(rsat.nested(SelectCharacterRoster)),
    unk2: rsat.optional(rsat.rawBytes()),
  });

  // 80801A00 — select_character type-1 character.
  const SelectCharacterCharacter = rsat.schema(0x80801a00, {
    soid: rsat.optional(rsat.u64()),
    appearanceEc: rsat.optional(rsat.nested(AppearanceEc)),
    appearanceF0: rsat.optional(rsat.nested(AppearanceF0)),
    progression: rsat.optional(rsat.nested(Unknown808019E1)),
    unknown4: rsat.optional(rsat.i32({ bias: 0x80000000 })),
    gear: rsat.optional(rsat.nested(Unknown808019CF)),
  });
  return {
    SelectCharacterRoster,
    SelectCharacterPrimary,
    SelectCharacterCharacter,
  };
}

export type SelectCharacterSchemas = ReturnType<
  typeof defineSelectCharacterSchemas
>;
