// ItemSink's counterpart: what the bullshcript runtime says about an item, kept
// as the auth body of its row. The rows do not go through SensorRowState; the
// session sends these itself (pushRows, and over the zero auths of a whole
// apply). Squads, actors, player triggers and monitors, sequences, player
// objectives, objects (with a driven device), object filters, hop-ons, trigger
// groups, machines, cinematics and the lifetime have encoders; the other kinds
// are noted once and not sent.
import {
  type ActivityBundleTag,
  type ActorState,
  type ItemChange,
  type ItemRef,
  type ObjectFilterPredicate,
  type SquadState,
} from "@blamnetwork/bullshcript/destiny1/common";
import { type ActivityPhase, watchedVolumeName } from "../../content";
import { activityBundleItemType } from "../../content/row-types";
import type { DebugToggles } from "../../dev-config/debug-toggles";
import { k_empty_name_hash } from "../../utils/name-hash";
import { debugOmitsRowType } from "../debug-start";
import {
  type ActorAuthFields,
  encodeActorAuth,
  encodeCinematicAuth,
  encodeHopOnAuth,
  encodeLifetimeAuth,
  encodeLootAuth,
  encodeMachineAuth,
  encodeObjectAuth,
  encodeObjectFilterAuth,
  encodeObjectiveAuth,
  encodePlayerAuth,
  encodePlayerMonitorAuth,
  encodePlayerObjectiveAuth,
  encodePlayerTriggerAuth,
  encodeSequenceAuth,
  encodeSquadAuth,
  encodeTimerAuth,
  encodeTriggerGroupAuth,
  entryOn,
  type FinishedBits,
  type LifetimePhase,
  type LifetimeTail,
  type ObjectFilterItem,
  type PlayerOccupant,
  type PlayerRowsState,
  type ReportedPlayerState,
  rowOccupant,
  type SensorAuthSenseEntry,
} from "../rsat/sensor-auth-fields";
import { activityHostBuild } from "../versions";

// The wire numbers of the lifetime's states, in the build's numbering.
const lifetimeStates = () => activityHostBuild().sensor.lifetimeStates;

interface ItemSinkOptions {
  lifetimeTail?: LifetimeTail;
  // The activity's phases in lifetime order (the lifetime names the one
  // running).
  phases?: readonly ActivityPhase[];
  // A debug start (debug-toggles.json): the lifetime names this phase from
  // the first apply, and the activity counts as running already.
  startPhaseIndex?: number;
  // An activity that opens in a phase's own bubble state starts nobody: its
  // lifetime starts at none (2.3.1 capture), and the scripts set pregame, not
  // running.
  startsInPhaseState?: boolean;
}

// A row kind's auth body, for the kinds with an encoder. The lifetime
// and cinematics carry state of the sink's own and are encoded there.
function encodeRow(
  change: ItemChange,
  toggles: DebugToggles,
  triggerGroupVolume: (rowKey: string) => ItemRef | undefined
): FinishedBits | undefined {
  switch (change.kind) {
    case "hardWipeGlobals":
      return activityHostBuild().sensor.encodeHardWipeGlobals(
        change.state.enabled
      );
    case "hopOn":
      return encodeHopOnAuth(change.state.filter);
    case "machine":
      return encodeMachineAuth({
        cues: change.state.cues,
        performance: change.state.performance,
      });
    case "object": {
      const { device, interactable } = change.state;
      return encodeObjectAuth(
        change.state.incarnation,
        change.state.present,
        device && { position: device.position, stamp: device.revision },
        interactable
      );
    }
    case "objectFilter":
      return encodeObjectFilterAuth(change.state.predicates.map(filterItem));
    case "playerMonitor":
      return encodePlayerMonitorAuth(change.state.filter);
    case "playerObjective":
      return encodePlayerObjectiveAuth({
        navPoints: toggles.stripNavPoints
          ? undefined
          : change.state.navPoints.map((point) => ({
              ref: point.ref,
              sliceSet: point.sliceSet,
              x: point.x,
              y: point.y,
              z: point.z,
            })),
        participants: change.state.participants,
        progress: change.state.progress,
        progressRef: change.state.progressItem,
        state: change.state.state,
        tier: change.state.tier,
      });
    case "playerTrigger":
      return encodePlayerTriggerAuth(
        change.state.enabled,
        change.state.armedAt
      );
    case "sequence":
      return encodeSequenceAuth(
        change.state.playing && {
          playingId: change.state.playing.id,
          startTick: change.state.playing.startedAt,
        },
        change.state.pairs,
        change.state.target
      );
    case "objective":
      return encodeObjectiveAuth(change.state.slots, change.state.unk1);
    case "loot":
      return encodeLootAuth(change.state.enabled, change.state.epoch);
    case "passenger":
      return activityHostBuild().sensor.encodePassenger?.(
        change.state.state,
        change.state.passenger
      );
    case "timer": {
      const { running } = change.state;
      return encodeTimerAuth(
        running && {
          progressBar: running.progressBar,
          rate: running.rate,
          seconds: running.seconds,
          startTick: running.startedAt,
        }
      );
    }
    case "triggerGroup": {
      const { bundle, typeId, typeIndex } = change.item;
      return encodeTriggerGroupAuth(
        triggerGroupVolume(key(bundle, typeId, typeIndex)),
        change.state.state
      );
    }
    default:
      return;
  }
}

