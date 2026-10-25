import { BitReader, BitWriter } from "@blamnetwork/rsat";
import {
  type HostHardWipe,
  MEMBERSHIP_SLOT_COUNT,
  type PahRow,
  type ParsedMembership,
  type Teleport,
} from "../../rsat/membership";
import type { MembershipWire } from "../activity-host-build";
import type { AhSchemas } from "./ah";

function pahRow(row: PahRow) {
  return {
    regionId: row.regionId,
    unk1: 0,
    ambassador: {
      revokeToken: row.ambassador.revokeToken,
      opcode: row.ambassador.opcode,
      slot: row.ambassador.slot,
      flag: row.ambassador.flag,
    },
    peerMask: row.peerMask,
    public: {
      unk0: 0,
      sessionLock: 0,
      peerSlots: { markers: row.markers },
      advertised: {
        session: { bytes: Buffer.alloc(8) },
        pad: { bytes: Buffer.alloc(36) },
        activityHost: { bytes: Buffer.alloc(16) },
      },
      activityHostId: 0n,
    },
  };
}

// The host's hard wipe (808044CB): idle, all zero, when none is given.
function hardWipeNest(hardWipe: HostHardWipe | undefined) {
  if (hardWipe === undefined) {
    return { cookie: 0, completedCookie: 0, state: 0 };
  }
  if (hardWipe.completedCookie === undefined) {
    throw new Error("the alpha's hard wipe has a completed cookie");
  }
  return {
    cookie: hardWipe.cookie,
    completedCookie: hardWipe.completedCookie,
    state: hardWipe.state,
  };
}

function targetValue(target: Teleport | undefined) {
  return target
    ? { a: target.id, b: target.region, c: target.transition >>> 0, d: 0 }
    : { a: 0, b: 0, c: 0, d: 0 };
}

// The host's teleportation (808044D2): active while it runs, the target it
// runs to, and the last one it finished. A client starts one whenever the
// target's id differs from its own; once the host has finished, the last
// target equals the target. The peer mask (d) stays 0: with none set the
// client's synchronise task waits on nobody.
function teleportNest(teleport: Teleport | undefined) {
  const running = teleport?.state === 1 || teleport?.state === 2;
  return {
    a: running ? 1 : 0,
    left: targetValue(running ? undefined : teleport),
    right: targetValue(teleport),
  };
}

export function createMembershipWire(ah: AhSchemas): MembershipWire {
  type Slot = ReturnType<AhSchemas["MembershipSlot"]["decode"]>;
  return {
    // A slot carries the member's identity and a bool, not its client data.
    echoesClientData: false,
    privateActivityRows: false,

    // 808044E0: {generation, unk, 20 slots, PAH regions} and four 20-bit
    // masks: the occupied slots twice, then nothing, then no replication.
    encode(values) {
      const slots = Array.from(
        { length: MEMBERSHIP_SLOT_COUNT },
        (): Slot => ({ identity: undefined, auth: undefined })
      );
      for (const member of values.members) {
        slots[member.slot] = {
          identity: {
            machine: member.identity.machine,
            player: member.identity.player,
            account: member.identity.account,
            character: member.identity.character,
          },
          auth: undefined,
        };
      }
      const bw = new BitWriter();
      bw.writeBit(1);
      ah.ReplicateMembership.encode(bw, {
        generation: values.generation,
        unk: values.generation,
        clients: { slots },
        pahRegions: {
          table: { rows: values.rows.map(pahRow) },
          hardWipe: hardWipeNest(values.hardWipe),
          unknown1: teleportNest(values.teleport),
        },
        occupiedMask: values.occupiedMask,
        machineMask: values.occupiedMask,
        unkMask: undefined,
        replicateMask: 0,
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
          slots: m.clients.slots.map((slot) => ({
            identity: slot.identity && {
              machine: Buffer.from(slot.identity.machine),
              player: Buffer.from(slot.identity.player),
              account: slot.identity.account,
              character: slot.identity.character,
            },
            auth: slot.auth,
          })),
        },
        pahRegions: m.pahRegions && {
          table: {
            rows: m.pahRegions.table.rows.map((row) => ({
              regionId: row.regionId,
              ambassador: row.ambassador,
              peerMask: row.peerMask,
              public: {
                activityHostId: row.public.activityHostId,
                peerSlots: {
                  markers: Buffer.from(row.public.peerSlots.markers),
                },
              },
            })),
          },
        },
        occupiedMask: m.occupiedMask,
        machineMask: m.machineMask,
        unknownMask: m.unkMask,
      };
    },
  };
}
