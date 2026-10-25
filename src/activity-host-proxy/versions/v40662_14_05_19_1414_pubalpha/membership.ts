import { BitReader, BitWriter } from "@blamnetwork/rsat";
import type { AhClientIdentity } from "../../join";
import {
  type HostHardWipe,
  MEMBERSHIP_SLOT_COUNT,
  type PahRow,
  type ParsedMembership,
  type Teleport,
} from "../../rsat/membership";
import type { MembershipWire } from "../activity-host-build";
import type { AhSchemas } from "./ah";

function joinIdentity(identity: AhClientIdentity) {
  return {
    machine: { bytes: [...identity.machine] },
    player: { bytes: [...identity.player] },
    account: identity.account,
    character: identity.character,
    unknown4: identity.identityUnknown4 ?? 0n,
  };
}

// The PAH block 80800BD7 for the rows: row 80800C6F is regionId / unknown1 /
// ambassador 80800E4A / peerMask / public 80800C9F, whose peer slot marker
// bytes are followed by an empty byte array. The two trailing nests
// 80800C93 / 80800BF9 are the host's hard wipe {cookie, state, an i32 the
// client never reads} and its teleportation, the optional machine absent.
function pahRegionsValue(
  rows: readonly PahRow[],
  teleport?: Teleport,
  hardWipe?: HostHardWipe
) {
  return {
    unknown0: {
      unknown0: rows.map((row) => ({
        unknown0: row.regionId,
        unknown1: 0,
        unknown2: {
          unknown0: row.ambassador.revokeToken,
          unknown1: row.ambassador.opcode,
          unknown2: row.ambassador.slot,
          unknown3: row.ambassador.flag,
        },
        unknown3: row.peerMask,
        unknown4: {
          unknown0: 0,
          unknown1: 0,
          unknown2: { unknown0: [...row.markers] },
          unknown3: { unknown0: [] },
          unknown4: 0n,
        },
      })),
    },
    unknown1: {
      unknown0: hardWipe?.cookie ?? 0,
      unknown1: hardWipe?.state ?? 0,
      unknown2: 0,
    },
    unknown2: {
      unknown0: teleport?.state ?? 0,
      unknown1: {
        unknown0: teleport?.id ?? 0,
        unknown1: teleport?.region ?? 0,
        unknown2: (teleport?.transition ?? 0) >>> 0,
      },
    },
    unknown3: undefined,
  };
}

export function createMembershipWire(ah: AhSchemas): MembershipWire {
  type Slot = ReturnType<AhSchemas["MembershipSlot"]["decode"]>;
  return {
    echoesClientData: true,
    privateActivityRows: true,

    // 808009ED: {generation, unk, 20 slots, PAH regions} and three 20-bit
    // masks: the first two carry the occupied slots, the third is 0.
    encode(values) {
      const slots = Array.from(
        { length: MEMBERSHIP_SLOT_COUNT },
        (): Slot => ({
          identity: undefined,
          auth: undefined,
          unknown2: undefined,
        })
      );
      for (const member of values.members) {
        const echoed =
          member.clientAuth ?? member.clientTransition ?? member.clientTeleport;
        slots[member.slot] = {
          identity: joinIdentity(member.identity),
          auth:
            echoed &&
            ({
              identity: member.clientAuth,
              transition: member.clientTransition,
              hardWipe: undefined,
              teleport: member.clientTeleport,
            } as Slot["auth"]),
          unknown2: undefined,
        };
      }
      const bw = new BitWriter();
      bw.writeBit(1);
      ah.ReplicateMembership.encode(bw, {
        generation: values.generation,
        unk: values.generation,
        clients: { unknown0: slots },
        pahRegions: pahRegionsValue(
          values.rows,
          values.teleport,
          values.hardWipe
        ),
        unknown4: values.occupiedMask,
        unknown5: values.occupiedMask,
        unknown6: 0,
      });
      return bw.finish();
    },

    decode(payload): ParsedMembership | null {
      const br = new BitReader(payload);
      if (!br.readBit()) {
        return null;
      }
      const m = ah.ReplicateMembership.decode(br);
      return {
        generation: m.generation,
        unk: m.unk,
        clients: {
          slots: m.clients.unknown0.map((slot) => ({
            identity: slot.identity && {
              machine: Buffer.from(slot.identity.machine.bytes),
              player: Buffer.from(slot.identity.player.bytes),
              account: slot.identity.account,
              character: slot.identity.character,
            },
            auth: slot.auth,
          })),
        },
        pahRegions: m.pahRegions && {
          table: {
            rows: m.pahRegions.unknown0.unknown0.map((row) => ({
              regionId: row.unknown0,
              ambassador: {
                revokeToken: row.unknown2.unknown0,
                opcode: row.unknown2.unknown1,
                slot: row.unknown2.unknown2,
                flag: row.unknown2.unknown3,
              },
              peerMask: row.unknown3,
              public: {
                activityHostId: row.unknown4.unknown4,
                peerSlots: {
                  markers: Buffer.from(row.unknown4.unknown2.unknown0),
                },
              },
            })),
          },
        },
        occupiedMask: m.unknown4,
        machineMask: m.unknown5,
        unknownMask: m.unknown6,
      };
    },
  };
}