// The predicate as the wire's items have it.
function filterItem(predicate: ObjectFilterPredicate): ObjectFilterItem {
  switch (predicate.kind) {
    case "combatantType":
      return { kind: "combatantType", typeNameHash: predicate.typeNameHash };
    case "playersOnTeam":
      return { kind: "playersOnTeam", teamIndex: predicate.teamIndex };
    case "playersWithActivityFlag":
      return { flag: predicate.flagNameHash, kind: "activityFlag" };
    case "slotObject":
      return { item: predicate.item, kind: "row", remove: predicate.remove };
    case "squadMembers":
      return {
        item: predicate.item,
        kind: "squadMembers",
        remove: predicate.remove,
      };
    default:
      return predicate satisfies never;
  }
}

interface SquadRow {
  bundle: number;
  // One cell per squad definition member.
  cells: number;
  // The squad's named members (the Actor rows after it), in cell order.
  members: readonly number[];
  typeIndex: number;
}

interface SquadWire {
  // Bumped on every epoch or influencer change (SquadAuth's binding
  // generation, see encodeSquadAuth), from 1.
  bindingGeneration: number;
  // A new wave or a kill(): the client drops what the last epoch left.
  epoch?: number;
  killPolicy: boolean;
  state: SquadState;
}

const key = (bundle: number, typeId: number, typeIndex: number) =>
  `${bundle >>> 0}:${typeId}:${typeIndex}`;

// Every trigger group row of the tables -> the TriggerVolume it watches.
function triggerGroupVolumes(
  tags: readonly ActivityBundleTag[]
): Map<string, ItemRef> {
  const volumes = new Map<string, ItemRef>();
  const triggerGroupType = activityBundleItemType().TriggerGroup;
  // A build without trigger group rows has none to map.
  if (triggerGroupType === undefined) {
    return volumes;
  }
  for (const tag of tags) {
    for (const row of tag.rows) {
      if (row.typeId !== triggerGroupType || !row.name) {
        continue;
      }
      const name = watchedVolumeName(row.name);
      const volume = tag.rows.find(
        (candidate) =>
          candidate.typeId === activityBundleItemType().TriggerVolume &&
          candidate.name === name
      );
      if (volume) {
        volumes.set(key(tag.bundle, row.typeId, row.typeIndex), {
          bundle: tag.bundle,
          typeId: volume.typeId,
          typeIndex: volume.typeIndex,
        });
      }
    }
  }
  return volumes;
}

