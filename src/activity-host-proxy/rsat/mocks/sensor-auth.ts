import { BitWriter } from "@blamnetwork/rsat";
import { activityBundleForSlice } from "../../../tags/activity_bundle";
import { tag as towerHub } from "../../../tags/activity_bundle/809E2007_city_tower_default1_f2d88bd0";
import { tag as towerStory } from "../../../tags/activity_bundle/809E2008_city_tower_default1_4786c0e0";
import { tag as towerClient } from "../../../tags/scenario_client/80B86004_city_tower_default1_scenario_client";
import { tag as towerFah } from "../../../tags/scenario_fah/809E2004_city_tower_default1_scenario_fah";
import {
  ActivityBundleItemType,
  type ActivityBundleRow,
  type ActivityBundleTag,
} from "../../../tags/types";
import type { ScenarioClient } from "../../scenario-client";
import {
  ActivityOptions,
  FireteamAuth,
  HardWipeGlobalsAuth,
  LifetimeAuth,
  ObjectAuth,
  ObjectFilterAuth,
  PlayerAuth,
  SafeZoneAuth,
  ScoreboardAuth,
  SensorClientRef,
  SquadAuth,
  SquadSense,
  TimerAuth,
} from "../schemas/sensor";

/** Guest constructor unset client-ref (8370F1C8). */
const UNSET_CLIENT_REF = {
  bundle: 0x811c9dc5,
  typeId: -1,
  typeIndex: -1,
} as const;

/**
 * 80801603 +0x20 by bundle. Not in 80800533 — indices come from the
 * slice table, missing keys default to 1.
 */
const SQUAD_COUNTS: ReadonlyMap<number, ReadonlyMap<number, number>> = new Map([
  [
    0x8d3f1166, // boulevard
    new Map([
      [0, 3],
      [4, 3],
      [9, 2],
      [18, 3],
      [22, 3],
      [26, 3],
      [32, 3],
      [36, 2],
    ]),
  ],
  [
    0x19d43443, // military
    new Map([
      [0, 2],
      [3, 2],
      [6, 3],
      [10, 2],
      [13, 3],
      [17, 3],
      [24, 3],
      [27, 2],
      [31, 3],
      [35, 3],
      [39, 2],
      [42, 2],
    ]),
  ],
  [
    0x8cc31436, // plaza
    new Map([
      [2, 2],
      [9, 2],
      [10, 2],
      [11, 2],
      [12, 2],
      [14, 4],
      [19, 3],
      [23, 6],
      [30, 2],
      [33, 3],
      [37, 3],
      [41, 2],
      [44, 2],
      [47, 2],
      [50, 3],
    ]),
  ],
  [
    0xaa891b91, // underwatch
    new Map([
      [8, 3],
      [12, 3],
      [16, 3],
      [20, 3],
      [24, 2],
      [27, 2],
      [28, 2],
      [31, 2],
    ]),
  ],
]);

const AUTHORITY_SLOTS = 65;
const DOMAIN_SLOT = 64;
const DEFAULT_PROMOTE_SEQ = 1;

export interface SensorClientRefFields {
  bundle: number;
  typeId: number;
  typeIndex: number;
}

export interface SensorAuthSenseEntry {
  authBits?: number;
  authBody?: Buffer;
  authSchemaBound: boolean;
  clientRef: SensorClientRefFields;
  /** Guest sensor+0x19. Default true when a sense body is present. */
  isReceivedSenseState?: boolean;
  /** Sense-section rel bit. Default true (absolute / reset baseline). */
  isSenseUpdateRelative?: boolean;
  senseBits?: number;
  senseBody?: Buffer;
  senseSchemaBound: boolean;
  /** Guest sensor+0x10. Keep 0 — nonzero must be monotonic or KeBugCheck. */
  senseStateSequence?: number;
}

export interface SensorAuthUpdateFields {
  activityTime?: number;
  authorityMachine?: Buffer | null;
  bubbleCount?: number;
  emptyBubbles?: readonly number[];
  /**
   * `83643B90` first bit. Retail keepalives are 0 (skip the 65-slot
   * apply). `hasAuth=1` with empty slots still calls `83643598(false)`
   * for every bubble — a demote, not a no-op.
   */
  hasAuthorityTable?: boolean;
  /**
   * When set, only this bubble + domain are promoted. Tower spawn omits
   * this so every non-empty slice is granted once (retail keepalives
   * then skip the table).
   */
  occupiedBubble?: number;
  /** Occupied type-12 identity. Default 0x00000002_00000002. */
  playerKey?: bigint;
  /**
   * Empty authority table. Join flood uses this so `830229C8` stays
   * false and `8376DEB8` never walks Type-1 into `835AE300`.
   */
  promoteNone?: boolean;
  /** 808044E1 seq. Must change vs stored or MEM-2 skips promote. */
  promoteSeq?: number;
  senseEntries?: readonly SensorAuthSenseEntry[];
}

