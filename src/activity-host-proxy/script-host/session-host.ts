import {
  fnv1,
  type KillFilterDetails,
} from "@blamnetwork/bullshcript/destiny1/common";
import {
  event_error,
  event_message,
  event_status,
  event_warning,
} from "@blamnetwork/datamine";
import {
  activityBinder,
  activityBundles,
  loadedBundles,
  senseSchema,
} from "../../content";
import { activityName as activityNameForId } from "../../content/activities";
import { activityBundleItemType } from "../../content/row-types";
import { readDebugToggles } from "../../dev-config/debug-toggles";
import { resolveScriptHandles } from "../../env";
import { powerLevelOf, selfFamilyPublisherFor } from "../../players/registry";
import type { ActivityHostKind } from "../activity-host";
import { activityInstanceFor } from "../activity-instance";
import { HardWipe } from "../hard-wipe";
import type { AhClientIdentity } from "../join";
import {
  INCIDENT_CINEMATIC_FINISHED,
  INCIDENT_CINEMATIC_SKIP,
  INCIDENT_GATHER_MATERIAL,
  INCIDENT_INTERACTION,
  INCIDENT_INVENTORY_ITEM_ADDED,
  INCIDENT_PLAYER_SPAWNED,
  INCIDENT_PLAYER_TRIGGER,
  INCIDENT_QUEST_ITEM_COLLECTED,
  type IncidentPosition,
  incidentCarriesU32,
  incidentName,
  isKillFamilyIncident,
  isPlayerDeathIncident,
  parseIncident,
} from "../mission/incident";
import type { HostSession, PlayerHosts } from "../player-hosts";
import { playerKeyFromCharacter } from "../rsat";
import type { ClientHardWipe } from "../rsat/client-reports";
import type { PlayerRowsState } from "../rsat/sensor-auth-fields";
import {
  actorBoundFlags,
  actorCommandScriptProgress,
  actorDropAcks,
  actorStandings,
  healthFractions,
  interactableUses,
  objectAliveFlags,
  objectDeviceReports,
  peekSensorSenseUpdate,
  playerMonitorCounts,
  squadAliveCounts,
  squadTallies,
} from "../rsat/sensor-sense";
import { activityHostBuild } from "../versions";
import { ScriptBuildError } from "./compiled-scripts";
import type { ItemSink } from "./item-sink";
import { ScriptHost, scriptHostFor } from "./runtime";

// An activity's scripts tick once a second, off the keepalive: at one tick a
// beat each wait in a chain cost up to 3 s and objectives armed after a player
// had already walked through.
export const SCRIPT_TICK_MS = 1000;
const MILLISECONDS_PER_SECOND = 1000;

// The binders whose lifetime an activity's players wait on before they
// spawn: the story missions' and the strikes'. The Tower's has none to wait on.
const LIFETIME_BINDERS = new Set([fnv1("story_common"), fnv1("portal_common")]);

function waitsOnLifetime(activityName: string): boolean {
  return (
    activityBundles(activityName)?.tags.some((tag) =>
      LIFETIME_BINDERS.has(tag.bundle >>> 0)
    ) ?? false
  );
}

// What the script host glue needs of its session.
interface SessionScriptHostContext {
  activityName(): string | undefined;
  activityTicks(): number;
  hosts(): PlayerHosts;
  joinIdentity(): AhClientIdentity | undefined;
  kind(): ActivityHostKind;
  // Where a hard wipe brings everyone back: the start of the running phase.
  // The clients are on their wipe screens when this runs.
  moveToPhaseStart(activityName: string, phaseIndex: number): void;
  noteInstanceSpawned(): void;
  playerRows(activityName: string, ownKey: bigint): PlayerRowsState;
  // The bubble the client is in and that bubble's state.
  position(): { bubble: number | undefined; state: number };
  // The membership goes out again, for the hard wipe's step it states.
  pushMembership(): void;
  // This connection, as the host of the world whose rows it carries.
  session(): HostSession;
  stepTeleport(activityName: string): void;
  // The host's teleportation is under way: its clients have not all gone
  // inactive again.
  teleporting(activityName: string): boolean;
  worldEntered(): boolean;
}

