import { BitReader } from "@blamnetwork/rsat";
import type {
  ClientAuthReport,
  ClientReportsWire,
  ClientTransition,
} from "../activity-host-build";
import type { AhSchemas } from "./ah";

type Transition = NonNullable<
  ReturnType<AhSchemas["ClientAuthoritativeData"]["decode"]>["transition"]
>;

function clientRegion(region: Transition["unknown0"]) {
  return region && { regionId: region.unknown0, unknown1: region.unknown1 };
}

function clientTransition(
  t: Transition | undefined
): ClientTransition | undefined {
  if (!t) {
    return;
  }
  return {
    current: clientRegion(t.unknown0),
    pending: clientRegion(t.unknown1),
    token: t.unknown2,
    props: t.unknown3,
    phase: t.unknown4,
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

// Class 21 client_authoritative_data_update: 80800C56 behind a leading "any
// update" bit. Its region 80800D82 is {regionId i32, u32, i32, i8:2, i8:2, opt
// u8, opt citizen}, its teleportation {state, {id, region, spawn transition},
// i32}, its hard wipe 80800C21 {state, current cookie, start time}: no last
// cookie, unlike the alpha's.
export function createClientReportsWire(ah: AhSchemas): ClientReportsWire {
  return {
    parse: (payload) =>
      tryDecode((): ClientAuthReport => {
        const br = new BitReader(payload);
        const anyUpdate = br.readBit() === 1;
        if (!anyUpdate) {
          return { anyUpdate };
        }
        const auth = ah.ClientAuthoritativeData.decode(br);
        return {
          anyUpdate,
          echo: {
            identity: auth.identity,
            teleport: auth.teleport,
            transition: auth.transition,
          },
          hardWipe: auth.hardWipe && {
            currentCookie: auth.hardWipe.unknown1,
            startTime: auth.hardWipe.unknown2,
            state: auth.hardWipe.unknown0,
          },
          teleport: auth.teleport && {
            id: auth.teleport.unknown1.unknown0,
            region: auth.teleport.unknown1.unknown1,
            state: auth.teleport.unknown0,
          },
          transition: clientTransition(auth.transition),
        };
      }),

    describeIdentity(identity) {
      const { unknown2, unknown5 } = identity as {
        unknown2?: bigint;
        unknown5?: bigint;
      };
      return `unknown2=0x${(unknown2 ?? 0n).toString(16)} unknown5=0x${(unknown5 ?? 0n).toString(16)}`;
    },
  };
}
