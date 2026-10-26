// The script host from @blamnetwork/bullshcript, run on the activity
// bundle tables and the compiled scripts, with the session-facing surface
// (the note* inputs, the rows the scripts write).

import {
  type ActivityPlayer,
  type HostClock,
  type KillFilterDetails,
  walkProtos,
} from "@blamnetwork/bullshcript/destiny1/common";
import { evaluate } from "@blamnetwork/bullshcript/destiny1/debug";
import {
  activityBinder,
  activityBundles,
  activityCommandScripts,
  activityNavPoints,
  activityPhases,
  bundleTags,
  lifetimeTail,
  lifetimeTimer,
} from "../../content";
import { withChildScripts } from "../../content/child-scripts";
import { activityBundleItemType } from "../../content/row-types";
import {
  contentBuild,
  type ScriptRuntimeInstance,
} from "../../content/versions";
import { debugStart } from "../debug-start";
import type { IncidentPosition } from "../mission/incident";
import type { SensorRowState } from "../mission/row-state";
import { compiledScripts } from "./compiled-scripts";
import { ItemSink } from "./item-sink";
import { scriptSource } from "./script-source";

interface ScriptHostOptions {
  activityName: string;
  clock: HostClock;
  log: (line: string) => void;
  namedHandles: Readonly<Record<string, boolean>>;
  // The scripts said the activity is complete (set_activity_complete).
  onActivityComplete?: () => void;
  phaseProgress: { read(): number; write(index: number): void };
  // The activity's players, for c_player_script_utilities.
  players?: () => readonly ActivityPlayer[];
  state: SensorRowState;
  tickSeconds: number;
}

interface CommandScriptProgress {
  cookieRunning?: number;
  heartbeat?: number;
  pcReached?: number;
}

// The runtime's lifetime numbering: 6 is ended, which the sink sends
// as 7.
const RUNTIME_LIFETIME_ENDED = 6;

// Whether any loaded script takes the lifetime (get_lifetime_sensor): a
// root's startup thread sets pregame on its first tick, after start(), so
// whether one has yet is no answer.
function scriptsDriveLifetime(runtime: ScriptRuntimeInstance): boolean {
  return runtime.allChunks.some((chunk) => {
    for (const prototype of walkProtos(chunk.root)) {
      if (
        prototype.constants.some(
          (constant) =>
            constant.kind === "string" &&
            constant.value === "get_lifetime_sensor"
        )
      ) {
        return true;
      }
    }
    return false;
  });
}

export class ScriptHost {
  readonly runtime: ScriptRuntimeInstance;
  // The lifetime has ended once: the players' activity completion went out.
  private ended = false;
  // The rows the scripts wrote, in its encodings. The session sends these
  // itself.
  readonly itemSink: ItemSink;

  constructor(options: ScriptHostOptions) {
    const bundles = bundleTags(options.activityName);
    if (bundles.length === 0) {
      throw new Error(`no tables for ${options.activityName}`);
    }
    const activity = activityBundles(options.activityName);
    // A debug start (debug-toggles.json) opens a fresh instance in a later
    // phase, the way a checkpoint would: that phase's scripts run, in its
    // bubble state.
    const start = debugStart(options.activityName);
    if (start && options.phaseProgress.read() === 0) {
      options.phaseProgress.write(start.phaseIndex);
      options.log(
        `script debug start: ${options.activityName} at phase ` +
          `${start.phaseIndex} (bubble ${start.bubble}.${start.state})`
      );
    }
    this.itemSink = new ItemSink(bundles, options.log, {
      phases: activityPhases(options.activityName),
      lifetimeTail: lifetimeTail(options.activityName),
      startPhaseIndex: start?.phaseIndex,
      startsInPhaseState:
        (start?.state ?? activity?.scenario.initialState ?? 0) > 0,
    });
    const binder = activityBinder(options.activityName);
    if (binder) {
      this.itemSink.bindLifetime({
        bundle: binder.bundle,
        typeId: activityBundleItemType().Lifetime,
        typeIndex: binder.lifetime,
      });
      this.itemSink.bindPlayers(binder.bundle, binder.players);
    }
    this.runtime = this.createRuntime(options, bundles, this.itemSink);
    this.itemSink.bindSquadObjectives((bundle, typeIndex) =>
      this.runtime.squadObjective(bundle, typeIndex)
    );
  }