export class ItemSink {
  private readonly squadRows = new Map<string, SquadRow>();
  // The Objective the scripts author a squad against, until one sets another
  // (the script host's @objective).
  private squadObjective: (
    bundle: number,
    typeIndex: number
  ) => { bundle: number; typeIndex: number } | undefined = () => undefined;
  // Actor row -> its squad's row key.
  private readonly ownerOf = new Map<string, string>();
  private readonly squads = new Map<string, SquadWire>();
  private readonly actors = new Map<string, ActorState>();
  // Every other written row's body.
  private readonly bodies = new Map<string, FinishedBits>();
  // Rows whose sensor has a sense schema (the tables' sensors); squads and
  // actors always do.
  private readonly sensed = new Set<string>();
  // The auth schema of every row the tables give one.
  private readonly authSchemas = new Map<string, number>();
  // Rows a hard wipe put back to untouched: they go out as their idle body
  // until the scripts write them again.
  private readonly idle = new Set<string>();
  private readonly refs = new Map<string, ItemRef>();
  private readonly dirty = new Set<string>();
  private readonly unsent = new Set<string>();
  private readonly triggerGroupVolumes: Map<string, ItemRef>;
  private readonly log: (line: string) => void;
  // Cinematic row -> the generation its last auth went out with.
  private readonly cinematicGenerations = new Map<string, number>();
  // Cinematic row -> the start tick of the play under way.
  private readonly cinematicStarts = new Map<string, number>();
  private readonly phases: readonly ActivityPhase[];
  private lifetimeRef: ItemRef | undefined;
  private lifetime: { joinFlag: boolean; state: number };
  private phase: LifetimePhase | undefined;
  // The binder's player rows (players[slot]) and what they carry.
  private playerRefs: ItemRef[] = [];
  private readonly occupants = new Map<number, PlayerOccupant>();
  private cinematicSeen = false;
  // A hard wipe runs: a client's request to respawn is not echoed back as
  // granted.
  private respawnsHeld = false;
  // The activity flags the scripts have raised, in order; every player row
  // carries them (2.3.1 capture: the scan's flag is written to all 16 rows).
  private activityFlags: number[] = [];
  private readonly lifetimeTail: LifetimeTail | undefined;
  // The scripts' time of day (set_time_of_day), over the tail's own.
  private lifetimeTimeOfDay: number | undefined;
  // The activity started in a later phase (a debug start).
  private readonly checkpointStart: boolean;
  private toggles: DebugToggles = {};

  constructor(
    tags: readonly (ActivityBundleTag & {
      sensors?: readonly {
        auth: number;
        sense?: number;
        typeId: number;
        typeIndex: number;
      }[];
    })[],
    log: (line: string) => void,
    options: ItemSinkOptions = {}
  ) {
    this.log = log;
    this.triggerGroupVolumes = triggerGroupVolumes(tags);
    this.phases = options.phases ?? [];
    this.lifetimeTail = options.lifetimeTail;
    this.lifetime = {
      joinFlag: true,
      state: options.startsInPhaseState
        ? lifetimeStates().none
        : lifetimeStates().active,
    };
    this.checkpointStart = (options.startPhaseIndex ?? 0) > 0;
    this.phase = this.phaseAt(options.startPhaseIndex ?? 0);
    for (const tag of tags) {
      for (const sensor of tag.sensors ?? []) {
        const rowKey = key(tag.bundle, sensor.typeId, sensor.typeIndex);
        this.authSchemas.set(rowKey, sensor.auth);
        if (sensor.sense !== undefined) {
          this.sensed.add(rowKey);
        }
      }
      let squad: string | undefined;
      for (const row of tag.rows) {
        const rowKey = key(tag.bundle, row.typeId, row.typeIndex);
        if (row.typeId === activityBundleItemType().Squad) {
          squad = rowKey;
          this.squadRows.set(rowKey, {
            bundle: tag.bundle,
            cells: row.memberCount ?? row.cells?.length ?? 1,
            members: [],
            typeIndex: row.typeIndex,
          });
        } else if (row.typeId === activityBundleItemType().Actor && squad) {
          (this.squadRows.get(squad)?.members as number[]).push(row.typeIndex);
          this.ownerOf.set(rowKey, squad);
        } else {
          squad = undefined;
        }
      }
    }
  }

