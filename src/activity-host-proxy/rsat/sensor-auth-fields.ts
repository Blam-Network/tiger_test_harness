import type { CommandScriptAtom } from "@blamnetwork/bullshcript/destiny1/common";
import { BitReader, BitWriter } from "@blamnetwork/rsat";
import { activityBundleItemType } from "../../content/row-types";
import type { AhClientIdentity } from "../join";
import type { ScenarioClient } from "../scenario-client";
import { DEFAULT_PLAYER_KEY } from "../stubs/world-defaults";
import { activityHostBuild } from "../versions";

const AUTHORITY_SLOTS = 65;
const DOMAIN_SLOT = 64;
const DEFAULT_PROMOTE_SEQ = 1;

function appendBits(bw: BitWriter, body: FinishedBits): void {
  for (let i = 0; i < body.bitCount; i++) {
    bw.writeBit((body.bytes[i >> 3] >> (7 - (i & 7))) & 1);
  }
}

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
  // The guest sensor's received-sense flag.
  isReceivedSenseState?: boolean;
  // Sense-section rel bit (absolute / reset baseline).
  isSenseUpdateRelative?: boolean;
  senseBits?: number;
  senseBody?: Buffer;
  senseSchemaBound: boolean;
  // The guest sensor's sense state sequence. Keep 0: nonzero must be
  // monotonic or KeBugCheck.
  senseStateSequence?: number;
}

export interface SensorAuthUpdateFields {
  activityTime?: number;
  authorityMachine?: Buffer | null;
  bubbleCount?: number;
  // The leading u8 (see buildSensorAuthUpdateRsat).
  domain?: number;
  emptyBubbles?: readonly number[];
  // First bit of the update. Keepalives send 0, skipping the 65-slot apply; 1
  // with empty slots still demotes every bubble.
  hasAuthorityTable?: boolean;
  // Only these bubbles + domain are promoted. Unset grants every non-empty
  // slice.
  occupiedBubbles?: readonly number[];
  // Empty authority table: the guest's promote flag stays false and its
  // Type-1 walk never reaches the apply.
  promoteNone?: boolean;
  // 808044E1 seq. Must change vs stored or the promote is skipped.
  promoteSeq?: number;
  senseEntries?: readonly SensorAuthSenseEntry[];
}

export interface FinishedBits {
  bitCount: number;
  bytes: Buffer;
}

// Ticks per second the Timer client divides by.
export const ACTIVITY_TICKS_PER_SECOND = 30;

// The predicate vec is 8 elements wide (80800E44), so the 4-bit count can
// encode more than the client can index. Anything past 8 is dropped rather
// than sent, the same ceiling SquadRoster has.
export const MAX_OBJECT_FILTER_PREDICATES = 8;

// Field 0 of the 80802DB0 PlayerObjective auth (3 bits, bias 1). The HUD
// shows a player objective only when the decoded value is non-zero, and
// takes the first such row as the current objective. Banners and sounds play
// when the state changes: a mission line plays incoming, active and
// complete, a public-event line (definition kind 1) available, engaged,
// success and failure. Decoded -1 (raw 0) is invalid and never sent.
export enum PlayerObjectiveState {
  None = 0,
  Incoming = 1,
  Active = 2,
  Complete = 3,
  Failed = 4,
}

