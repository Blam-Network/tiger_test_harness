import type { BitReader, RsatSchema } from "@blamnetwork/rsat";
import type { ParsedJoinRequest } from "../join";
import type {
  ClientEcho,
  HostHardWipe,
  PahRow,
  ParsedMembership,
  ReplicateMember,
  Teleport,
} from "../rsat/membership";
import type {
  ActorAuthFields,
  FinishedBits,
  LifetimePhase,
  LifetimeTail,
  MachineFields,
  ObjectDevice,
  ObjectFilterItem,
  ObjectInteractable,
  PlayerObjectiveFields,
  PlayerOccupant,
  ReportedPlayerState,
  SensorClientRefFields,
  SquadAuthFields,
} from "../rsat/sensor-auth-fields";
import type { SenseReport } from "../rsat/sensor-sense";

// What the build-neutral activity host code uses of a build's wire. Schemas
// register themselves by id when the build's loader defines them, so they are
// reached through activityHostBuild(), never imported by neutral code. A
// build without a feature leaves the member out or states it false.

// The two headers framing activity host notifications, as bytes.
interface NotificationHeader<Fields> {
  read(body: Buffer): Fields & { length: number };
  size: number;
  write(fields: Fields & { length: number }): Buffer;
}

export interface NotificationHeaders {
  // Client -> AH (wire 8). The session id is the frame's.
  clientToHost: NotificationHeader<{
    kind: number;
    sessionId: bigint;
    variant: number;
  }>;
  // AH -> client (wire 0x64).
  hostToClient: NotificationHeader<{
    kind: number;
    sessionId: bigint;
    variant: number;
  }>;
}

interface JoinResultFields {
  keepaliveIntervalMs: number;
  recentWindowMs: number;
  replicationEpoch: number;
  // The text a session shows for its id.
  sessionDisplay(id: bigint): string;
}

export interface JoinWire {
  // Throws on bytes that are not a join request.
  decodeRequest(payload: Buffer): ParsedJoinRequest;
  encodeRequest(fields: ParsedJoinRequest): Buffer;
  // The join result echoing a request; members a build's result lacks are
  // left out.
  encodeResult(requestPayload: Buffer, fields: JoinResultFields): Buffer;
}

// The activity host manager start request: fixed sizes and the schemas of its
// options message and player-configuration bitstream.
interface StartRequestSchemas {
  ActivityHostStartupOptionsRequest: RsatSchema<{
    readonly activityId: number;
    readonly ipValid: boolean;
    readonly unknown1: boolean;
  }>;
  START_REQUEST_OPTIONS_CAPACITY: number;
  START_REQUEST_PAYLOAD_SIZE: number;
  START_REQUEST_STREAM_CAPACITY: number;
  START_REQUEST_STREAM_OFFSET: number;
  START_REQUEST_STREAM_SIZE_OFFSET: number;
  StartRequestStream: RsatSchema<{
    readonly unknown0: number;
    readonly unknown1: number;
    readonly activity: { readonly activityId: number; readonly ip: number };
    readonly slot0: { readonly bytes: number[] };
    readonly slot1: { readonly bytes: number[] };
    readonly slot2: { readonly bytes: number[] };
    readonly slot3: { readonly bytes: number[] };
    readonly fireteam: {
      readonly members: {
        readonly machine: Uint8Array;
        readonly player: Uint8Array;
        readonly account: bigint;
        readonly character: bigint;
      }[];
    };
    readonly machine: Uint8Array;
  }>;
}

export interface ClientTransitionRegion {
  regionId: number;
  unknown1: number;
}

// What the host reads of a client's slice-set transition.
export interface ClientTransition {
  current?: ClientTransitionRegion;
  pending?: ClientTransitionRegion;
  phase?: number;
  // The teleportation id the client is synchronising on.
  props?: number;
  token?: number;
}

// The client's teleportation: its state (0 inactive, 1 accepted, 2 transition
// requested, 3 completed) and the target it accepted.
export interface ClientTeleport {
  id: number;
  region: number;
  state: number;
}