// The session's side of the activity's script host: starting it, ticking it,
// and feeding it what the client senses and reports.
export class SessionScriptHost {
  // The activity's script host, when this socket built it (the FAH).
  private ownHost: ScriptHost | undefined;
  // Script rows only flow once the scripts are up.
  private missionLive = false;
  // The scripts have ticked at least once. From then on a crossing's world
  // entry runs the bubble's newly active bundles first, so their placements
  // are in the entry; the first entry keeps lifetime none and starts the
  // scripts 1.5 s later (2.3.1 capture).
  private ticked = false;
  // This connection's hard wipe: its activity client's cookie is its own, so
  // it lives here and not with the activity.
  readonly hardWipe = new HardWipe(activityHostBuild().hardWipe);
  // Whether each player's sense last said it was dead, by character key.
  private readonly senseDead = new Map<string, boolean>();
  // A wipe has ended and nobody has come back from it yet: the players still
  // read as dead until their respawn lands, which is no new wipe.
  private awaitingReturn = false;
  // The device each Object row's sense last reported, by bundle and index:
  // what the client took of our device writes goes in the log once.
  private readonly senseDevices = new Map<string, string>();

  constructor(private readonly context: SessionScriptHostContext) {}

  // The client reported its hard wipe (class 21).
  noteHardWipe(report: ClientHardWipe): void {
    const activityName = this.context.activityName();
    const identity = this.context.joinIdentity();
    if (!(activityName && identity)) {
      return;
    }
    const member = activityInstanceFor(
      activityName,
      this.context.hosts()
    ).member(identity);
    if (member) {
      this.hardWipe.report(member.slot, report);
    }
  }

  get scriptsTicked(): boolean {
    return this.ticked;
  }

  // The client has entered a world whose scripts are up.
  markMissionLive(): void {
    this.missionLive = true;
  }

  // The activity's script host. Only the FAH starts it (start), but
  // the scripts read sense from rows in every world, and a row's sense
  // arrives on the socket of the host whose world owns it. A GAH session
  // reads the same shared host; it never starts one.
  get host(): ScriptHost | undefined {
    if (this.ownHost) {
      return this.ownHost;
    }
    const start = this.context.hosts().getStartRequest();
    const activityName =
      start === undefined ? undefined : activityNameForId(start.activityId);
    return activityName
      ? activityInstanceFor(activityName, this.context.hosts()).host()
      : undefined;
  }

