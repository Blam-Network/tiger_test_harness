import { rsat } from "@blamnetwork/rsat";
import { Unknown80801768 } from "../shared";

/** Type-0 reuses server_object (808018D0). */
export { ServerObject } from "../../rsat/schemas/messages";

export const Unknown80801BE4 = rsat.schema(0x80801be4, {
  unknown0: rsat.repeat(rsat.i16(), 20),
});

export const Unknown808018CD = rsat.schema(0x808018cd, {
  unknown0: rsat.array(rsat.nested(Unknown80801BE4), {
    lengthBits: 5,
    max: 31,
  }),
});

export const Unknown808018CE = rsat.schema(0x808018ce, {
  unknown0: rsat.array(rsat.nested(Unknown80801768), {
    lengthBits: 5,
    max: 20,
  }),
});

export const Unknown80801BE5 = rsat.schema(0x80801be5, {
  unknown0: rsat.repeat(rsat.nested(Unknown80801768), 20),
});