// The client's hard wipe (class 21): its state (0 a wipe seen, 1 showing the
// screen, 2 waiting on the host, 3 completed), the cookie it is handling and
// the activity tick it saw it at.
interface ClientHardWipeBase {
  currentCookie: number;
  startTime: number;
  state: number;
}

// A build whose client also keeps the last cookie it completed reports it.
// A build without it has a report with no such member, so nothing can read
// one off it.
export type ClientHardWipe =
  | ClientHardWipeBase
  | (ClientHardWipeBase & { lastCookie: number });

// The steps of a hard wipe the host walks: idle, wiping (the clients put up
// their screens), complete (the world is reset, the clients come back).
export type HardWipePhase = "complete" | "idle" | "wiping";

// How a build's clients and host run a hard wipe. The alpha's and TU0's
// handshakes differ, so each build states its own; nothing is shared between
// them but the steps.
export interface HardWipeRules {
  // The client's report says it has completed the wipe of this cookie.
  completed(report: ClientHardWipe, cookie: number): boolean;
  // The host's nest in a step of the wipe `cookie`, `completed` being the
  // cookie of the last wipe that finished.
  nest(phase: HardWipePhase, cookie: number, completed: number): HostHardWipe;
  // The cookie of the wipe after the one at `cookie`.
  nextCookie(cookie: number): number;
  // The client's report says its screen is up and it waits on the host.
  screenUp(report: ClientHardWipe, cookie: number): boolean;
}

export interface ClientAuthReport {
  anyUpdate: boolean;
  // The members a build echoes back in the membership slot, as it decoded
  // them.
  echo?: {
    identity?: ClientEcho;
    teleport?: ClientEcho;
    transition?: ClientEcho;
  };
  hardWipe?: ClientHardWipe;
  teleport?: ClientTeleport;
  transition?: ClientTransition;
}

export interface ClientReportsWire {
  // The identity echo in log form.
  describeIdentity(identity: ClientEcho): string;
  // Class 21 client_authoritative_data_update; undefined when the delta does
  // not decode.
  parse(payload: Buffer): ClientAuthReport | undefined;
}

// The global activity state a build encodes, with every member decided.
interface GlobalActivityStateValues {
  activityChecksum: number;
  activityId: number;
  activityName: string | undefined;
  bubbleCount: number;
  bubbleStates: readonly number[];
  initialSlice: number;
  instanceId: bigint;
  spawnTransitionName: number;
  // A build whose client keeps its own day length ignores this.
  worldServerTime: bigint;
}

export interface GlobalActivityStateWire {
  encodeGlobalActivityState(
    fields: GlobalActivityStateValues & { unknown6: number }
  ): Buffer;
  encodeWorldGlobalsState(tickMs: number): Buffer;
}

interface MembershipValues {
  generation: number;
  // The host's hard wipe; none sends the idle zeros.
  hardWipe?: HostHardWipe;
  members: readonly ReplicateMember[];
  occupiedMask: number;
  rows: readonly PahRow[];
  teleport?: Teleport;
}

export interface MembershipWire {
  // Throws on a membership the build cannot state.
  decode(payload: Buffer): ParsedMembership | null;
  // A membership slot keeps its member's own client data (class 21).
  echoesClientData: boolean;
  // The class 11 body, presence bit included.
  encode(values: MembershipValues): Buffer;
  // The PAH rows of an all-private activity differ from the public ones.
  privateActivityRows: boolean;
}