  // An activity's sense rows: its player monitors' counts and its
  // squads' live member counts go to the script host, and a player's own
  // state goes back out in its row's authority.
  handleSensorSense(
    sessionId: bigint,
    activityName: string,
    payload: Buffer
  ): void {
    const peek = peekSensorSenseUpdate(payload, (bundle, typeId, index) =>
      senseSchema(activityName, bundle, typeId, index)
    );
    const types = new Map<number, number>();
    for (const row of peek.rows) {
      types.set(row.typeId, (types.get(row.typeId) ?? 0) + 1);
    }
    event_status(
      "activities:script: sensor_sense_update session=0x%I64x %dB rows=%d %s%s",
      sessionId,
      payload.length,
      peek.rows.length,
      [...types].map(([typeId, n]) => `t${typeId}x${n}`).join(","),
      peek.truncated
        ? ` truncated at t${peek.rows.at(-1)?.typeId}#${peek.rows.at(-1)?.typeIndex}`
        : ""
    );
    const itemSink =
      this.host instanceof ScriptHost ? this.host.itemSink : undefined;
    const binderBundle = activityBinder(activityName)?.bundle;
    for (const row of peek.rows) {
      if (row.typeId === activityBundleItemType().Player && row.sense) {
        const report = activityHostBuild().sensor.sense.playerReport(row.sense);
        // A public world's own players (public_common, on the public host)
        // are not the binder's: their sense is the public world going live.
        if (binderBundle !== undefined && row.bundle !== binderBundle) {
          event_message(
            "activities:script: public player sense %s 0x%x t12#%d state=%s",
            this.context.kind(),
            row.bundle,
            row.typeIndex,
            JSON.stringify(report?.state)
          );
          continue;
        }
        // The client's own state: what it reports here is what it waits on
        // before an intro cinematic (2.3.1 capture: flips [3] 0.13 s after
        // pregame), so it goes in the log.
        if (report) {
          event_message(
            "activities:script: player sense t12#%d state=%s state2=%s",
            row.typeIndex,
            JSON.stringify(report.state),
            JSON.stringify(report.state2)
          );
          itemSink?.notePlayerState(row.typeIndex, report.state, report.state2);
          this.noteDeathSense(
            itemSink?.occupantKey(row.typeIndex),
            report.dead
          );
        }
      }
    }
    for (const monitor of playerMonitorCounts(peek)) {
      this.host?.notePlayerMonitor(
        monitor.bundle,
        monitor.typeIndex,
        monitor.count
      );
      if (monitor.count > 0) {
        event_message(
          "activities:script: player monitor #%d count=%d",
          monitor.typeIndex,
          monitor.count
        );
      }
    }
    for (const squad of squadAliveCounts(peek)) {
      this.host?.noteSquadAlive(squad.bundle, squad.typeIndex, squad.alive);
    }
    for (const device of objectDeviceReports(peek)) {
      // A write has to clear the stamp the client holds.
      if (this.host instanceof ScriptHost) {
        this.host.runtime.reportDeviceSense(
          { bundle: device.bundle, typeIndex: device.typeIndex },
          { position: device.position, positionStamp: device.positionStamp }
        );
      }
      const key = `${device.bundle}:${device.typeIndex}`;
      const shown = `${device.position} stamp ${device.positionStamp}`;
      if (this.senseDevices.get(key) !== shown) {
        this.senseDevices.set(key, shown);
        event_message(
          "activities:script: object 0x%x #%d sense device position %s",
          device.bundle,
          device.typeIndex,
          shown
        );
      }
    }
    // The per-cell death tally is what alive_count() reads first; [3] alone
    // never rose above 0 for a squad killed on its way in.
    if (this.host instanceof ScriptHost) {
      for (const squad of squadTallies(peek)) {
        this.host.noteSquadTally(squad.bundle, squad.typeIndex, squad.tally);
      }
      // A named member's death is its own edge, not a tally cell.
      for (const actor of actorBoundFlags(peek)) {
        this.host.noteActorBound(
          actor.bundle,
          actor.typeIndex,
          actor.unknown9,
          actor.unknown10
        );
      }
      // How far the client has got with a drop and with a command script:
      // is_dropping() and get_command_script_state() read it, and without
      // it each waits out its timeout.
      for (const { bundle, typeIndex, dropId, inProgress } of actorDropAcks(
        peek
      )) {
        this.host.noteActorDropAck(bundle, typeIndex, dropId, inProgress);
      }
      for (const {
        bundle,
        typeIndex,
        ...progress
      } of actorCommandScriptProgress(peek)) {
        this.host.noteActorCommandScriptSense(bundle, typeIndex, progress);
      }
      // A placement the client held back is placed again until it stands.
      for (const { bundle, typeIndex, epoch, standing } of actorStandings(
        peek
      )) {
        this.host.noteActorStanding(bundle, typeIndex, epoch, standing);
      }
      for (const { bundle, typeIndex, alive } of objectAliveFlags(peek)) {
        this.host.noteObjectAlive(bundle, typeIndex, alive);
      }
      for (const { bundle, typeIndex, current, max } of healthFractions(peek)) {
        this.host.noteHealth(bundle, typeIndex, current, max);
      }
      // The client's used latch on a mission interactable: get_active reads
      // it as well as the interaction incident.
      for (const { bundle, typeIndex, used, usedStamp } of interactableUses(
        peek
      )) {
        this.host.runtime.reportInteractableSense(
          { bundle, typeIndex },
          { used, usedStamp }
        );
      }
    }
  }

  // A player's sense says whether it is dead, besides the kill the client
  // reports: the scripts' is_dead and a hard wipe read the edge either way.
  private noteDeathSense(character: bigint | undefined, dead: boolean): void {
    if (character === undefined) {
      return;
    }
    const key = character.toString(16);
    const was = this.senseDead.get(key) ?? false;
    this.senseDead.set(key, dead);
    if (dead === was) {
      return;
    }
    if (dead) {
      this.host?.notePlayerDied(key);
    } else {
      this.host?.notePlayerRespawned(key);
    }
  }

  // The incident can land on the GAH socket; the script host is on the FAH.
  // Events take exactly one route to the shared script host: a GAH hands them
  // to the FAH, which delivers them once, and delivers them itself only with
  // no FAH session. Sense is state, not an event, so every session writes it
  // straight to the shared host.
  notePlayerTrigger(bundle: number, typeIndex: number): void {
    if (this.context.kind() !== "FAH") {
      const fah = this.context.hosts().session("FAH");
      if (fah) {
        fah.notePlayerTrigger(bundle, typeIndex);
        return;
      }
    }
    this.host?.noteTriggerFired(bundle, typeIndex);
  }