function senseEntryPayloadBits(entry: SensorAuthSenseEntry): number[] {
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
  appendBits(bw, activityHostBuild().sensor.encodeClientRef(entry.clientRef));
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
  // Slot 80800B83 {opt 8-byte machine, opt u16 seq, bool}.
  const stamp =
    machine && machine.length === activityHostBuild().machineIdBytes
      ? machine
      : null;
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
  occupiedBubbles?: readonly number[],
  promoteNone = false
): Set<number> {
  const slots = new Set<number>();
  if (promoteNone) {
    return slots;
  }
  const empty = new Set(emptyBubbles);
  const named = (occupiedBubbles ?? []).filter(
    (bubble) => bubble >= 0 && bubble < bubbleCount && !empty.has(bubble)
  );
  if (named.length > 0) {
    for (const bubble of named) {
      slots.add(bubble);
    }
  } else {
    // The authority table is indexed by slice set, not bubble; the two only
    // coincide where each bubble has one set. A single-bubble activity claims
    // the whole table, or a squad or object authored in another set is never
    // built.
    const limit = bubbleCount <= 1 ? DOMAIN_SLOT : bubbleCount;
    for (let i = 0; i < limit; i++) {
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
    : DEFAULT_PLAYER_KEY;
}

// PlayerAuth.key is the identity the guest's spawn gate byte-compares against
// its local player (the 8 player-identifier bytes, not the character id).
// Falls back to the character rule before a join.
export function playerKeyFromIdentity(
  identity?: Pick<AhClientIdentity, "character" | "player">
): bigint {
  if (
    identity?.player?.length === 8 &&
    !identity.player.every((b) => b === 0)
  ) {
    return identity.player.readBigUInt64BE(0);
  }
  return playerKeyFromCharacter(identity?.character);
}

export function entryOn(
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
        fields.occupiedBubbles,
        fields.promoteNone
      )
    : new Set<number>();
  const machine = fields.authorityMachine ?? null;
  const entries = fields.senseEntries ?? [];

  const bw = new BitWriter(32768);
  // The update leads with a u8 the client compares with its world's: the
  // membership PAH block's 80800BF9 member 0, which we send 0. On a mismatch
  // the sense rows are dropped; without it every later field is read 8 bits
  // early.
  if (activityHostBuild().sensor.leadsWithDomain) {
    bw.write((fields.domain ?? 0) & 0xff, 8);
  }
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

// A reader past a SensorAuth update's leading domain byte (when the build's
// has one), at the authority table bit.
export function sensorAuthReader(update: Buffer): BitReader {
  const br = new BitReader(update);
  if (activityHostBuild().sensor.leadsWithDomain) {
    br.readNumber(8);
  }
  return br;
}

// An activity's binder rows: its global bundle with the lifetime (type 16,
// auth 808008A3, no sense schema) and the player rows (type 12, auth
// 808022A5, sense 80802C30). The Tower's is tower_common (lifetime row 2,
// players[0..29] rows 4..33), the strikes' portal_common (lifetime row 3,
// players[0..15] rows 4..19).
interface BinderRows {
  bundle: number;
  lifetime: number;
  players: readonly number[];
}

// The 808008A3 Lifetime: its state (4 bits) and five members (i32, i32, u32,
// bool, f32; sent 0). The running state is 3: the client's spawn predicate
// accepts only 3.
//
// A story activity's lifetime also names its running phase: its index, fnv1 of
// the Phase row's name and a bubble of unknown meaning (act_cosmo_m0_highway:
// [3] 0..6, [4] fnv1("cosmo_m0_phase00_highway_intro").., [5] 14, 3, 12, 13).
// The client picks each bubble's state from the phase hash and swaps to it
// itself. Without a phase the members keep the values sent so far.
export interface LifetimePhase {
  bubble: number;
  hash: number;
  index: number;
}

// The lifetime's last five members: a per-instance number (new each activity),
// -1, the empty hash, then whether the clients' time of day is locked and its
// fraction of the day. act_cosmo_m0_highway has true / 0.77 (later 0.025);
// cine_reveal and the Tower false / 0.
export interface LifetimeTail {
  instance: number;
  timeOfDay: number;
  timeOfDayLocked: boolean;
}

// A player row's occupant (808022A5): the character in the membership slot the
// row stands for (players[slot]) and the state its client reports for itself
// in the row's sense (80800540), which the real server's host takes over as the
// row's authority. The key / faction / activity flags are in 80800646; the
// other sense fields are sent zero.
export interface PlayerOccupant {
  key: bigint;
  state?: ReportedPlayerState;
  // The sense's second member (80802619), adopted the same way.
  state2?: ReportedPlayerState;
}

export interface PlayerRowsState {
  // The activity flags the scripts have raised (`_activity_flag:activate()`),
  // on every player row occupied or not (cosmo_portal_1 writes the scan's flag
  // into all 16 rows as the objective goes active and takes it out as it
  // clears). An interactable's players-with-flag filter reads them.
  activityFlags?: readonly number[];
  // Set once a cinematic has played in the activity (true name unknown).
  // 2.3.1 capture: act_cosmo_m0_highway sets identity [1] to 1 on all 16
  // player rows, and the occupant's state [3], in the update that starts the
  // intro cinematic, and keeps them.
  cinematic?: boolean;
  // Membership slot -> occupant.
  occupants: ReadonlyMap<number, PlayerOccupant>;
}

export interface SquadAuthFields {
  bindingGeneration: number;
  carrierCargo?: boolean;
  epoch?: number;
  killPolicy?: boolean;
  // The Objective the squad fights for (ref0), when the scripts gave it one.
  objective?: { bundle: number; typeIndex: number };
  // The activity tick the squad was last placed or respawned ([6]). It moves
  // with every placement; a respawn the client sees with an unchanged one
  // spawns nobody.
  placedAt?: number;
  // Per-cell anonymous bodies, one cell per squad definition member.
  roster: readonly number[];
  // The index of the objective's task the squad is linked under ([10]), and
  // the task's own +0xC beside it ([9]).
  task?: number;
  taskInfluencer?: number;
  temperaments?: readonly number[];
}

export interface ActorAuthFields {
  behaviour?: {
    // The perception overrides (bit 0 blind, bit 1 deaf) and the bits the
    // host sets at all.
    awarenessFlags: number;
    awarenessMask: number;
    channels?: readonly { id: number; values: readonly number[] }[];
    generation: number;
    temperaments?: readonly number[];
  };
  carried?: boolean;
  drop?: { dropId: number; refs: readonly SensorClientRefFields[] };
  // [0] on a placement, when the kill epoch is not using the member: the
  // 2.3.1 capture sends 1 with every place (true name unknown).
  incarnation?: number;
  kill?: { epoch: number };
  place: boolean;
  // execute(): a command script from a fresh cookie, its atoms whole.
  script?: {
    atoms: readonly CommandScriptAtom[];
    cookie: number;
    pc?: number;
  };
}

// A waypoint: where, the bubble it is in, and the NavPoint row it came from.
export interface ObjectiveNavPoint {
  ref?: SensorClientRefFields;
  sliceSet?: number;
  x: number;
  y: number;
  z: number;
}

export interface PlayerObjectiveFields {
  navPoints?: readonly ObjectiveNavPoint[];
  participants?: number;
  progress?: { max: number; min: number };
  progressRef?: SensorClientRefFields;
  state: PlayerObjectiveState;
  tier?: number;
}

// 808007D9, the Object auth: {generation, present, ref, components}; present
// alone creates and deletes the object.
// A device the scripts have driven (set_device_position): the position and its
// stamp, which the client applies when it is higher than the one it holds. The
// power stays 1.0, as every captured device component carries it.
export interface ObjectDevice {
  position: number;
  stamp: number;
}

// The mission-interactable component (ObjectInteractableComponent):
// who may use the object. `enabled` false with a filter is "the players the
// filter admits" (2.3.1 capture: the hack console), true with none is
// everyone (the weapon chest). `used` is the trailing latch; unset is the idle
// {0, false} a fresh client never re-applies.
export interface ObjectInteractable {
  enabled: boolean;
  filter?: SensorClientRefFields;
  used?: { stamp: number; value: boolean };
}

// An ObjectFilter predicate: one row, every member of a squad, the combatants
// of a type, the players on a team or the players holding an activity flag.
// `remove` takes the matches out of the result so far. A build encodes the
// classes it has a schema for and leaves the rest out.
export type ObjectFilterItem =
  | { kind: "row"; item: SensorClientRefFields; remove?: boolean }
  | { kind: "squadMembers"; item: SensorClientRefFields; remove?: boolean }
  | { kind: "combatantType"; typeNameHash: number }
  | { kind: "playersOnTeam"; teamIndex: number }
  | { kind: "activityFlag"; flag: number };

export interface MachineFields {
  cues?: readonly number[];
  performance?: { generation: number; name: number };
}

// What a client reports of its own player row (a build's own value).
export type ReportedPlayerState = Readonly<Record<string, unknown>>;

// Each row's body is in the build's layout.
export const encodeActorAuth = (fields: ActorAuthFields) =>
  activityHostBuild().sensor.encodeActor(fields);
export const encodeCinematicAuth = (
  generation: number,
  startTick?: number,
  skippedBy?: readonly bigint[]
) =>
  activityHostBuild().sensor.encodeCinematic(generation, startTick, skippedBy);
export const encodeHopOnAuth = (filter?: SensorClientRefFields) =>
  activityHostBuild().sensor.encodeHopOn(filter);
export const encodeLifetimeAuth = (
  state?: number,
  joinFlag?: boolean,
  phase?: LifetimePhase,
  tail?: LifetimeTail
) => activityHostBuild().sensor.encodeLifetime(state, joinFlag, phase, tail);
export const encodeLootAuth = (enabled?: boolean, epoch?: number) =>
  activityHostBuild().sensor.encodeLoot(enabled, epoch);
export const encodeObjectAuth = (
  generation: number,
  present: boolean,
  device?: ObjectDevice,
  interactable?: ObjectInteractable
) =>
  activityHostBuild().sensor.encodeObject(
    generation,
    present,
    device,
    interactable
  );
export const encodeObjectFilterAuth = (items?: readonly ObjectFilterItem[]) =>
  activityHostBuild().sensor.encodeObjectFilter(items);
export const encodeObjectiveAuth = (
  slots?: readonly (number | undefined)[],
  resetGeneration?: number
) => activityHostBuild().sensor.encodeObjective(slots, resetGeneration);
export const encodePlayerAuth = (
  occupant: PlayerOccupant | undefined,
  cinematic?: boolean,
  faction?: number,
  activityFlags?: readonly number[]
) =>
  activityHostBuild().sensor.encodePlayer(
    occupant,
    cinematic,
    faction,
    activityFlags
  );
export const encodePlayerMonitorAuth = (filter?: SensorClientRefFields) =>
  activityHostBuild().sensor.encodePlayerMonitor(filter);
export const encodePlayerObjectiveAuth = (fields: PlayerObjectiveFields) =>
  activityHostBuild().sensor.encodePlayerObjective(fields);
export const encodePlayerTriggerAuth = (enabled: boolean, armStamp: number) =>
  activityHostBuild().sensor.encodePlayerTrigger(enabled, armStamp);
export const encodeSequenceAuth = (
  play?: { playingId: number; startTick: number },
  pairs?: readonly { name: number; value: number }[],
  source?: SensorClientRefFields
) => activityHostBuild().sensor.encodeSequence(play, pairs, source);
export const encodeSquadAuth = (fields: SquadAuthFields) =>
  activityHostBuild().sensor.encodeSquad(fields);
export const encodeTimerAuth = (run?: {
  progressBar?: boolean;
  rate?: number;
  seconds: number;
  startTick: number;
}) => activityHostBuild().sensor.encodeTimer(run);

// A build without TriggerGroup or Machine rows has no such body, and no row
// to put one on.
export function encodeTriggerGroupAuth(
  volume?: SensorClientRefFields,
  state?: number
): FinishedBits {
  const encode = activityHostBuild().sensor.encodeTriggerGroup;
  if (!encode) {
    throw new Error("this build has no TriggerGroup rows");
  }
  return encode(volume, state);
}

export function encodeMachineAuth(fields?: MachineFields): FinishedBits {
  const encode = activityHostBuild().sensor.encodeMachine;
  if (!encode) {
    throw new Error("this build has no Machine rows");
  }
  return encode(fields);
}

// The occupant a Player row is sent with: the member in its membership slot.
// A build whose rows all carry the local player's key gives an empty slot the
// key of the member in the lowest one.
export function rowOccupant(
  occupants: ReadonlyMap<number, PlayerOccupant>,
  slot: number
): PlayerOccupant | undefined {
  const held = occupants.get(slot);
  if (held || !activityHostBuild().applyLayout.keysEveryPlayerRow) {
    return held;
  }
  return occupants.get(Math.min(...occupants.keys()));
}

// The binder's rows for a join grant or a world entry: the lifetime, then
// the player rows, players[slot] keyed with the member in that membership
// slot and the rest empty. Every row carrying the same key makes the client
// sense all 16 rows as its own. A grant can carry the first player row only.
export function buildBinderSenseEntries(
  binder: BinderRows,
  players: PlayerRowsState,
  lifetime: FinishedBits = encodeLifetimeAuth(),
  firstPlayerOnly = false
): SensorAuthSenseEntry[] {
  return [
    entryOn(
      binder.bundle,
      activityBundleItemType().Lifetime,
      binder.lifetime,
      lifetime,
      false
    ),
    ...binder.players
      .slice(0, firstPlayerOnly ? 1 : undefined)
      .map((index, slot) =>
        entryOn(
          binder.bundle,
          activityBundleItemType().Player,
          index,
          encodePlayerAuth(
            rowOccupant(players.occupants, slot),
            players.cinematic,
            0,
            players.activityFlags
          ),
          true
        )
      ),
  ];
}

// A sensor the client builds for a row, with the schemas its host definition
// names (src/content).
interface ApplySensor {
  auth: number;
  bundle: number;
  // Goes out as its ref alone (ApplyLayout.fillsBundleSlots).
  hollow?: boolean;
  // The row's idle body when its schema's zero auth is not it (a trigger
  // group refs the volume it watches).
  idle?: FinishedBits;
  sense?: number;
  typeId: number;
  typeIndex: number;
}

const binderRowTypes = (): ReadonlySet<number> =>
  new Set([activityBundleItemType().Lifetime, activityBundleItemType().Player]);

const entryKey = ({ clientRef: ref }: SensorAuthSenseEntry) =>
  `${ref.bundle >>> 0}:${ref.typeId}:${ref.typeIndex}`;

// A world's apply: the binder rows (on world entry), then every sensor the
// world builds in the bubble. The client's sensor client applies nothing, the
// binder rows included, until each sensor whose host definition has an auth
// schema has had an initial auth. Most have no values, so they get that schema
// with every member zero or absent (ZERO_AUTH); `scripted` rows (what the
// scripts have written) replace their zero auths.
export function buildApplySenseEntries(options: {
  binder?: BinderRows;
  // The binder's lifetime as it stands (the scripts' state and phase).
  lifetime?: FinishedBits;
  players: PlayerRowsState;
  scripted?: readonly SensorAuthSenseEntry[];
  sensors: readonly ApplySensor[];
}): SensorAuthSenseEntry[] {
  const written = new Map(
    (options.scripted ?? []).map((entry) => [entryKey(entry), entry])
  );
  const rows = options.binder
    ? buildBinderSenseEntries(options.binder, options.players, options.lifetime)
    : [];
  const sent = new Set(rows.map(entryKey));
  // A public world's own players (public_common's sixteen, on the public host)
  // need their initial auth like any other sensor, or the world never applies.
  // They carry the same occupants as the binder's, slot by slot in row order.
  const playerSlots = new Map<string, number>();
  for (const sensor of options.sensors
    .filter(
      (s) =>
        s.typeId === activityBundleItemType().Player &&
        s.bundle !== options.binder?.bundle
    )
    .sort((a, b) => a.bundle - b.bundle || a.typeIndex - b.typeIndex)) {
    const bundle = `${sensor.bundle >>> 0}`;
    const slot = [...playerSlots.keys()].filter((k) =>
      k.startsWith(`${bundle}:`)
    ).length;
    playerSlots.set(`${bundle}:${sensor.typeIndex}`, slot);
  }
  const hollowKeys = new Set<string>();
  for (const sensor of options.sensors) {
    const key = `${sensor.bundle >>> 0}:${sensor.typeId}:${sensor.typeIndex}`;
    if (sensor.hollow) {
      if (!sent.has(key)) {
        sent.add(key);
        hollowKeys.add(key);
        rows.push({
          authSchemaBound: false,
          clientRef: {
            bundle: sensor.bundle,
            typeId: sensor.typeId,
            typeIndex: sensor.typeIndex,
          },
          senseSchemaBound: false,
        });
      }
      continue;
    }
    const slot = playerSlots.get(`${sensor.bundle >>> 0}:${sensor.typeIndex}`);
    if (
      sensor.typeId === activityBundleItemType().Player &&
      slot !== undefined &&
      !sent.has(key)
    ) {
      sent.add(key);
      rows.push(
        entryOn(
          sensor.bundle,
          activityBundleItemType().Player,
          sensor.typeIndex,
          encodePlayerAuth(
            rowOccupant(options.players.occupants, slot),
            options.players.cinematic,
            0,
            options.players.activityFlags
          ),
          true
        )
      );
      continue;
    }
    // The lifetime and the binder's players only ever carry the binder's
    // values: a zero lifetime is state 0, and the spawn waits for 3.
    if (binderRowTypes().has(sensor.typeId) || sent.has(key)) {
      continue;
    }
    sent.add(key);
    // A missing body leaves the row out rather than ending the process: the
    // client then holds the apply, which the log says why.
    const body =
      sensor.idle ?? activityHostBuild().sensor.idleAuth(sensor.auth);
    if (!body) {
      continue;
    }
    rows.push(
      entryOn(
        sensor.bundle,
        sensor.typeId,
        sensor.typeIndex,
        body,
        sensor.sense !== undefined
      )
    );
  }
  return rows.map((entry) =>
    hollowKeys.has(entryKey(entry))
      ? entry
      : (written.get(entryKey(entry)) ?? entry)
  );
}

// The same update without its sense rows: the authority section and the
// activity time as they were, then an empty row list. Bring-up sends this while
// the sensor types are not mapped: a row built for the wrong type would be
// decoded with the schema the client resolves from the row's own type.
export function withoutSenseRows(update: Buffer): Buffer {
  const br = new BitReader(update);
  const bw = new BitWriter(4096);
  const copy = (bits: number) => {
    for (let i = 0; i < bits; i++) {
      bw.writeBit(br.readBit());
    }
  };
  if (activityHostBuild().sensor.leadsWithDomain) {
    copy(8);
  }
  const hasTable = br.readBit();
  bw.writeBit(hasTable);
  if (hasTable) {
    copy(AUTHORITY_SLOTS + 1);
    // AuthorityTable: opt i32, then 65 x {opt machine, opt u16, bool}.
    const hasI32 = br.readBit();
    bw.writeBit(hasI32);
    if (hasI32) {
      copy(32);
    }
    for (let i = 0; i < AUTHORITY_SLOTS; i++) {
      const hasMachine = br.readBit();
      bw.writeBit(hasMachine);
      if (hasMachine) {
        copy(activityHostBuild().machineIdBytes * 8);
      }
      const hasSeq = br.readBit();
      bw.writeBit(hasSeq);
      if (hasSeq) {
        copy(16);
      }
      copy(1);
    }
  }
  copy(32);
  bw.writeBit(0);
  return bw.finish();
}

// Keepalive: `hasAuth=0` + activity time + no sense rows.
export function buildSensorAuthTickRsat(activityTime = 0): Buffer {
  return buildSensorAuthUpdateRsat({
    activityTime,
    hasAuthorityTable: false,
  });
}

// Promote-only update: the join grant's authority table again (same slots, same
// sequence) with no sense rows. The real server sends one right after every
// state refresh, between GAS/WGS and the client-auth reply: the guest recreates
// its sensor client on the world transition and discards every update until one
// arrives with the table bit set.
export function buildSensorAuthPromoteRsat(opts: {
  activityTime?: number;
  authorityMachine?: Buffer | null;
  scenario?: ScenarioClient;
  // Bubbles to promote. Undefined promotes every non-empty bubble.
  slices?: readonly number[];
  promoteSeq?: number;
}): Buffer {
  return buildSensorAuthUpdateRsat({
    activityTime: opts.activityTime,
    authorityMachine: opts.authorityMachine,
    bubbleCount: opts.scenario?.bubbleCount,
    emptyBubbles: opts.scenario?.emptyBubbles,
    hasAuthorityTable: true,
    occupiedBubbles: opts.slices,
    promoteSeq: opts.promoteSeq,
  });
}

// Which world a row's object lives in. The guest asserts when a row is
// applied by an activity client whose world is not the object's: the
// binder bundle and player-scoped rows sit in the private (FAH) world,
// everything else in the world that owns the bubble, which for a public
// bubble is the GAH's. "none" = an empty apply.
export type ApplyScope = "all" | "none" | "private" | "public";