export interface FinishedBits {
  bitCount: number;
  bytes: Buffer;
}

function rowsOf(
  tag: ActivityBundleTag,
  typeId: ActivityBundleItemType
): readonly ActivityBundleRow[] {
  return tag.rows.filter((row) => row.typeId === typeId);
}

function encodeExact(
  encodeFn: (bw: BitWriter) => void,
  capacityBytes = 4096
): FinishedBits {
  const bw = new BitWriter(capacityBytes);
  encodeFn(bw);
  const bitCount = bw.bitCount;
  return { bitCount, bytes: bw.finish() };
}

function appendBits(bw: BitWriter, body: FinishedBits): void {
  for (let i = 0; i < body.bitCount; i++) {
    bw.writeBit((body.bytes[i >> 3] >> (7 - (i & 7))) & 1);
  }
}

export function encodeSensorClientRef(
  ref: SensorClientRefFields
): FinishedBits {
  return encodeExact((bw) => {
    SensorClientRef.encode(bw, ref);
  });
}

export function encodePlayerAuth(playerKey: bigint): FinishedBits {
  return encodeExact((bw) => {
    PlayerAuth.encode(bw, {
      key: playerKey,
      unk1: 0,
      sense: {
        unk0: 0,
        nested: { count: 0 },
        flag2: false,
        unk3: 0,
        unk4: 0,
        flag5: false,
        flag6: false,
      },
      flag: false,
    });
  });
}

export function encodeLifetimeAuth(state = 2): FinishedBits {
  return encodeExact((bw) => {
    LifetimeAuth.encode(bw, {
      state,
      flag1: true,
      phaseIndex: 3,
      phaseHash: 0x45bc13ac,
      field4: 21,
      handles: { handles: [] },
    });
  });
}

function emptyActivityOptions() {
  return {
    flag0: false,
    windowOpen: -0x80000000,
    windowClose: 0x7fffffff,
    unk3: 0,
    unk4: 0,
    unk5: 0,
    scalar: 1,
  };
}

function zeroActivityOptions() {
  return {
    flag0: false,
    windowOpen: 0,
    windowClose: 0,
    unk3: 0,
    unk4: 0,
    unk5: 0,
    scalar: 0,
  };
}

function encodeEmptyClientRef(): FinishedBits {
  return encodeSensorClientRef(UNSET_CLIENT_REF);
}

export function encodeHardWipeGlobalsAuth(): FinishedBits {
  return encodeExact((bw) => {
    HardWipeGlobalsAuth.encode(bw, { options: emptyActivityOptions() });
  });
}

export function encodeTimerAuth(): FinishedBits {
  return encodeExact((bw) => {
    TimerAuth.encode(bw, {
      options: zeroActivityOptions(),
      flag: false,
      unk: 0,
    });
  });
}

export function encodeFireteamAuth(playerKey = 0n): FinishedBits {
  return encodeExact((bw) => {
    FireteamAuth.encode(bw, {
      key: playerKey,
      flag: false,
      nested: { count: 0 },
      unk: 0,
    });
  });
}

export function encodeObjectAuth(): FinishedBits {
  return encodeExact((bw) => {
    ObjectAuth.encode(bw, {
      unk0: 0,
      flag: false,
      ref: UNSET_CLIENT_REF,
      vec: { count: 0 },
    });
  });
}

export function encodeSafeZoneAuth(): FinishedBits {
  return encodeExact((bw) => {
    SafeZoneAuth.encode(bw, {
      ref: UNSET_CLIENT_REF,
      unk: 0,
    });
  });
}

export function encodeObjectFilterAuth(): FinishedBits {
  return encodeExact((bw) => {
    ObjectFilterAuth.encode(bw, { vec: { count: 0 } });
  });
}

/**
 * 80802DB0 dirty-0 Some. Kind 13 is 96 bits (XWS guest bandwidth 2618-ish).
 * Type-32 goes last so a width miss only truncates the tail.
 */
