import type { AhClientIdentity } from "../join";
import { PAH_AMBASSADOR_ASSIGN } from "../pah-policy";
import { activityHostBuild } from "../versions";
import { packBubbleStateHandle } from "./bubble-handle";

export const MEMBERSHIP_SLOT_COUNT = 20;
const PAH_REGION_COUNT = 40;
const PAH_PEER_SLOT_COUNT = 20;

// The members of a client's class-21 data that a build echoes back in the
// membership slot, as the build decoded them. Class 21 is a delta: members
// merge field by field.
export type ClientEcho = Readonly<Record<string, unknown>>;

interface ReplicateMembershipFields {
  // Override PAH ambassador opcode; default is a fresh policy (ASSIGN).
  ambassadorOpcode?: number;
  // Override revoke token; default is a fresh policy (0).
  ambassadorRevokeToken?: number;
  bubbleCount?: number;
  emptyBubbles?: readonly number[];
  generation?: number;
  // The host's hard wipe (HostHardWipe); none sends the idle zeros.
  hardWipe?: HostHardWipe;
  initialBubble?: number;
  initialState?: number;
  // Ambassador opcode for the region being ENTERED. Defaults to
  // ambassadorOpcode; the caller raises it to ASSIGN once the GAH exists.
  pendingAmbassadorOpcode?: number;
  // Slice-set transition in flight: the slice-set-switch task needs a row
  // for the pending region whose marker[local slot] equals the token the
  // client announced in class 21.
  pendingRegion?: PendingRegion;
  // Rows for an all-private activity (act_cosmo_m0_highway and the Tower,
  // 2.3.1 capture): the current row's flag on, the pending row's on once
  // the client has reached phase 3, a row for the region a crossing left
  // (flag off) while the client still names it, and every row's marker at
  // the client's latest transition token.
  privateActivity?: boolean;
  // The host's teleportation (Teleport); none sends the idle zeros.
  teleport?: Teleport;
}

// A teleportation the host runs (80800BF9 in the membership; the client logs it
// as "activities:teleportation"). The state goes 1 (start) -> 2 -> 3 (every
// client completed) -> 0 (inactive); a client accepts a teleportation whose id
// differs from its own and moves to the region, entering it by the spawn
// transition (act_cosmo_m0_highway: id 2 into region 112 as the intro phase
// ends).
export interface Teleport {
  id: number;
  region: number;
  state: number;
  transition: number;
}

// The host's hard wipe (808044CB in the alpha's membership, 80800C93 in TU0's):
// the cookie of the wipe it runs, the last cookie it completed and its state.
// How a client reads them is the build's (HardWipeRules). The alpha's client
// opens its wipe screen for a cookie it has not completed; TU0's has no
// completed cookie and takes the state alone.
export interface HostHardWipe {
  completedCookie?: number;
  cookie: number;
  state: number;
}

export interface PendingRegion {
  regionId: number;
  token: number;
}

// One joined console. Slot is the stable membership slot index: the guest
// finds itself by comparing its own 6-byte machine id against slot+8..slot+13,
// so the identity here must be that peer's own, and the slot must stay stable
// for its lifetime.
export interface ReplicateMember {
  // Identity half of the member's own class-21 data, echoed in its slot.
  clientAuth?: ClientEcho;
  // The member's own teleportation state (class 21), echoed the same way.
  clientTeleport?: ClientEcho;
  // And its own transition (class 21, the deltas merged).
  clientTransition?: ClientEcho;
  // The member's transition has reached phase 3 (privateActivity rows).
  committed?: boolean;
  identity: AhClientIdentity;
  // The member's latest transition token, the rows' marker once its crossing
  // has landed (privateActivity rows).
  lastToken?: number;
  // The region the member's last crossing between bubbles left, kept as a
  // row while the member names it (privateActivity rows).
  leftBehind?: PendingRegion;
  // Region this member is crossing into, with the token IT assigned - each
  // client counts its own transition tokens independently.
  pendingRegion?: PendingRegion;
  slot: number;
}

// One region row of the membership's PAH table (80800C6F), under the names the
// host works with: the region, its ambassador (80800E4A), the mask of peers in
// it and each peer slot's marker byte.
export interface PahRow {
  ambassador: {
    flag: boolean;
    opcode: number;
    revokeToken: number;
    slot: number;
  };
  markers: Buffer;
  peerMask: number;
  regionId: number;
}

function emptyPahRow(regionId = -1): PahRow {
  return {
    regionId,
    ambassador: { revokeToken: 0, opcode: 0, slot: 0, flag: false },
    peerMask: 0,
    markers: Buffer.alloc(PAH_PEER_SLOT_COUNT),
  };
}

