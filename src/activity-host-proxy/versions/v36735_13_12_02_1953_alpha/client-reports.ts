import { BitReader, decode } from "@blamnetwork/rsat";
import type {
  ClientAuthReport,
  ClientReportsWire,
  ClientTransition,
} from "../activity-host-build";
import type { AhSchemas } from "./ah";

type Auth = ReturnType<AhSchemas["ClientAuthoritativeData"]["decode"]>;

function clientTransition(
  t: NonNullable<Auth["transition"]>
): ClientTransition {
  const region = (r: typeof t.current) =>
    r && { regionId: r.regionId, unknown1: r.unknown1 };
  return {
    current: region(t.current),
    pending: region(t.pending),
    token: t.token,
    props: t.props,
    phase: t.phase,
  };
}

// The decoded report, or undefined for bytes that do not decode.
function tryDecode<T>(decode: () => T): T | undefined {
  try {
    return decode();
  } catch {
    return;
  }
}

// Class 21 client_authoritative_data_update (0x808044DA), delta framed: every
// optional member is a dirty bit and a body, dirty meaning changed since the
// last send. The transition nest is what the host needs for load zones: the
// pending region and the transition token. The slot in the membership does
// not carry the client's data back, so nothing is echoed.
export function createClientReportsWire(ah: AhSchemas): ClientReportsWire {
  return {
    describeIdentity: () => "",

    parse: (payload) =>
      tryDecode((): ClientAuthReport => {
        // Without the update bit nothing follows it.
        if (new BitReader(payload).readBit() !== 1) {
          return { anyUpdate: false };
        }
        const auth = decode(ah.ClientAuthoritativeData, payload);
        return {
          anyUpdate: auth.anyUpdate,
          hardWipe: auth.hardWipe && {
            currentCookie: auth.hardWipe.currentCookie,
            lastCookie: auth.hardWipe.lastCookie,
            startTime: auth.hardWipe.startTime,
            state: auth.hardWipe.state,
          },
          teleport: auth.teleport && {
            id: auth.teleport.target.a,
            region: auth.teleport.target.b,
            state: auth.teleport.unknown0,
          },
          transition: auth.transition && clientTransition(auth.transition),
        };
      }),
  };
}