export function encodePlayerObjectiveAuth(): FinishedBits {
  const ref = encodeEmptyClientRef();
  return encodeExact((bw) => {
    bw.write(1, 3);
    appendBits(bw, ref);
    bw.writeBit(0);
    ActivityOptions.encode(bw, zeroActivityOptions());
    bw.write(1, 4);
    bw.write(0, 32);
    bw.write(0, 32);
    appendBits(bw, ref);
    for (let i = 0; i < 10; i++) {
      bw.write(1, 4);
      appendBits(bw, ref);
      bw.write(0, 32);
      bw.write(0, 32);
      bw.write(0, 32);
      bw.write(0, 32);
      bw.write(0, 32);
    }
    bw.write(0, 32);
    bw.write(0, 32);
  });
}

/**
 * 8080067A dirty encode: only field 3 (roster) is Some. Always-on fields
 * 9/10 emit defaults (1). Slot kind 5 is biased i32 (p0=0x80000000):
 * wire 0x80000000 decodes to memory 0 (83760030 empty). Wire 0 decodes
 * to 0x80000000 and AV'd the typed-handle walk. Count 1 is 50 body bits.
 */
export function encodeSquadAuth(memberCount: number): FinishedBits {
  return encodeExact((bw) => {
    SquadAuth.encode(bw, {
      ref0: undefined,
      ref1: undefined,
      filter: undefined,
      roster: { slots: Array.from({ length: memberCount }, () => 0) },
      unk4: undefined,
      unk5: undefined,
      unk6: undefined,
      unk7: undefined,
      unk8: undefined,
      unk9: 0,
      unk10: 0,
    });
  });
}

/**
 * 80800677 dirty encode. +0x17 (field 8) is the AF0A8 copy gate.
 *
 * Join flood is Phase A: valid=0 so AF0A8 inits the live roster via
 * 83760030 (+0x110). valid=1 skipped that and KeBugCheck'd 835AD3C4
 * (140103). Phase B (+0x17=1, sense rel=0) is later, after place.
 *
 * Roster count matches auth / definition. Slots are biased zeros.
 */
export function encodeSquadSense(
  memberCount: number,
  valid = false
): FinishedBits {
  return encodeExact((bw) => {
    SquadSense.encode(bw, {
      unk0: undefined,
      unk1: undefined,
      unk2: undefined,
      unk3: undefined,
      unk4: undefined,
      flag5: false,
      flag6: false,
      flag7: false,
      valid,
      unk9: undefined,
      roster: { slots: Array.from({ length: memberCount }, () => 0) },
      extras: undefined,
    });
  });
}

/** 80802DD6 empty: five length-prefixed vecs, counts 4+4+4+5+2 = 19 bits. */
export function encodeScoreboardAuth(): FinishedBits {
  return encodeExact((bw) => {
    ScoreboardAuth.encode(bw, {
      v0: { count: 0 },
      v1: { count: 0 },
      v2: { count: 0 },
      v3: { count: 0 },
      v4: { count: 0 },
    });
  });
}

export function senseEntryPayloadBits(entry: SensorAuthSenseEntry): number[] {
  const bits: number[] = [];
  const push = (bit: number) => bits.push(bit & 1);
  const pushBody = (body: Buffer, bitCount: number) => {
    for (let i = 0; i < bitCount; i++) {
      push((body[i >> 3] >> (7 - (i & 7))) & 1);
    }
  };

  if (entry.authSchemaBound) {
    push(1);
    if (entry.authBody && (entry.authBits ?? 0) > 0) {
      push(1);
      pushBody(entry.authBody, entry.authBits ?? 0);
    } else {
      push(0);
    }
  }
  if (entry.senseSchemaBound) {
    if (entry.senseBody && (entry.senseBits ?? 0) > 0) {
      push(1);
      push(entry.isReceivedSenseState === false ? 0 : 1);
      push(entry.isSenseUpdateRelative === false ? 0 : 1);
      push(1);
      pushBody(entry.senseBody, entry.senseBits ?? 0);
      const seq = (entry.senseStateSequence ?? 0) >>> 0;
      for (let i = 31; i >= 0; i--) {
        push((seq >>> i) & 1);
      }
    } else {
      push(0);
    }
  }
  return bits;
}

function encodeSenseEntry(bw: BitWriter, entry: SensorAuthSenseEntry): void {
  bw.writeBit(1);
  appendBits(bw, encodeSensorClientRef(entry.clientRef));
  const payload = senseEntryPayloadBits(entry);
  bw.write(payload.length >>> 0, 32);
  for (const bit of payload) {
    bw.writeBit(bit);
  }
}

