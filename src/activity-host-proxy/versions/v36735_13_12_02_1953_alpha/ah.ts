import { defineClientAuthSchemas } from "./schemas/client-auth";
import { defineJoinSchemas } from "./schemas/join";
import { defineMembershipSchemas } from "./schemas/membership";
import { defineMessageSchemas } from "./schemas/messages";
import { defineSensorSchemas } from "./schemas/sensor";

// Every schema of the alpha's activity host, from the .schmr table. Schemas
// register by id when this runs, so only the build's loader calls it.
export function defineAhSchemas() {
  const join = defineJoinSchemas();
  const messages = defineMessageSchemas();
  return {
    ...join,
    ...messages,
    ...defineClientAuthSchemas(),
    ...defineMembershipSchemas({ JoinIdentity: join.JoinIdentity }),
    ...defineSensorSchemas({ WorldHandles: messages.WorldHandles }),
  };
}

export type AhSchemas = ReturnType<typeof defineAhSchemas>;