  setDebugToggles(toggles: DebugToggles): void {
    this.toggles = toggles;
  }

  // Where a squad's Objective comes from before a script sets one.
  bindSquadObjectives(
    objectiveOf: (
      bundle: number,
      typeIndex: number
    ) => { bundle: number; typeIndex: number } | undefined
  ): void {
    this.squadObjective = objectiveOf;
  }

  // The binder's lifetime as it stands: the scripts' state and the running
  // phase. A world entry sends it in place of the zero lifetime.
  lifetimeBody(): FinishedBits {
    const tail = this.lifetimeTail;
    return encodeLifetimeAuth(
      this.lifetime.state,
      this.lifetime.joinFlag,
      this.phase,
      tail && this.lifetimeTimeOfDay !== undefined
        ? { ...tail, timeOfDay: this.lifetimeTimeOfDay, timeOfDayLocked: true }
        : tail
    );
  }

  // The runtime started its phase'th mission: the lifetime names that phase.
  setPhase(index: number): void {
    this.phase = this.phaseAt(index);
    this.lifetimeChanged();
  }

  private phaseAt(index: number): LifetimePhase | undefined {
    const phase = this.phases[index];
    return phase && { bubble: phase.bubble, hash: phase.hash, index };
  }

  private lifetimeChanged(): void {
    if (!this.lifetimeRef) {
      return;
    }
    const rowKey = key(
      this.lifetimeRef.bundle,
      this.lifetimeRef.typeId,
      this.lifetimeRef.typeIndex
    );
    this.bodies.set(rowKey, this.lifetimeBody());
    this.dirty.add(rowKey);
  }

  // The lifetime row, so a phase change can go out before the scripts have
  // written the lifetime themselves.
  bindLifetime(row: ItemRef): void {
    this.lifetimeRef = row;
    this.refs.set(key(row.bundle, row.typeId, row.typeIndex), row);
  }

  bindPlayers(bundle: number, indices: readonly number[]): void {
    this.playerRefs = indices.map((typeIndex) => ({
      bundle,
      typeId: activityBundleItemType().Player,
      typeIndex,
    }));
    for (const row of this.playerRefs) {
      this.refs.set(key(row.bundle, row.typeId, row.typeIndex), row);
    }
  }

  // What the player rows carry: each membership slot's occupant, with the
  // state its client last reported, and whether a cinematic has started.
  players(): PlayerRowsState {
    return {
      activityFlags: this.activityFlags,
      cinematic: this.cinematicSeen,
      occupants: this.visibleOccupants(),
    };
  }

  // The character a player row's slot holds.
  occupantKey(typeIndex: number): bigint | undefined {
    const slot = this.playerRefs.findIndex(
      (row) => row.typeIndex === typeIndex
    );
    return this.occupants.get(slot)?.key;
  }

  // A hard wipe respawns everyone itself, so while it runs no player row says
  // a respawn is granted (the host's echo of the client's request is the
  // grant). The rows go out again when this changes.
  holdRespawns(held: boolean): void {
    if (held === this.respawnsHeld) {
      return;
    }
    this.respawnsHeld = held;
    for (const slot of this.occupants.keys()) {
      this.playerChanged(slot);
    }
  }

  // The occupants as the player rows state them.
  private visibleOccupants(): ReadonlyMap<number, PlayerOccupant> {
    if (!this.respawnsHeld) {
      return this.occupants;
    }
    const { withholdRespawn } = activityHostBuild().sensor;
    return new Map(
      [...this.occupants].map(([slot, occupant]) => [
        slot,
        { ...occupant, state2: withholdRespawn(occupant.state2) },
      ])
    );
  }

  // `_activity_flag:activate()` / `:clear()`: the flag goes on (or off) every
  // player row, which all go out again. cosmo_portal_1 sends the 16 rows with
  // the scan's flag in the update that sets the objective active, and again
  // without it as the objective clears; the console's players-with-flag filter
  // is what makes the scan usable in between.
  setActivityFlag(hash: number, active: boolean): void {
    const flag = hash >>> 0;
    const has = this.activityFlags.includes(flag);
    if (has === active) {
      return;
    }
    this.activityFlags = active
      ? [...this.activityFlags, flag]
      : this.activityFlags.filter((f) => f !== flag);
    for (const slot of this.playerRefs.keys()) {
      this.playerChanged(slot);
    }
  }