function encodeAuthorityOption(
  bw: BitWriter,
  promote: ReadonlySet<number>,
  machine: Buffer | null,
  promoteSeq = DEFAULT_PROMOTE_SEQ
): void {
  const stamp = machine && machine.length === 6 ? machine : null;
  const seq = promoteSeq & 0xffff;
  bw.writeBit(0);
  for (let i = 0; i < AUTHORITY_SLOTS; i++) {
    const promoted = promote.has(i);
    if (promoted && stamp) {
      bw.writeBit(1);
      for (const byte of stamp) {
        bw.write(byte, 8);
      }
    } else {
      bw.writeBit(0);
    }
    bw.writeBit(1);
    bw.write(promoted ? seq : 0, 16);
    bw.writeBit(0);
  }
}

function promoteSlots(
  bubbleCount: number,
  emptyBubbles: readonly number[],
  occupiedBubble?: number,
  promoteNone = false
): Set<number> {
  const slots = new Set<number>();
  if (promoteNone) {
    return slots;
  }
  const empty = new Set(emptyBubbles);
  if (
    occupiedBubble !== undefined &&
    occupiedBubble >= 0 &&
    occupiedBubble < bubbleCount &&
    !empty.has(occupiedBubble)
  ) {
    slots.add(occupiedBubble);
  } else {
    for (let i = 0; i < bubbleCount; i++) {
      if (!empty.has(i)) {
        slots.add(i);
      }
    }
  }
  slots.add(DOMAIN_SLOT);
  return slots;
}

export function playerKeyFromCharacter(character?: bigint): bigint {
  return character !== undefined && character !== 0n
    ? character
    : 0x0000_0002_0000_0002n;
}

function entryOn(
  bundle: number,
  typeId: number,
  typeIndex: number,
  body: FinishedBits | null,
  senseSchemaBound: boolean,
  sense?: FinishedBits | null
): SensorAuthSenseEntry {
  return {
    clientRef: { bundle, typeId, typeIndex },
    authSchemaBound: true,
    senseSchemaBound,
    authBody: body?.bytes,
    authBits: body?.bitCount ?? 0,
    senseBody: sense?.bytes,
    senseBits: sense?.bitCount ?? 0,
    isReceivedSenseState: sense != null,
    isSenseUpdateRelative: true,
  };
}

function someRows(
  tag: ActivityBundleTag,
  typeId: ActivityBundleItemType,
  body: FinishedBits,
  senseSchemaBound: boolean
): SensorAuthSenseEntry[] {
  return rowsOf(tag, typeId).map((row) =>
    entryOn(tag.bundle, typeId, row.typeIndex, body, senseSchemaBound)
  );
}

function noneRows(
  tag: ActivityBundleTag,
  typeId: ActivityBundleItemType,
  senseSchemaBound: boolean
): SensorAuthSenseEntry[] {
  return rowsOf(tag, typeId).map((row) =>
    entryOn(tag.bundle, typeId, row.typeIndex, null, senseSchemaBound)
  );
}

function squadEntries(tag: ActivityBundleTag): SensorAuthSenseEntry[] {
  const counts = SQUAD_COUNTS.get(tag.bundle);
  return rowsOf(tag, ActivityBundleItemType.Squad).map((row) =>
    entryOn(
      tag.bundle,
      ActivityBundleItemType.Squad,
      row.typeIndex,
      encodeSquadAuth(counts?.get(row.typeIndex) ?? 1),
      true
    )
  );
}

/** Join grant: 809E2008 Lifetime + Player. Retail 261. */
export function buildTowerBinderSenseEntries(
  playerKey: bigint
): SensorAuthSenseEntry[] {
  const type12 = encodePlayerAuth(playerKey);
  return [
    ...someRows(
      towerStory,
      ActivityBundleItemType.Lifetime,
      encodeLifetimeAuth(),
      false
    ),
    ...someRows(towerStory, ActivityBundleItemType.Player, type12, true),
  ];
}

/**
 * 4786 / F2D leftover Some + current-slice type-2 None. Type-32 / 4 /
 * 27 / 33 Some is 835AE4B4 after plaza exists (2318B full leftover).
 */