  // A client incident only the scripts' listeners read.
  noteClientIncident(nameHash: number): void {
    if (this.context.kind() !== "FAH") {
      const fah = this.context.hosts().session("FAH");
      if (fah) {
        fah.noteClientIncident(nameHash);
        return;
      }
    }
    if (this.host instanceof ScriptHost) {
      this.host.noteClientIncident(nameHash);
    }
  }

  // Every armed incident listener lives on the FAH's script host
  // (kill_squad_objective's _incident_listener is what ends the servitor
  // objective), so a kill-family incident that landed on the GAH has to cross,
  // as a player_trigger does.
  noteKill(details: KillFilterDetails): void {
    if (this.context.kind() !== "FAH") {
      const fah = this.context.hosts().session("FAH");
      if (fah) {
        fah.noteKill(details);
        return;
      }
    }
    this.host?.noteKillIncident(details);
  }

  // Which squad died, and where.
  noteSquadKill(idents: readonly number[], at?: IncidentPosition): void {
    if (this.context.kind() !== "FAH") {
      const fah = this.context.hosts().session("FAH");
      if (fah) {
        fah.noteSquadKill(idents, at);
        return;
      }
    }
    for (const ident of idents) {
      this.host?.noteSquadKill(ident, at);
    }
  }

  // An interactable used.
  noteInteraction(carries: (name: number) => boolean): void {
    if (this.context.kind() !== "FAH") {
      const fah = this.context.hosts().session("FAH");
      if (fah) {
        fah.noteInteraction(carries);
        return;
      }
    }
    this.host?.noteInteraction(carries);
  }

  // A quest item picked up.
  noteLootGathered(carries: (material: number) => boolean): void {
    if (this.context.kind() !== "FAH") {
      const fah = this.context.hosts().session("FAH");
      if (fah) {
        fah.noteLootGathered(carries);
        return;
      }
    }
    this.host?.noteLootGathered(carries);
  }