  // The members in their slots (membership slot -> character key). A row
  // whose occupant changed goes out again.
  setOccupants(keys: ReadonlyMap<number, bigint>): void {
    const moved: number[] = [];
    for (const slot of this.playerRefs.keys()) {
      const was = this.occupants.get(slot);
      const next = keys.get(slot);
      if (was?.key === next) {
        continue;
      }
      if (next === undefined) {
        this.occupants.delete(slot);
      } else {
        this.occupants.set(slot, { key: next });
      }
      moved.push(slot);
    }
    // A build whose empty rows carry a member's key changes them all.
    const every =
      moved.length > 0 && activityHostBuild().applyLayout.keysEveryPlayerRow;
    for (const slot of every ? this.playerRefs.keys() : moved) {
      this.playerChanged(slot);
    }
  }

  // A client's sense of its own player row: the host adopts it as the row's
  // state, both members (2.3.1 capture: the auth repeats the sense's).
  notePlayerState(
    typeIndex: number,
    state: ReportedPlayerState,
    state2?: ReportedPlayerState
  ): void {
    const slot = this.playerRefs.findIndex(
      (row) => row.typeIndex === typeIndex
    );
    const occupant = this.occupants.get(slot);
    if (
      !occupant ||
      (activityHostBuild().sensor.samePlayerState(occupant.state, state) &&
        JSON.stringify(occupant.state2) === JSON.stringify(state2))
    ) {
      return;
    }
    this.occupants.set(slot, { ...occupant, state, state2 });
    this.playerChanged(slot);
  }

  private playerChanged(slot: number): void {
    const row = this.playerRefs[slot];
    if (!row) {
      return;
    }
    const rowKey = key(row.bundle, row.typeId, row.typeIndex);
    this.bodies.set(
      rowKey,
      encodePlayerAuth(
        rowOccupant(this.visibleOccupants(), slot),
        this.cinematicSeen,
        0,
        this.activityFlags
      )
    );
    this.dirty.add(rowKey);
  }

  // Rows a hard wipe put back to untouched (the host sends the ones it put
  // back to an earlier state as changes): what the scripts wrote is dropped,
  // and each goes out again as its idle body. A cinematic's generation, which
  // only counts up, stays.
  clear(items: readonly ItemRef[]): void {
    for (const { bundle, typeId, typeIndex } of items) {
      const rowKey = key(bundle, typeId, typeIndex);
      this.refs.set(rowKey, { bundle, typeId, typeIndex });
      this.bodies.delete(rowKey);
      this.cinematicStarts.delete(rowKey);
      this.idle.add(rowKey);
      this.dirty.add(rowKey);
    }
  }