  // The Objective the scripts author a squad against.
  squadObjective(
    bundle: number,
    typeIndex: number
  ): { bundle: number; typeIndex: number } | undefined {
    return this.runtime.squadObjective(bundle, typeIndex);
  }

  // The host on the tables, with their nav points. The scripts place
  // every squad themselves. A mission starting moves the lifetime's phase.
  private createRuntime(
    options: ScriptHostOptions,
    packageBundles: ReturnType<typeof bundleTags>,
    sink: ItemSink
  ): ScriptRuntimeInstance {
    const destination =
      activityBundles(options.activityName)?.destination ?? "";
    // The Encounter rows' archetypes are the scripts' declarations, taken
    // from the build this host starts on (a rebuild is for the next one).
    const bundles = withChildScripts(
      packageBundles,
      destination,
      compiledScripts()
    );
    const { scriptFor, scripts } = scriptSource(bundles, destination);
    const { ScriptRuntime } = contentBuild().bullshcript;
    return new ScriptRuntime({
      bundles,
      clock: options.clock,
      commandScripts: activityCommandScripts(options.activityName),
      lifetimeTimer: lifetimeTimer(bundles),
      log: options.log,
      namedHandles: options.namedHandles,
      navPoints: activityNavPoints(options.activityName),
      // set_activity_complete() is the activity_complete incident (not sent
      // yet: host incidents are unknown), 12 s before the outro cinematic
      // ends. The players' BAP completion waits for the lifetime to end: the
      // client launches the next activity the moment its character says this
      // one is finished, and leaves 14 s after lifetime 7 (2.3.1 capture).
      onActivityComplete: () => {
        options.log(`script ${options.activityName} complete (scripts)`);
      },
      onActivityFlag: (hash, active) => {
        options.state.setActivityFlag(hash, active);
        // The player rows are the sink's; the flag rides on them.
        sink.setActivityFlag(hash, active);
      },
      onItemsCleared: (items) => sink.clear(items),
      onItemChange: (change) => {
        sink.apply(change);
        if (
          change.kind === "lifetime" &&
          change.state.state >= RUNTIME_LIFETIME_ENDED &&
          !this.ended
        ) {
          this.ended = true;
          options.log(`script ${options.activityName} ended (lifetime)`);
          options.onActivityComplete?.();
        }
      },
      onPhaseStarted: () => {
        sink.setPhase(this.runtime.phaseIndex);
      },
      phaseProgress: options.phaseProgress,
      players: options.players,
      scriptFor,
      scripts,
      squadPlacedByDefault: () => false,
      tickSeconds: options.tickSeconds,
    });
  }

  get unresolvedBindings(): string[] {
    return this.runtime.unresolvedBindings;
  }

  get playerSpawned(): boolean {
    return this.runtime.playerSpawned;
  }

  // The running phase says @hard_wipe(): a hard wipe may happen while it runs.
  get hardWipeArmed(): boolean {
    return this.runtime.hardWipeArmed;
  }

  // Every player of the activity is dead at once.
  get allPlayersDead(): boolean {
    return this.runtime.allPlayersDead;
  }

  // The running phase starts again with the world as it was when it started;
  // what that changed in the rows is in the item sink, dirty.
  resetCurrentPhase(): void {
    this.runtime.resetCurrentPhase();
  }