// 40 region rows. Unused slots are region_id=-1 so the transition manager does
// not walk zeros as forty copies of region 0. Only the start bubble goes out (a
// multi-bubble activity would overflow the table), and the FAH is not stamped
// into public.activityHostId: the revoke spins a separate GAH.
function buildPahRegions(
  bubbleCount: number,
  initialBubble: number,
  initialState: number,
  emptyBubbles: readonly number[] = [],
  ambassadorOpcode = PAH_AMBASSADOR_ASSIGN,
  ambassadorRevokeToken = 0,
  members: readonly ReplicateMember[] = [],
  pendingAmbassadorOpcode = ambassadorOpcode,
  privateActivity = false
) {
  const empty = new Set(emptyBubbles);
  const rows = Array.from({ length: PAH_REGION_COUNT }, () => emptyPahRow());
  // A current bubble outside the scenario (the pre-world state refresh reports
  // bubble 1, and a single-bubble activity has exactly one) means there is no
  // current row to describe, not that the table is empty. Blanking it strands
  // a client that is asking to cross.
  const hasCurrent =
    initialBubble >= 0 &&
    initialBubble < bubbleCount &&
    !empty.has(initialBubble);
  const hasPending = members.some((member) => member.pendingRegion);
  if (!(hasCurrent || hasPending)) {
    return rows;
  }
  // The guest matches a region row on two things only: row.regionId == the
  // region it wants, and row.markers[localSlot] == the transition token it
  // assigned itself. Both are its own values; we echo them. The token counts
  // every attempt including aborted ones, so it can't be guessed up front.
  const regionId = hasCurrent
    ? packBubbleStateHandle(initialBubble, initialState)
    : -1;
  const current = emptyPahRow(regionId);
  current.ambassador.opcode = ambassadorOpcode;
  current.ambassador.revokeToken = ambassadorRevokeToken;
  current.ambassador.slot = 0;
  if (hasCurrent) {
    // Every joined member is in the current region until it crosses
    // (peerMask |= 1 << slot).
    for (const member of members) {
      current.peerMask |= 1 << member.slot;
      if (privateActivity) {
        current.markers[member.slot] =
          member.pendingRegion?.token ??
          member.leftBehind?.token ??
          member.lastToken ??
          0;
      }
    }
    // The current row has its flag on at every step (every captured crossing,
    // the Tower's join too).
    current.ambassador.flag = privateActivity;
  }
  let next = 0;
  if (hasCurrent) {
    rows[next] = current;
    next += 1;
  }
  // Rows must stay packed: the guest stops at the first region_id -1. Each
  // client counts its own transition token independently, so a row for a
  // region being entered can carry a different marker per slot - group
  // members by the region they are actually crossing into.
  const pendingRows = new Map<number, PahRow>();
  for (const member of members) {
    const pendingRegion = member.pendingRegion;
    if (!pendingRegion) {
      continue;
    }
    let row = pendingRows.get(pendingRegion.regionId);
    if (!row) {
      row =
        hasCurrent && pendingRegion.regionId === regionId
          ? current
          : emptyPahRow(pendingRegion.regionId);
      pendingRows.set(pendingRegion.regionId, row);
    }
    // The ambassador goes on the pending row even when that row is the current
    // row (a crossing into the bubble the player stands in has the same
    // regionId). The guest reads the pending row's opcode in the citizen-join
    // task assignment and logs "has no ambassador; avoiding the citizen-join
    // task for now" on anything but ASSIGN; opcode 2 with revokeToken 0 means
    // "nobody hosts this region", so no task runs and the public leg of the
    // switch never clears. Gated on the GAH being bound: before that the REVOKE
    // is what makes the guest spin one up.
    if (pendingAmbassadorOpcode === PAH_AMBASSADOR_ASSIGN) {
      row.ambassador.opcode = PAH_AMBASSADOR_ASSIGN;
      // Private-activity rows keep 1 here (ASSIGN, token 1, at the join and at
      // every crossing).
      row.ambassador.revokeToken = privateActivity ? ambassadorRevokeToken : 0;
      // Names the peer that hosts the region: one per region, not per slot, and
      // for the crossing client its own slot (the public-session task would
      // join a peer that does not exist otherwise).
      row.ambassador.slot = member.slot;
      // The flag also lets the client stop matchmaking for the region: a solo
      // player can only leave the citizen-join task through the pending row,
      // and the flag is checked before the search status ("A player has reached
      // the matchmaking threshold... aborting and spinning up"). Private rows
      // turn it on only once the client reports phase 3: false at phases 1 and
      // 2 of every captured crossing (and at the Tower's join), true from 3 on,
      // and false again on the row of the region a swap left.
      row.ambassador.flag =
        !privateActivity || row === current || member.committed === true;
    } else if (row !== current) {
      row.ambassador.opcode = ambassadorOpcode;
      row.ambassador.revokeToken = ambassadorRevokeToken;
      row.ambassador.slot = 0;
    }
    row.markers[member.slot] = pendingRegion.token;
    row.peerMask |= 1 << member.slot;
  }
  // The region a member's last crossing left (privateActivity): its row stays,
  // ASSIGN with the flag off and the crossing's token as marker, until the
  // client stops naming it (112 beside the breach's 24, flag false, both
  // markers 4).
  for (const member of privateActivity ? members : []) {
    const left = member.leftBehind;
    if (!left || left.regionId === regionId || pendingRows.has(left.regionId)) {
      continue;
    }
    const row = emptyPahRow(left.regionId);
    row.ambassador.opcode = PAH_AMBASSADOR_ASSIGN;
    row.ambassador.revokeToken = ambassadorRevokeToken;
    row.ambassador.slot = 0;
    row.ambassador.flag = false;
    row.markers[member.slot] = left.token;
    row.peerMask |= 1 << member.slot;
    pendingRows.set(left.regionId, row);
  }
  for (const row of pendingRows.values()) {
    if (row === current) {
      continue;
    }
    rows[next] = row;
    next += 1;
  }
  return rows;
}