  apply(change: ItemChange): void {
    const { bundle, typeId, typeIndex } = change.item;
    const rowKey = key(bundle, typeId, typeIndex);
    this.refs.set(rowKey, { bundle, typeId, typeIndex });
    this.idle.delete(rowKey);
    if (change.kind === "lifetime") {
      this.lifetimeRef = change.item;
      let state = change.state.state + lifetimeStates().shift;
      // A debug start in a later phase has the activity running already: the
      // root script's pregame would hold the spawn (it waits for 3) with
      // nothing behind the player left to set active.
      if (this.checkpointStart && state === lifetimeStates().pregame) {
        state = lifetimeStates().active;
      }
      this.lifetime = { joinFlag: change.state.joinFlag, state };
      // set_time_of_day: the tail's lock takes the scripts' value (2.3.1
      // capture).
      if (change.state.timeOfDay !== undefined) {
        this.lifetimeTimeOfDay = change.state.timeOfDay;
      }
      // Ended: the lifetime counts every phase done and names none.
      if (this.lifetime.state >= lifetimeStates().ended && this.phases.length) {
        this.phase = {
          bubble: -1,
          hash: k_empty_name_hash,
          index: this.phases.length,
        };
      }
      this.bodies.set(rowKey, this.lifetimeBody());
      // Every player row is marked (identity [1], the occupant's state [3]) in
      // the same update that makes the lifetime active (wire 3): the spawn
      // waits on it. A scripted mission gets it from its intro cinematic; an
      // activity with none (cosmo_patrols_1) needs it from here.
      if (state >= lifetimeStates().active && !this.cinematicSeen) {
        this.cinematicSeen = true;
        for (const slot of this.playerRefs.keys()) {
          this.playerChanged(slot);
        }
      }
    } else if (change.kind === "cinematic") {
      // Every player row is marked in the update that starts the first
      // cinematic (identity [1], the occupant's state [3]; 2.3.1 capture).
      if (change.state.playing && !this.cinematicSeen) {
        this.cinematicSeen = true;
        for (const slot of this.playerRefs.keys()) {
          this.playerChanged(slot);
        }
      }
      const generation = (this.cinematicGenerations.get(rowKey) ?? 1) + 1;
      this.cinematicGenerations.set(rowKey, generation);
      const startedAt = change.state.playing?.startedAt;
      if (startedAt === undefined) {
        this.cinematicStarts.delete(rowKey);
      } else {
        this.cinematicStarts.set(rowKey, startedAt);
      }
      this.bodies.set(rowKey, encodeCinematicAuth(generation, startedAt));
    } else if (change.kind === "squad") {
      this.applySquad(rowKey, change.state);
    } else if (change.kind === "actor") {
      this.actors.set(rowKey, change.state);
      // The squad's roster leaves a placed named member's cell empty. A squad
      // whose members a script places one by one gets the body a place() of its
      // own would have given it, with its cells beside the placed actors (2.3.1
      // capture).
      const owner = this.ownerOf.get(rowKey);
      const squadRow = owner ? this.squadRows.get(owner) : undefined;
      if (owner && squadRow && !this.squads.has(owner) && change.state.placed) {
        this.refs.set(owner, {
          bundle: squadRow.bundle,
          typeId: activityBundleItemType().Squad,
          typeIndex: Number(owner.split(":")[2]),
        });
        this.applySquad(owner, { carried: false, wave: 0 });
      }
      if (owner && this.squads.has(owner)) {
        this.dirty.add(owner);
      }
    } else {
      const body = encodeRow(change, this.toggles, (rowKey) =>
        this.triggerGroupVolumes.get(rowKey)
      );
      if (!body) {
        if (!this.unsent.has(change.kind)) {
          this.unsent.add(change.kind);
          this.log(`script: no encoder for ${change.kind} rows, not sent`);
        }
        return;
      }
      this.bodies.set(rowKey, body);
    }
    // A starting state is how the zero auth already describes the row.
    if (!change.initial) {
      this.dirty.add(rowKey);
    }
  }

  // A client skipped a playing cinematic (its cinematic_skip incident): the
  // row stops playing and names who skipped it, and the client then reports
  // the cinematic finished.
  noteCinematicSkipped(row: ItemRef, character: bigint): void {
    const rowKey = key(row.bundle, row.typeId, row.typeIndex);
    const startedAt = this.cinematicStarts.get(rowKey);
    if (startedAt === undefined) {
      return;
    }
    const generation = (this.cinematicGenerations.get(rowKey) ?? 1) + 1;
    this.cinematicGenerations.set(rowKey, generation);
    this.refs.set(rowKey, row);
    this.bodies.set(
      rowKey,
      encodeCinematicAuth(generation, startedAt, [character])
    );
    this.dirty.add(rowKey);
  }

  hasDirty(): boolean {
    return this.dirty.size > 0;
  }

  // Rows changed since the last take, of those `ready` accepts (by
  // bundle:type:index); the rest stay dirty.
  takeDirty(
    ready: (rowKey: string) => boolean = () => true
  ): SensorAuthSenseEntry[] {
    const taken = [...this.dirty].filter(ready);
    for (const rowKey of taken) {
      this.dirty.delete(rowKey);
    }
    return this.inOrder(taken);
  }

