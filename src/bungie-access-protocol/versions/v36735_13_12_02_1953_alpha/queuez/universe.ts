import { rsat } from "@blamnetwork/rsat";
import type { SharedSchemas } from "./shared";

export function defineUniverseSchemas(
  deps: Pick<SharedSchemas, "Unknown80801768">
) {
  const { Unknown80801768 } = deps;
  // Type-0 reuses server_object (808018D0).

  const Unknown80801BE4 = rsat.schema(0x80801be4, {
    unknown0: rsat.repeat(rsat.i16(), 20),
  });

  const Unknown808018CD = rsat.schema(0x808018cd, {
    unknown0: rsat.array(rsat.nested(Unknown80801BE4), {
      lengthBits: 5,
      max: 31,
    }),
  });

  const Unknown808018CE = rsat.schema(0x808018ce, {
    unknown0: rsat.array(rsat.nested(Unknown80801768), {
      lengthBits: 5,
      max: 20,
    }),
  });

  const Unknown80801BE5 = rsat.schema(0x80801be5, {
    unknown0: rsat.repeat(rsat.nested(Unknown80801768), 20),
  });
  return { Unknown80801BE4, Unknown808018CD, Unknown808018CE, Unknown80801BE5 };
}