export function buildTowerLeftoverSenseEntries(
  sliceTag?: ActivityBundleTag
): SensorAuthSenseEntry[] {
  const type9 = encodeFireteamAuth();
  const type32 = encodePlayerObjectiveAuth();
  const type4 = encodeObjectAuth();
  const type27 = encodeSafeZoneAuth();
  const type33 = encodeObjectFilterAuth();
  return [
    ...someRows(
      towerStory,
      ActivityBundleItemType.Scoreboard,
      encodeScoreboardAuth(),
      false
    ),
    ...someRows(
      towerStory,
      ActivityBundleItemType.HardWipeGlobals,
      encodeHardWipeGlobalsAuth(),
      false
    ),
    ...someRows(
      towerStory,
      ActivityBundleItemType.Timer,
      encodeTimerAuth(),
      false
    ),
    ...someRows(towerStory, ActivityBundleItemType.Fireteam, type9, false),
    ...someRows(towerHub, ActivityBundleItemType.Fireteam, type9, false),
    ...(sliceTag
      ? [
          ...someRows(sliceTag, ActivityBundleItemType.SafeZone, type27, true),
          ...someRows(
            sliceTag,
            ActivityBundleItemType.ObjectFilter,
            type33,
            false
          ),
        ]
      : []),
    ...someRows(
      towerHub,
      ActivityBundleItemType.PlayerObjective,
      type32,
      false
    ),
    ...(sliceTag
      ? [
          ...someRows(sliceTag, ActivityBundleItemType.Object, type4, true),
          ...noneRows(sliceTag, ActivityBundleItemType.Actor, true),
        ]
      : []),
  ];
}

/**
 * Refresh apply for the current slice. Identity + leftover Some stay
 * for Alpha spawn; type-1 comes from ACTIVITY_SLICE_BUNDLE_HASHES.
 * Do not None the previous slice's type-1 — 8376DEB8 then AE4B4s.
 */
export function buildTowerApplySenseEntries(
  playerKey: bigint,
  slice = towerFah.initialBubble,
  activityName = towerFah.activityName
): SensorAuthSenseEntry[] {
  const sliceTag = activityBundleForSlice(activityName, slice);
  return [
    ...buildTowerBinderSenseEntries(playerKey),
    ...(sliceTag ? squadEntries(sliceTag) : []),
    ...buildTowerLeftoverSenseEntries(sliceTag),
  ];
}

export function buildSensorAuthUpdateRsat(
  fields: SensorAuthUpdateFields = {}
): Buffer {
  const bubbleCount = fields.bubbleCount ?? 1;
  const emptyBubbles = fields.emptyBubbles ?? [];
  const hasTable = fields.hasAuthorityTable !== false;
  const promote = hasTable
    ? promoteSlots(
        bubbleCount,
        emptyBubbles,
        fields.occupiedBubble,
        fields.promoteNone
      )
    : new Set<number>();
  const machine = fields.authorityMachine ?? null;
  const entries = fields.senseEntries ?? [];

  const bw = new BitWriter(32768);
  if (hasTable) {
    bw.writeBit(1);
    for (let i = 0; i < AUTHORITY_SLOTS; i++) {
      bw.writeBit(promote.has(i) ? 1 : 0);
    }
    bw.writeBit(1);
    encodeAuthorityOption(
      bw,
      promote,
      machine,
      fields.promoteSeq ?? DEFAULT_PROMOTE_SEQ
    );
  } else {
    bw.writeBit(0);
  }
  bw.write((fields.activityTime ?? 0) >>> 0, 32);
  if (entries.length > 0) {
    bw.writeBit(1);
    for (const entry of entries) {
      encodeSenseEntry(bw, entry);
    }
  }
  bw.writeBit(0);
  return bw.finish();
}

/** Retail keepalive: `hasAuth=0` + activity time + no sense rows. */
export function buildSensorAuthTickRsat(activityTime = 0): Buffer {
  return buildSensorAuthUpdateRsat({
    activityTime,
    hasAuthorityTable: false,
  });
}

export function buildTowerSensorAuthRsat(opts: {
  activityTime?: number;
  authorityMachine?: Buffer | null;
  playerKey?: bigint;
  scenario?: ScenarioClient;
  slice?: number;
  /** Join grant: hasAuth=1 + Lifetime/Player. Apply: hasAuth=0 + identity/squads/leftovers. */
  grantTable?: boolean;
  promoteSeq?: number;
}): Buffer {
  const grant = opts.grantTable === true;
  const playerKey = opts.playerKey ?? playerKeyFromCharacter();
  const activityName = opts.scenario?.activityName ?? towerFah.activityName;
  return buildSensorAuthUpdateRsat({
    activityTime: opts.activityTime,
    authorityMachine: opts.authorityMachine,
    bubbleCount: opts.scenario?.bubbleCount ?? towerClient.bubbleCount,
    emptyBubbles: opts.scenario?.emptyBubbles,
    hasAuthorityTable: grant,
    promoteSeq: opts.promoteSeq,
    senseEntries: grant
      ? buildTowerBinderSenseEntries(playerKey)
      : buildTowerApplySenseEntries(
          playerKey,
          opts.slice ?? opts.scenario?.initialBubble ?? towerFah.initialBubble,
          activityName
        ),
  });
}