  // Every row the scripts have written, for a whole apply. Clears dirty.
  entries(): SensorAuthSenseEntry[] {
    this.dirty.clear();
    return this.inOrder([
      ...this.squads.keys(),
      ...this.actors.keys(),
      ...this.bodies.keys(),
    ]);
  }

  // Squads first: a named actor resolves its squad when its own auth applies,
  // so the squad has to be there by then.
  private inOrder(rowKeys: readonly string[]): SensorAuthSenseEntry[] {
    const squadsFirst = [
      ...rowKeys.filter((rowKey) => this.squads.has(rowKey)),
      ...rowKeys.filter((rowKey) => !this.squads.has(rowKey)),
    ];
    return squadsFirst.flatMap((rowKey) => this.entry(rowKey));
  }

  private applySquad(rowKey: string, next: SquadState): void {
    const previous = this.squads.get(rowKey);
    const wire: SquadWire = previous
      ? { ...previous, state: next }
      : { bindingGeneration: 1, killPolicy: false, state: next };
    const waves = next.wave - (previous?.state.wave ?? 0);
    const killed =
      next.killed !== undefined && next.killed !== previous?.state.killed;
    if (waves > 0 || killed) {
      wire.epoch = (wire.epoch ?? 0) + Math.max(waves, 0) + (killed ? 1 : 0);
      wire.bindingGeneration += 1;
    }
    if (killed) {
      wire.killPolicy = true;
    }
    if (previous && next.influencer !== previous.state.influencer) {
      wire.bindingGeneration += 1;
    }
    if (
      activityHostBuild().applyLayout.squadBindingByGeneration &&
      wire.bindingGeneration === (previous?.bindingGeneration ?? 1) &&
      this.squadBinding(rowKey, next) !==
        this.squadBinding(rowKey, previous?.state)
    ) {
      wire.bindingGeneration += 1;
    }
    this.squads.set(rowKey, wire);
  }

  // What the client binds a squad by: ref0 and the task with its influencer
  // ([9], [10]). Unwritten, the idle squad's: the @objective and no task.
  private squadBinding(rowKey: string, state?: SquadState): string {
    const row = this.squadRows.get(rowKey);
    const objective =
      state?.objective ??
      (row && this.squadObjective(row.bundle, row.typeIndex));
    const task = state?.task;
    return [
      objective?.bundle === undefined ? "-" : objective.bundle >>> 0,
      objective?.typeIndex ?? "-",
      task ?? "-",
      task === undefined ? "-" : (state?.taskInfluencer ?? "-"),
    ].join(":");
  }

  private entry(rowKey: string): SensorAuthSenseEntry[] {
    const ref = this.refs.get(rowKey);
    // A withheld row type (debug-toggles.json omitScriptRowTypes) keeps its
    // idle auth in applies and gets no update.
    if (!ref || debugOmitsRowType(this.toggles, ref.typeId)) {
      return [];
    }
    const squad = this.squads.get(rowKey);
    const other = this.bodies.get(rowKey);
    if (other) {
      return [
        entryOn(
          ref.bundle,
          ref.typeId,
          ref.typeIndex,
          other,
          this.sensed.has(rowKey)
        ),
      ];
    }
    const body = squad
      ? this.squadBody(rowKey, squad)
      : this.actorBody(this.actors.get(rowKey));
    if (body) {
      return [entryOn(ref.bundle, ref.typeId, ref.typeIndex, body, true)];
    }
    const idle = this.idle.has(rowKey) ? this.idleBody(rowKey, ref) : undefined;
    return idle
      ? [
          entryOn(
            ref.bundle,
            ref.typeId,
            ref.typeIndex,
            idle,
            this.sensed.has(rowKey)
          ),
        ]
      : [];
  }

