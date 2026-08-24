import { BitReader, BitWriter, decode, encode } from "@blamnetwork/rsat";
import type { AhClientIdentity } from "../../join";
import {
  MEMBERSHIP_SLOT_COUNT,
  ReplicateMembership,
} from "../schemas/membership";
import {
  BUBBLE_SLOTS,
  GlobalActivityState,
  WorldGlobalsState,
} from "../schemas/messages";

/**
 * Instantiation (ENUM 27) needs valid=1 and draining=0. Activity / slice
 * ids stay 0 until we read them off the client's start request.
 */

export interface GlobalActivityStateFields {
  activityChecksum?: number;
  activityId?: number;
  activityName?: string;
  bubbleCount?: number;
  familyChecksum?: number;
  initialBubble?: number;
  initialState?: number;
  instanceId: bigint;
}

/** see sub_83619DD0 */
export function packBubbleStateHandle(bubble: number, state = 0): number {
  return ((bubble & 0b0011_1111) << 3) | (state & 0b0000_0111);
}

function activityNameChars(name: string | undefined): number[] {
  const chars = new Array(256).fill(0);
  if (!name) {
    return chars;
  }
  for (let i = 0; i < name.length && i < 256; i++) {
    chars[i] = name.charCodeAt(i);
  }
  return chars;
}

export function buildGlobalActivityStateRsat(
  fields: bigint | GlobalActivityStateFields
): Buffer {
  const input = typeof fields === "bigint" ? { instanceId: fields } : fields;
  const bubbleCount = input.bubbleCount ?? 1;
  const states = Array.from({ length: BUBBLE_SLOTS }, (_, i) =>
    i < bubbleCount ? 0 : -1
  );
  return encode(GlobalActivityState, {
    valid: true,
    scenario: true,
    draining: false,
    instanceId: input.instanceId,
    bubbleCount,
    bubbleStates: { states },
    initialSlice: packBubbleStateHandle(
      input.initialBubble ?? 0,
      input.initialState ?? 0
    ),
    familyChecksum: input.familyChecksum ?? 0,
    activityChecksum: input.activityChecksum ?? 0,
    world: {
      valid: true,
      handles: { handles: [] },
      unk2: 0,
      worldServerTime: 0n,
      activityId: input.activityId ?? 0,
      activityName: { chars: activityNameChars(input.activityName) },
    },
  });
}

export function buildWorldGlobalsStateRsat(): Buffer {
  return encode(WorldGlobalsState, {
    valid: true,
    tickDurationMs: 1000 / 30,
  });
}

export function parseGlobalActivityState(payload: Buffer) {
  return decode(GlobalActivityState, payload);
}

/**
 * AH class 11 - Option<808044E0>.
 * Presence bit is required, see sub_836907E8
 * No PAH table yet, that is a later Option<808044DD>.
 */
export function buildReplicateMembershipRsat(
  identity: AhClientIdentity,
  generation = 1
): Buffer {
  if (identity.machine.length !== 6) {
    throw new Error(
      `membership machine id must be 6 bytes, got ${identity.machine.length}`
    );
  }
  if (identity.player.length !== 8) {
    throw new Error(
      `membership player id must be 8 bytes, got ${identity.player.length}`
    );
  }

  const emptySlot = { identity: undefined, auth: undefined };
  const slots = Array.from({ length: MEMBERSHIP_SLOT_COUNT }, (_, i) =>
    i === 0 ? { identity, auth: undefined } : emptySlot
  );

  const bw = new BitWriter();
  bw.writeBit(1);
  ReplicateMembership.encode(bw, {
    generation: generation >>> 0,
    unk: generation >>> 0,
    clients: { slots },
    pahRegions: undefined,
    occupiedMask: 1,
    machineMask: 1,
    unkMask: undefined,
    replicateMask: 0,
  });
  return bw.finish();
}

export function parseReplicateMembership(payload: Buffer) {
  const br = new BitReader(payload);
  if (!br.readBit()) {
    return null;
  }
  return ReplicateMembership.decode(br);
}
