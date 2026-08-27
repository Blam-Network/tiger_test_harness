import { BitReader, BitWriter, decode, encode } from "@blamnetwork/rsat";
import type { AhClientIdentity } from "../../join";
import {
  MEMBERSHIP_SLOT_COUNT,
  PAH_PEER_SLOT_COUNT,
  PAH_REGION_COUNT,
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
  emptyBubbles?: readonly number[];
  familyChecksum?: number;
  initialBubble?: number;
  initialState?: number;
  instanceId: bigint;
}

/** Client TOD init denominator. worldServerTime / this = day fraction. */
export const GAS_SECONDS_PER_DAY = 3600;
/** 10:00. 0 is midnight. */
export const GAS_TIME_OF_DAY_FRACTION = 10 / 24;

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
  const empty = new Set(input.emptyBubbles ?? []);
  const states = Array.from({ length: BUBBLE_SLOTS }, (_, i) =>
    i < bubbleCount && !empty.has(i) ? 0 : -1
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
      worldServerTime: BigInt(
        Math.floor(GAS_TIME_OF_DAY_FRACTION * GAS_SECONDS_PER_DAY)
      ),
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

/** 808044C1+1: assign — required before matchmaking-GS is enqueued. */
const PAH_AMBASSADOR_ASSIGN = 1;

export interface ReplicateMembershipFields {
  bubbleCount?: number;
  emptyBubbles?: readonly number[];
  generation?: number;
  initialBubble?: number;
  initialState?: number;
}

function emptyPahRow(regionId = -1) {
  return {
    regionId,
    unk1: 0,
    ambassador: {
      revokeToken: 0,
      opcode: 0,
      slot: 0,
      flag: false,
    },
    peerMask: 0,
    public: {
      unk0: 0,
      sessionLock: 0,
      peerSlots: { markers: Buffer.alloc(PAH_PEER_SLOT_COUNT) },
      advertised: {
        session: { bytes: Buffer.alloc(8) },
        pad: { bytes: Buffer.alloc(36) },
        activityHost: { bytes: Buffer.alloc(16) },
      },
      activityHostId: 0n,
    },
  };
}

function emptyUnknown808044CC() {
  return { a: 0, b: 0, c: 0, d: 0 };
}

/**
 * 40 region rows. Unused slots are region_id=-1 so the transition manager
 * does not walk zeros as forty copies of region 0.
 */
function buildPahRegions(
  bubbleCount: number,
  initialBubble: number,
  initialState: number,
  emptyBubbles: readonly number[] = []
) {
  const empty = new Set(emptyBubbles);
  const rows = Array.from({ length: PAH_REGION_COUNT }, () => emptyPahRow());
  let i = 0;
  for (let bubble = 0; bubble < bubbleCount && i < PAH_REGION_COUNT; bubble++) {
    if (empty.has(bubble)) {
      continue;
    }
    for (let token = 1; token <= 8 && i < PAH_REGION_COUNT; token++) {
      const row = emptyPahRow(packBubbleStateHandle(bubble, initialState));
      row.peerMask = 1;
      row.public.peerSlots.markers[0] = token;
      if (bubble === initialBubble && token === 1) {
        row.ambassador.opcode = PAH_AMBASSADOR_ASSIGN;
      }
      rows[i++] = row;
    }
  }
  return {
    table: { rows },
    unknown0: { a: 0, b: 0, c: 0 },
    unknown1: {
      a: 0,
      left: emptyUnknown808044CC(),
      right: emptyUnknown808044CC(),
    },
  };
}

/**
 * AH class 11 Option<808044E0>.
 * Presence bit is required see sub_836907E8
 */
export function buildReplicateMembershipRsat(
  identity: AhClientIdentity,
  fields: number | ReplicateMembershipFields = 1
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

  const opts = typeof fields === "number" ? { generation: fields } : fields;
  const generation = (opts.generation ?? 1) >>> 0;
  const bubbleCount = Math.max(1, opts.bubbleCount ?? 1);
  const initialBubble = opts.initialBubble ?? 0;
  const initialState = opts.initialState ?? 0;

  const emptySlot = { identity: undefined, auth: undefined };
  const slots = Array.from({ length: MEMBERSHIP_SLOT_COUNT }, (_, i) =>
    i === 0 ? { identity, auth: undefined } : emptySlot
  );

  const bw = new BitWriter();
  bw.writeBit(1);
  ReplicateMembership.encode(bw, {
    generation,
    unk: generation,
    clients: { slots },
    pahRegions: buildPahRegions(
      bubbleCount,
      initialBubble,
      initialState,
      opts.emptyBubbles
    ),
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

export type {
  FinishedBits,
  SensorAuthSenseEntry,
  SensorAuthUpdateFields,
  SensorClientRefFields,
} from "./sensor-auth";
export {
  BOULEVARD_BUNDLE,
  buildSensorAuthTickRsat,
  buildSensorAuthUpdateRsat,
  // TOWERSPAWN TODO: Clean this up - do we need a function for each bundle?
  buildTowerApplySenseEntries,
  buildTowerBinderSenseEntries,
  buildTowerIdentitySenseEntries,
  buildTowerLeftoverSenseEntries,
  buildTowerSensorAuthRsat,
  buildTowerSpawnSenseEntries,
  encodeFireteamAuth,
  encodeHardWipeGlobalsAuth,
  encodeLifetimeAuth,
  encodeObjectAuth,
  encodeObjectFilterAuth,
  encodePlayerAuth,
  encodePlayerObjectiveAuth,
  encodeSafeZoneAuth,
  encodeScoreboardAuth,
  encodeSensorClientRef,
  encodeSquadAuth,
  encodeSquadSense,
  encodeTimerAuth,
  HUB_BUNDLE,
  LIFETIME_STATE_SPAWN_READY,
  MILITARY_BUNDLE,
  playerKeyFromCharacter,
  SLICE_BUNDLE,
  SPAWN_BUNDLE,
  SPAWN_LIFETIME_INDEX,
  SPAWN_OCCUPIED_PLAYER_INDEX,
  SPAWN_PLAYER_INDICES,
  TOWER_TYPE1_BANKS,
  TOWER_TYPE1_COUNTS,
  UNDERWATCH_BUNDLE,
} from "./sensor-auth";