  // Class 18 incidents: the script host hears player_trigger for the trigger
  // row it armed, kills, interactions and pickups; everything else is logged by
  // name.
  handleIncident(sessionId: bigint, payload: Buffer): void {
    const start = this.context.hosts().getStartRequest();
    const activityName =
      start === undefined ? undefined : activityNameForId(start.activityId);
    // Refs are found by scanning for a known bundle hash, so every table the
    // activity registers has to be in the list.
    const bundles = activityBundles(activityName);
    if (!(bundles && activityName)) {
      return;
    }
    const incident = parseIncident(
      payload,
      bundles.tags.map((tag) => tag.bundle)
    );
    if (!incident) {
      return;
    }
    const refs = incident.refs
      .map((r) => `${r.typeId}#${r.typeIndex}`)
      .join(",");
    event_message(
      "activities:script: incident %s refs=[%s] session=0x%I64x %dB",
      incidentName(incident.nameHash),
      refs,
      sessionId,
      payload.length
    );
    if (incident.nameHash === INCIDENT_PLAYER_TRIGGER) {
      for (const ref of incident.refs) {
        if (ref.typeId === activityBundleItemType().PlayerTrigger) {
          this.notePlayerTrigger(ref.bundle, ref.typeIndex);
        }
      }
    }
    // A skip is answered on the row (ItemSink.noteCinematicSkipped).
    if (incident.nameHash === INCIDENT_CINEMATIC_SKIP) {
      const rows =
        this.host instanceof ScriptHost ? this.host.itemSink : undefined;
      for (const ref of incident.refs) {
        if (ref.typeId === activityBundleItemType().Cinematic) {
          rows?.noteCinematicSkipped(
            {
              bundle: ref.bundle,
              typeId: ref.typeId,
              typeIndex: ref.typeIndex,
            },
            playerKeyFromCharacter(this.context.joinIdentity()?.character)
          );
        }
      }
    }
    // What Cinematic:is_done waits on. It only sets a flag, so it goes
    // straight to the shared host from whichever socket it lands on.
    if (incident.nameHash === INCIDENT_CINEMATIC_FINISHED) {
      for (const ref of incident.refs) {
        if (ref.typeId === activityBundleItemType().Cinematic) {
          this.host?.noteCinematicFinished(ref.bundle, ref.typeIndex);
        }
      }
    }
    // State, not an event: every socket may set it on the shared host.
    if (incident.names.includes(INCIDENT_PLAYER_SPAWNED)) {
      this.host?.notePlayerSpawned();
      this.context.noteInstanceSpawned();
      // PlayerSensor.is_dead's respawn edge: the same incident
      // that marks the activity ready marks this player alive again.
      const identity = this.context.joinIdentity();
      if (this.host instanceof ScriptHost && identity) {
        this.host.notePlayerRespawned(identity.character.toString(16));
      }
    }
    // The weapon pickup completes mission 3's objective (cleared 0.1-0.2 s
    // after this incident, 2.3.1 capture); it reaches the script host's
    // listeners the way a trigger does.
    if (incident.nameHash === INCIDENT_INVENTORY_ITEM_ADDED) {
      this.noteClientIncident(incident.nameHash);
    }
    if (
      incident.nameHash === INCIDENT_GATHER_MATERIAL ||
      incident.nameHash === INCIDENT_QUEST_ITEM_COLLECTED
    ) {
      // The material is matched by value (incidentCarriesU32); the bytes are
      // logged until the field is confirmed on the wire.
      event_message(
        "activities:script: gather_material 0x%x payload=%s",
        incident.nameHash,
        payload.toString("hex")
      );
      const { metadataBit } = incident;
      // The quest item pickup's payload is not confirmed to carry the
      // material, so it counts for every enabled Loot row (one objective's
      // at a time in practice); gather_material is matched.
      const pickup = incident.nameHash === INCIDENT_QUEST_ITEM_COLLECTED;
      this.noteLootGathered(
        (material) =>
          pickup || incidentCarriesU32(payload, metadataBit, material)
      );
    }
    if (incident.nameHash === INCIDENT_INTERACTION) {
      // Which of the object's names it carries is matched by value; the
      // bytes are logged until the field is confirmed on the wire.
      event_message(
        "activities:script: interaction payload=%s",
        payload.toString("hex")
      );
      const { metadataBit } = incident;
      this.noteInteraction((name) =>
        incidentCarriesU32(payload, metadataBit, name)
      );
    }
    if (!isKillFamilyIncident(incident.names)) {
      return;
    }
    event_message(
      "activities:script: kill payload=%s metadataBit=%d",
      payload.toString("hex"),
      incident.metadataBit
    );
    this.handleKill(activityName, payload, incident);
  }

  // A kill. Its metadata is not decoded into killer and victim descriptors:
  // the victim squad's import identifier is looked for anywhere in it, and
  // every kill that is not the player's own death counts as the player's (a
  // solo strike has no other killer the scripts count).
  private handleKill(
    activityName: string,
    payload: Buffer,
    incident: { metadataBit: number; names: readonly number[] }
  ): void {
    if (isPlayerDeathIncident(incident.names)) {
      const identity = this.context.joinIdentity();
      if (this.host instanceof ScriptHost && identity) {
        this.host.notePlayerDied(identity.character.toString(16));
      }
      return;
    }
    const idents = new Set<number>();
    for (const tag of activityBundles(activityName)?.tags ?? []) {
      for (const row of tag.rows) {
        if (
          row.typeId === activityBundleItemType().Squad &&
          row.importIdent !== undefined &&
          !idents.has(row.importIdent) &&
          incidentCarriesU32(payload, incident.metadataBit, row.importIdent)
        ) {
          idents.add(row.importIdent);
        }
      }
    }
    event_message(
      "activities:script: kill victims=[%s]",
      [...idents].map((i) => `0x${i.toString(16)}`).join(",")
    );
    if (idents.size > 0) {
      this.noteSquadKill([...idents]);
    }
    const character = this.context.joinIdentity()?.character.toString(16);
    this.noteKill({
      assists: [],
      killer: { characterKey: character },
      victim: {},
    });
  }