  // What a row the scripts have not written (or a wipe took back) says: its
  // schema's idle form, which for a trigger group refs the volume it watches.
  private idleBody(rowKey: string, ref: ItemRef): FinishedBits | undefined {
    if (ref.typeId === activityBundleItemType().TriggerGroup) {
      return encodeTriggerGroupAuth(this.triggerGroupVolumes.get(rowKey));
    }
    // As the join's idle squad: a roster cell per definition member, which the
    // client checks against the squad definition.
    const squad = this.squadRows.get(rowKey);
    if (squad && activityHostBuild().applyLayout.squadsAtDefinition) {
      return encodeSquadAuth({
        bindingGeneration: 1,
        objective: this.squadObjective(squad.bundle, squad.typeIndex),
        roster: Array.from({ length: squad.cells }, () => 0),
      });
    }
    const auth = this.authSchemas.get(rowKey);
    return auth === undefined
      ? undefined
      : activityHostBuild().sensor.idleAuth(auth);
  }

  private squadBody(rowKey: string, squad: SquadWire) {
    const row = this.squadRows.get(rowKey);
    if (!row) {
      return;
    }
    // A named member its own ActorAuth places is its cell's body, so that cell
    // asks for no anonymous one. The 2.3.1 Tower capture's squads all go out
    // with every cell at 0.
    const placed = Array.from({ length: row.cells }, (_, cell) => {
      const member = row.members[cell];
      return (
        member !== undefined &&
        this.actors.get(key(row.bundle, activityBundleItemType().Actor, member))
          ?.placed === true
      );
    });
    const open = placed.flatMap((isPlaced, cell) => (isPlaced ? [] : [cell]));
    const anonymous = Math.max(
      0,
      (squad.state.bodies ?? 0) - (row.cells - open.length)
    );
    // A script's @member_counts come with their roster, named cells at 0.
    const authored =
      squad.state.roster?.length === row.cells ? squad.state.roster : undefined;
    const roster = authored ? [...authored] : placed.map(() => 0);
    if (!authored) {
      open.forEach((cell, i) => {
        roster[cell] =
          Math.floor(anonymous / open.length) +
          (i < anonymous % open.length ? 1 : 0);
      });
    }
    // The Objective and task the scripts gave it (set_objective / set_task):
    // anonymous squads carry both, and without them the client has no firing
    // area set for the squad, so its Fallen stand at their spawn points.
    return encodeSquadAuth({
      bindingGeneration: squad.bindingGeneration,
      carrierCargo: squad.state.carried,
      epoch: squad.epoch,
      killPolicy: squad.killPolicy,
      objective:
        squad.state.objective ?? this.squadObjective(row.bundle, row.typeIndex),
      placedAt: squad.state.placedAt,
      roster,
      task: squad.state.task,
      taskInfluencer: squad.state.taskInfluencer,
      temperaments: squad.state.temperaments,
    });
  }

  private actorBody(actor: ActorState | undefined) {
    if (!actor) {
      return;
    }
    // The 2.3.1 capture places every named actor with [0] = 1 and a behaviour
    // of generation 1; the bare place flag is what the Tower has worked with
    // so far. A toggle, until a console says which the client needs.
    const capturedBody =
      this.toggles.actorPlaceBody === "retail" && actor.placed;
    let behaviour: ActorAuthFields["behaviour"];
    if (actor.behaviour) {
      behaviour = {
        awarenessFlags: actor.behaviour.awarenessFlags,
        awarenessMask: actor.behaviour.awarenessMask,
        channels: actor.behaviour.channels,
        generation: actor.behaviour.incarnation,
        temperaments: actor.behaviour.temperaments,
      };
    } else if (capturedBody) {
      behaviour = { awarenessFlags: 0, awarenessMask: 0, generation: 1 };
    }
    return encodeActorAuth({
      behaviour,
      carried: actor.carried,
      drop: actor.drop && { dropId: actor.drop.id, refs: actor.drop.squads },
      incarnation: actor.incarnation ?? (capturedBody ? 1 : undefined),
      kill: actor.kill,
      place: actor.placed,
      script: actor.commandScript,
    });
  }
}