// How a row's sense is read: a build's schema for it decides.
export interface SenseWire {
  actorBound(sense: unknown): { unknown9: boolean; unknown10: boolean };
  // The command script an Actor row runs: the PC it has reached, the cookie
  // it runs and the heartbeat it keeps, absent when the update did not carry
  // it. A build whose sense has none leaves this out.
  actorCommandScript?(
    sense: unknown
  ):
    | { cookieRunning?: number; heartbeat?: number; pcReached?: number }
    | undefined;
  // The drop an Actor row has taken: its id (absent when unchanged) and
  // whether it is still under way.
  actorDrop?(sense: unknown): { dropId?: number; inProgress: boolean };
  // The decoded sense of a row: its schema, found by id.
  decoders: ReadonlyMap<number, { decode(br: BitReader): unknown }>;
  // A Health row's current and maximum health, -1 for both when the bound
  // ref has not resolved.
  health?(sense: unknown): { current: number; max: number };
  // An Object row's mission-interactable latch: whether it has been used,
  // and the stamp of the use. Absent without the component.
  interactable?(
    sense: unknown
  ): { used: boolean; usedStamp: number } | undefined;
  // A SensorSense update leads with a u8 the build reads and drops.
  leadsWithByte: boolean;
  monitorCount(sense: unknown): number;
  // An Object row's "live, operate on it" flag.
  objectAlive?(sense: unknown): boolean;
  // An Object row's device as the client holds it: the position and the
  // stamp of the last write it took. Absent without the component.
  objectDevice?(
    sense: unknown
  ): { position: number; positionStamp: number } | undefined;
  // A Player row's report of its own state, which the host adopts.
  playerReport(sense: unknown): SenseReport | undefined;
  // Reads one row's client ref.
  readClientRef(br: BitReader): SensorClientRefFields;
  // A row whose body can't be read is skipped by finding the next row header,
  // rather than ending the walk.
  resyncs: boolean;
  // Members at the firing area, absent when the update did not carry it.
  squadAlive(sense: unknown): number | undefined;
  // The per-cell death tally of the squad's epoch, absent when the update
  // did not carry it.
  squadTally(sense: unknown): number[] | undefined;
}

export interface SensorWire {
  encodeActor(fields: ActorAuthFields): FinishedBits;
  encodeCinematic(
    generation: number,
    startTick?: number,
    skippedBy?: readonly bigint[]
  ): FinishedBits;
  encodeClientRef(ref: SensorClientRefFields): FinishedBits;
  // The hard_wipe_globals row (type 34): whether a hard wipe is armed, for a
  // build that can say so; the alpha's row has no such flag and stays idle.
  encodeHardWipeGlobals(enabled: boolean): FinishedBits;
  encodeHopOn(filter?: SensorClientRefFields): FinishedBits;
  encodeLifetime(
    state?: number,
    joinFlag?: boolean,
    phase?: LifetimePhase,
    tail?: LifetimeTail
  ): FinishedBits;
  encodeLoot(enabled?: boolean, epoch?: number): FinishedBits;
  // Absent in a build without Machine rows.
  encodeMachine?(fields?: MachineFields): FinishedBits;
  encodeObject(
    generation: number,
    present: boolean,
    device?: ObjectDevice,
    interactable?: ObjectInteractable
  ): FinishedBits;
  encodeObjectFilter(items?: readonly ObjectFilterItem[]): FinishedBits;
  encodeObjective(
    slots?: readonly (number | undefined)[],
    resetGeneration?: number
  ): FinishedBits;
  // A Passenger row (type 37): its cookie and the Actor row it seats, unset
  // when it seats nobody. Absent in a build without Passenger rows.
  encodePassenger?(
    cookie: number,
    binding?: SensorClientRefFields
  ): FinishedBits;
  encodePlayer(
    occupant: PlayerOccupant | undefined,
    cinematic?: boolean,
    faction?: number,
    activityFlags?: readonly number[]
  ): FinishedBits;
  encodePlayerMonitor(filter?: SensorClientRefFields): FinishedBits;
  encodePlayerObjective(fields: PlayerObjectiveFields): FinishedBits;
  encodePlayerTrigger(enabled: boolean, armStamp: number): FinishedBits;
  encodeSequence(
    play?: { playingId: number; startTick: number },
    pairs?: readonly { name: number; value: number }[],
    source?: SensorClientRefFields
  ): FinishedBits;
  encodeSquad(fields: SquadAuthFields): FinishedBits;
  encodeTimer(run?: {
    progressBar?: boolean;
    rate?: number;
    seconds: number;
    startTick: number;
  }): FinishedBits;
  // Absent in a build without TriggerGroup rows.
  encodeTriggerGroup?(
    volume?: SensorClientRefFields,
    state?: number
  ): FinishedBits;
  // The body for a row the host has not written: its schema's idle form, or
  // undefined (and reported) for a schema the build has no body for.
  idleAuth(schema: number): FinishedBits | undefined;
  // A SensorAuth update leads with a u8: the replication domain the client
  // compares with its world's.
  leadsWithDomain: boolean;
  // The lifetime's wire states: the scripts' states plus `shift`, and the
  // ones the host sends itself (none before the scripts set one, the pregame
  // that holds the spawn, the running state the spawn waits for, ended).
  lifetimeStates: {
    active: number;
    ended: number;
    none: number;
    pregame: number;
    shift: number;
  };
  // Two players' reported states are the same state.
  samePlayerState(
    a: ReportedPlayerState | undefined,
    b: ReportedPlayerState
  ): boolean;
  sense: SenseWire;
  // A player's second reported state (the sense's respawn request, where a
  // build has one) as the host echoes it while a hard wipe runs: the request
  // is not granted, for the wipe respawns everyone itself. A build that
  // adopts no player sense states it as it is.
  withholdRespawn(
    state2: ReportedPlayerState | undefined
  ): ReportedPlayerState | undefined;
}