// A membership under named fields (the names the tests and logs use).
export interface ParsedMembership {
  clients: {
    slots: {
      auth?: unknown;
      identity?: {
        account: bigint;
        character: bigint;
        machine: Buffer;
        player: Buffer;
      };
    }[];
  };
  generation: number;
  machineMask: number | undefined;
  occupiedMask: number | undefined;
  pahRegions?: {
    table: {
      rows: {
        ambassador: {
          flag: boolean;
          opcode: number;
          revokeToken: number;
          slot: number;
        };
        peerMask: number;
        public: {
          activityHostId: bigint;
          peerSlots: { markers: Buffer };
        };
        regionId: number;
      }[];
    };
  };
  unk: number;
  unknownMask: number | undefined;
}

// AH class 11 Option<808044E0>. The presence bit is required.
//
// Two shapes: a single identity (the whole single-player flow, slot 0,
// pendingRegion in `fields`), or a list of members - one per joined console,
// each with its own stable slot and its own pendingRegion/token.
export function buildReplicateMembershipRsat(
  identity: AhClientIdentity,
  fields?: number | ReplicateMembershipFields
): Buffer;
export function buildReplicateMembershipRsat(
  members: readonly ReplicateMember[],
  fields?: ReplicateMembershipFields
): Buffer;
export function buildReplicateMembershipRsat(
  identityOrMembers: AhClientIdentity | readonly ReplicateMember[],
  fields: number | ReplicateMembershipFields = 1
): Buffer {
  const opts = typeof fields === "number" ? { generation: fields } : fields;
  const members: readonly ReplicateMember[] = Array.isArray(identityOrMembers)
    ? identityOrMembers
    : [
        {
          identity: identityOrMembers,
          pendingRegion: opts.pendingRegion,
          slot: 0,
        },
      ];

  const build = activityHostBuild();
  for (const member of members) {
    if (member.identity.machine.length !== build.machineIdBytes) {
      throw new Error(
        `membership machine id must be ${build.machineIdBytes} bytes, got ${member.identity.machine.length}`
      );
    }
    if (member.identity.player.length !== 8) {
      throw new Error(
        `membership player id must be 8 bytes, got ${member.identity.player.length}`
      );
    }
  }

  const generation = (opts.generation ?? 1) >>> 0;
  const bubbleCount = Math.max(1, opts.bubbleCount ?? 1);
  const initialBubble = opts.initialBubble ?? 0;
  const initialState = opts.initialState ?? 0;
  const ambassadorOpcode = opts.ambassadorOpcode ?? PAH_AMBASSADOR_ASSIGN;
  const pendingAmbassadorOpcode =
    opts.pendingAmbassadorOpcode ?? ambassadorOpcode;
  const ambassadorRevokeToken = opts.ambassadorRevokeToken ?? 0;

  // The guest finds its own slot by comparing its machine id against every
  // occupied slot, so occupiedMask must have every joined console's bit set.
  // Two distinct consoles also both set machineMask.
  let occupiedMask = 0;
  for (const member of members) {
    occupiedMask |= 1 << member.slot;
  }

  return build.membership.encode({
    generation,
    members,
    occupiedMask,
    rows: buildPahRegions(
      bubbleCount,
      initialBubble,
      initialState,
      opts.emptyBubbles,
      ambassadorOpcode,
      ambassadorRevokeToken,
      members,
      pendingAmbassadorOpcode,
      opts.privateActivity === true && build.membership.privateActivityRows
    ),
    hardWipe: opts.hardWipe,
    teleport: opts.teleport,
  });
}