  // The authored host scripts run for as long as the activity does: the host
  // is built once and shared by every bubble and player in it. An encounter
  // idles because its own gates are unsatisfied, so crossing a bubble must not
  // restart it and a fireteam member moving ahead must not reset it.
  start(activityName: string, activityId?: number) {
    const instance = activityInstanceFor(activityName, this.context.hosts());
    // Hand our clock start to the instance before any script can stamp a
    // row with it.
    this.context.activityTicks();
    this.ownHost = instance.ensureHost(() => {
      // An activity's host reads its own tables.
      if (!activityBundles(activityName)) {
        return;
      }
      let host: ScriptHost | undefined;
      const options = {
        activityName,
        // The instance's clock, not this session's: the host outlives the
        // FAH that built it, and its stamps are read in every world.
        clock: instance.clock,
        log: (line: string) => event_message("bullshcript: %s", line),
        namedHandles: resolveScriptHandles(),
        phaseProgress: instance.phaseProgress(),
        // Read on every call: who is in the activity, their gear and whether
        // they have spawned all change while the scripts run.
        players: () => instance.players(powerLevelOf),
        onActivityComplete: () => this.noteActivityComplete(activityId),
        state: instance.rowState,
        tickSeconds: SCRIPT_TICK_MS / MILLISECONDS_PER_SECOND,
      };
      try {
        host = scriptHostFor(options);
      } catch (error) {
        // the last script build failed: loud, every time a host would start
        if (error instanceof ScriptBuildError) {
          event_error("activities:script: %s: %s", activityName, error.message);
          return;
        }
        event_warning(
          "activities:script: script host not built: %s",
          error instanceof Error ? error.message : String(error)
        );
        return;
      }
      if (!host) {
        return;
      }
      // A chunk that reaches a global we have not bound raises here. That
      // can never be allowed to take a boot down, so the host stays off.
      try {
        host.start({ lifetimeFallback: waitsOnLifetime(activityName) });
      } catch (error) {
        event_warning(
          "activities:script: script host failed to start for %s: %s",
          activityName,
          (error as Error).message
        );
        return;
      }
      event_message(
        "activities:script: script host drive for %s%s",
        activityName,
        host.unresolvedBindings.length > 0
          ? ` unresolved=[${host.unresolvedBindings.join(",")}]`
          : ""
      );
      return host;
    });
    if (this.ownHost) {
      this.missionLive = true;
    }
  }

  // The scripts completed the activity (set_activity_complete): every player in
  // it has finished it. Their BAP sessions record it, clear the prologue flag
  // after the prologue mission, and let the client chain to the activity's next
  // one.
  noteActivityComplete(activityId: number | undefined): void {
    const activityName = this.context.activityName();
    if (activityId === undefined || !activityName) {
      return;
    }
    for (const member of activityInstanceFor(
      activityName,
      this.context.hosts()
    ).all()) {
      const character = member.identity.character;
      const publisher = selfFamilyPublisherFor(character);
      event_message(
        "activities:script: activity %d (%s) complete for char=0x%I64x%s",
        activityId,
        activityName,
        character,
        publisher ? "" : " (no BAP session)"
      );
      publisher?.completeActivity?.(activityId);
    }
  }

  tick(): void {
    const host = this.host;
    // The host is shared with the player's other sockets, which beat too.
    // Only one of them drives it: the FAH, whose row state the scripts
    // write, and a GAH only when there is no FAH.
    if (this.context.kind() !== "FAH" && this.context.hosts().session("FAH")) {
      return;
    }
    // Nothing runs until a player has spawned. The activity host is up long
    // before that, and a script ticking from the start played dialogue
    // during the load screen.
    const activity = this.context.hosts().getStartRequest();
    const activityName =
      activity === undefined
        ? undefined
        : activityNameForId(activity.activityId);
    // An activity that opens in a phase's own bubble state starts on a
    // cinematic nobody spawns into (cine_reveal): its scripts run from world
    // entry (the lifetime goes to pregame 1.5 s after it, the intro 1 s later).
    const opensOnCinematic =
      (activityBundles(activityName)?.scenario.initialState ?? 0) > 0 &&
      this.context.worldEntered();
    if (
      !(host && (host.playerSpawned || opensOnCinematic) && this.missionLive)
    ) {
      return;
    }
    if (host.itemSink && activityName) {
      this.tickHost(host, host.itemSink, activityName);
    }
  }