// The bodies a host answers a client's handed-back entity slots with.
export interface EntitySlotsWire {
  // A purge goes out under the epoch one past the claim's, rather than the
  // claim's own.
  advancesEpochOnPurge: boolean;
  // The class 23 claim of a slot bitmap (the 1536 bytes of an abdicate or
  // abandon), under an epoch.
  claim(epoch: number, bitmap: Buffer): Buffer;
  // The class 24 purge answering a class 26 request, under an epoch.
  purge(epoch: number, request: Buffer): Buffer;
}

export interface IncidentWire {
  // The names a class 18 incident carries and the bit its metadata blob
  // starts at; undefined when they do not decode.
  readNames(
    payload: Buffer
  ): { metadataBit: number; names: readonly number[] } | undefined;
}

// Where a build's join grant and world entry are laid out differently.
interface ApplyLayout {
  // The slice set -1 sensors of the bundles the other bubbles load are built
  // in every bubble of a private world.
  activityWideSensors: boolean;
  // The guest walks a bundle's sensor slots in index order and drops the rest
  // of an update at the first slot it lacks. Every sensor of a loaded bundle
  // goes out, and one that places entities (a squad, an actor, an object) in
  // a slice set the guest has not loaded goes out hollow: its ref and no body.
  fillsBundleSlots: boolean;
  // Every Player row carries the local player's key, whoever holds its slot.
  keysEveryPlayerRow: boolean;
  // The join grant of an activity with a binder follows its grant mode: the
  // public host of a minimal-grant activity gets no authority table, and
  // both hosts' grants carry the first Player row only.
  minimalBinderGrant: boolean;
  // A world entry or slice-set swap is its rows alone, with no rowless apply
  // ahead of them.
  rowsOnlyApply: boolean;
  // The client takes a squad auth's objective, task and task influencer only
  // when its binding generation moves, so any change to them bumps it. Without
  // it a squad first placed under the idle auth's generation 1 keeps no task
  // and stands at its spawn.
  squadBindingByGeneration?: boolean;
  // A squad no script has written goes out with a roster cell per definition
  // member and the Objective the scripts' @objective write.
  squadsAtDefinition: boolean;
}

export interface ActivityHostBuild {
  applyLayout: ApplyLayout;
  clientReports: ClientReportsWire;
  entitySlots: EntitySlotsWire;
  globalActivityState: GlobalActivityStateWire;
  hardWipe: HardWipeRules;
  incidents: IncidentWire;
  join: JoinWire;
  // Bytes in a machine id, as the join, the membership and the authority
  // table carry it.
  machineIdBytes: number;
  membership: MembershipWire;
  notificationHeader: NotificationHeaders;
  sensor: SensorWire;
  startRequest: StartRequestSchemas;
}
