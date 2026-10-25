import { rsat } from "@blamnetwork/rsat";
import type { SharedSchemas } from "./shared";

export function defineInspectionSchemas(
  deps: Pick<
    SharedSchemas,
    | "AppearanceEc"
    | "AppearanceF0"
    | "Unknown80801C03"
    | "Unknown808017D3"
    | "Unknown808019CF"
  >
) {
  const {
    AppearanceEc,
    AppearanceF0,
    Unknown80801C03,
    Unknown808017D3,
    Unknown808019CF,
  } = deps;

  // 808017CB — inspection type-0.
  const InspectionPrimary = rsat.schema(0x808017cb, {
    soid: rsat.optional(rsat.u64()),
    characterSoid: rsat.u64(),
  });

  // 808019FE — inspection type-1 character.
  const InspectionCharacter = rsat.schema(0x808019fe, {
    soid: rsat.optional(rsat.u64()),
    unknown1: rsat.optional(rsat.nested(AppearanceEc)),
    unknown2: rsat.optional(rsat.nested(AppearanceF0)),
    unknown3: rsat.optional(rsat.nested(Unknown808017D3)),
    unknown4: rsat.optional(rsat.rawBytes()),
    unknown5: rsat.optional(rsat.nested(Unknown80801C03)),
    unknown6: rsat.optional(rsat.rawBytes()),
    unknown7: rsat.optional(rsat.rawBytes()),
    unknown8: rsat.optional(rsat.rawBytes()),
    unknown9: rsat.optional(rsat.rawBytes()),
    unknown10: rsat.optional(rsat.nested(Unknown808019CF)),
  });
  return { InspectionPrimary, InspectionCharacter };
}

type InspectionSchemas = ReturnType<typeof defineInspectionSchemas>;

export type InspectionCharacterValue = rsat.Infer<
  InspectionSchemas["InspectionCharacter"]
>;