  // An activity's tick: its scripts run on the tables, and what they write goes
  // out as rows. A row goes to the host whose world has its sensor in its
  // current bubble (the public host's for a public bubble's own bundles, the
  // private one's otherwise); a row no world has yet (a squad of a bubble
  // nobody is in) waits, and rides that bubble's apply when a player gets
  // there.
  private tickHost(
    host: ScriptHost,
    rows: ItemSink,
    activityName: string
  ): void {
    const { bubble, state } = this.context.position();
    const loaded =
      bubble === undefined
        ? undefined
        : loadedBundles(activityName, bubble, state);
    if (loaded) {
      host.setActiveBundles(loaded);
    }
    rows.setDebugToggles(readDebugToggles().toggles);
    this.context.stepTeleport(activityName);
    // A member joining or leaving changes its player row.
    this.context.playerRows(
      activityName,
      playerKeyFromCharacter(this.context.joinIdentity()?.character)
    );
    this.driveHardWipe(host, rows, activityName);
    if (!host.tickIfDue(Date.now())) {
      return;
    }
    this.ticked = true;
    this.flushRows(rows, activityName);
  }

  // The hard wipe, a step at a time. The whole fireteam dead under a phase
  // that arms it starts the handshake: the clients put up their wipe screens.
  // Once they all have, the phase resets behind them and everyone is moved to
  // its start; when the move is done the clients are told, come back, and the
  // wipe ends when they have all completed it. The host's nest goes out after
  // each step, each of which needs a new membership.
  //
  // The move runs first because the client's respawn after a wipe is asked
  // once, when its wipe goes back to 0 (a request for every local player with
  // no unit), and a teleport that starts with it drops it. The teleport's own
  // end asks again only while no wipe is running, so the wipe has to end after
  // the teleport; told together, the player stayed dead after every wipe.
  private driveHardWipe(
    host: ScriptHost,
    rows: ItemSink,
    activityName: string
  ): void {
    this.stepHardWipe(host, rows, activityName);
    // The wipe respawns everyone itself, so no request to is granted meanwhile.
    rows.holdRespawns(this.hardWipe.active);
  }

  private stepHardWipe(
    host: ScriptHost,
    rows: ItemSink,
    activityName: string
  ): void {
    const wipe = this.hardWipe;
    if (!wipe.active) {
      if (this.awaitingReturn) {
        this.awaitingReturn = host.allPlayersDead;
        return;
      }
      if (host.hardWipeArmed && host.allPlayersDead) {
        const members = activityInstanceFor(activityName, this.context.hosts())
          .all()
          .map((member) => member.slot);
        event_message(
          "activities:script: hard wipe %s: every player is dead",
          activityName
        );
        wipe.start(members);
        this.context.pushMembership();
      }
      return;
    }
    if (wipe.resetDue()) {
      event_message(
        "activities:script: hard wipe %s: screens up, resetting the phase",
        activityName
      );
      host.resetCurrentPhase();
      this.context.moveToPhaseStart(activityName, host.runtime.phaseIndex);
      wipe.noteWorldReset();
      this.flushRows(rows, activityName);
    }
    if (wipe.returnDue()) {
      if (this.context.teleporting(activityName)) {
        return;
      }
      event_message(
        "activities:script: hard wipe %s: everyone at the phase start, bringing them back",
        activityName
      );
      wipe.noteReset();
      this.context.pushMembership();
    } else if (wipe.finishDue()) {
      event_message("activities:script: hard wipe %s: complete", activityName);
      wipe.finish();
      this.awaitingReturn = true;
      this.context.pushMembership();
    }
  }

  private flushRows(rows: ItemSink, activityName: string): number {
    if (!rows.hasDirty()) {
      return 0;
    }
    let sent = 0;
    const worlds = this.context.hosts().isGahBound()
      ? [
          this.context.hosts().session("FAH"),
          this.context.hosts().session("GAH"),
        ]
      : [this.context.session()];
    for (const world of worlds) {
      const present = world?.worldRows(activityName);
      if (world && present) {
        const entries = rows.takeDirty((key) => present.has(key));
        sent += entries.length;
        world.pushRows(entries);
      }
    }
    return sent;
  }

  // The debugger changed rows (an expression, a row action): they go out
  // now, spawned or not - the tick that would send them waits for a spawn.
  debugFlushRows(): number {
    const activityName = this.context.activityName();
    const host = this.host;
    if (!(activityName && host?.itemSink)) {
      return 0;
    }
    return this.flushRows(host.itemSink, activityName);
  }
}