  // An activity none of whose scripts drive the lifetime (no scripts at
  // all, a table read from the packages) would never spawn its players: a
  // lifetime goes pregame -> active from the root and first mission. The
  // host makes it active itself, inside start(), so the state rides the
  // world entry's apply (nothing else is pushed before a spawn).
  // `lifetimeFallback`: the activity is one whose binder carries a lifetime
  // the players wait on (a story mission's or a strike's, not the Tower's).
  start(options: { lifetimeFallback?: boolean } = {}): void {
    this.runtime.start();
    if (options.lifetimeFallback && !scriptsDriveLifetime(this.runtime)) {
      try {
        evaluate(
          this.runtime,
          "c_lifetime_script_utilities.get_lifetime_sensor().set_state(e_activity_lifetime_state.active)"
        );
        this.runtime.writer.note(
          "no script drives the lifetime: set active so players spawn"
        );
      } catch (error) {
        this.runtime.writer.note(
          `no script drives the lifetime, and setting it failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  tick(): void {
    this.runtime.tick();
  }

  tickIfDue(wallMs: number): boolean {
    return this.runtime.tickIfDue(wallMs);
  }

  setActiveBundles(bundles: ReadonlySet<number>): void {
    this.runtime.setActiveBundles(bundles);
  }

  // A bundle that has just become active runs its main thread now, with the
  // clock where it is, so what it places rides the world entry being built.
  runReadyThreads(): void {
    this.runtime.runReadyThreads();
  }

  notePlayerSpawned(): void {
    this.runtime.reportPlayerSpawned();
  }

  // PlayerSensor.is_dead: the death edge from the session's own
  // kill classification, the respawn edge from the player_spawned incident.
  notePlayerDied(characterKey: string): void {
    this.runtime.reportPlayerDied(characterKey);
  }

  notePlayerRespawned(characterKey: string): void {
    this.runtime.reportPlayerRespawned(characterKey);
  }

  notePlayerMonitor(bundle: number, typeIndex: number, count: number): void {
    this.runtime.reportPlayerMonitor({ bundle, typeIndex }, count);
  }

  noteSquadAlive(bundle: number, typeIndex: number, count: number): void {
    this.runtime.reportSquadAlive({ bundle, typeIndex }, count);
  }

  noteSquadTally(bundle: number, typeIndex: number, tally: number[]): void {
    this.runtime.reportSquadTally({ bundle, typeIndex }, tally);
  }

  noteActorBound(
    bundle: number,
    typeIndex: number,
    unknown9: boolean,
    unknown10: boolean
  ): void {
    this.runtime.reportActorBound({ bundle, typeIndex }, unknown9, unknown10);
  }

  noteObjectAlive(bundle: number, typeIndex: number, alive: boolean): void {
    this.runtime.reportObjectAlive({ bundle, typeIndex }, alive);
  }

  noteTriggerFired(bundle: number, typeIndex: number): void {
    this.runtime.reportTriggerFired({ bundle, typeIndex });
  }

  noteCinematicFinished(bundle: number, typeIndex: number): void {
    this.runtime.reportCinematicFinished({ bundle, typeIndex });
  }

  // A client incident the session models nowhere else, for the listeners a
  // script bound to its name hash (mission 3's weapon pickup).
  noteClientIncident(nameHash: number): void {
    this.runtime.reportClientIncident(nameHash);
  }

  noteSquadKill(ident: number, at?: IncidentPosition): void {
    this.runtime.reportSquadKill(ident, at);
  }

  noteKillIncident(details: KillFilterDetails): void {
    this.runtime.reportKill(details);
  }

  notePlayerJoined(characterKey: string): void {
    this.runtime.notePlayerJoined(characterKey);
  }

  notePlayerLeft(characterKey: string): void {
    this.runtime.notePlayerLeft(characterKey);
  }

  noteInteraction(carries: (name: number) => boolean): void {
    this.runtime.reportInteraction(carries);
  }

  noteLootGathered(carries: (material: number) => boolean): void {
    this.runtime.reportLootGathered(carries);
  }

  noteHealth(
    bundle: number,
    typeIndex: number,
    current: number,
    max: number
  ): void {
    this.runtime.reportHealth({ bundle, typeIndex }, current, max);
  }

  noteActorDropAck(
    bundle: number,
    typeIndex: number,
    dropId: number | undefined,
    inProgress: boolean
  ): void {
    this.runtime.reportActorDropAck({ bundle, typeIndex }, dropId, inProgress);
  }

  noteActorStanding(
    bundle: number,
    typeIndex: number,
    epoch: number | undefined,
    standing: boolean
  ): void {
    this.runtime.reportActorStanding({ bundle, typeIndex }, epoch, standing);
  }

  noteActorCommandScriptSense(
    bundle: number,
    typeIndex: number,
    progress: CommandScriptProgress
  ): void {
    this.runtime.reportActorCommandScript({ bundle, typeIndex }, progress);
  }
}

export function scriptHostFor(
  options: ScriptHostOptions
): ScriptHost | undefined {
  if (bundleTags(options.activityName).length === 0) {
    return;
  }
  const host = new ScriptHost(options);
  return host.runtime.scriptTags.length > 0 ? host : undefined;
}
