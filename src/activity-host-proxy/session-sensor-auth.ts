import { event_message } from "@blamnetwork/datamine";
import {
  activityBinder,
  activityBubble,
  activityBundles,
  activitySensors,
  bubbleSensors,
  loadedBundles,
  slotSensors,
  squadDefinition,
  triggerGroupVolume,
  worldTags,
} from "../content";
import { activityBundleItemType } from "../content/row-types";
import {
  describeDebugToggles,
  readDebugToggles,
} from "../dev-config/debug-toggles";
import { activityInstanceFor } from "./activity-instance";
import { debugStart } from "./debug-start";
import { ActivityHostMessageType } from "./messages";
import { rowKey } from "./mission/row-state";
import type { ApplyScope } from "./rsat";
import {
  buildApplySenseEntries,
  buildBinderSenseEntries,
  buildSensorAuthPromoteRsat,
  buildSensorAuthTickRsat,
  buildSensorAuthUpdateRsat,
  playerKeyFromCharacter,
  type SensorAuthSenseEntry,
} from "./rsat";
import {
  encodeSquadAuth,
  encodeTriggerGroupAuth,
  type PlayerRowsState,
} from "./rsat/sensor-auth-fields";
import { scenarioClient } from "./scenario-client";
import { ScriptHost } from "./script-host/runtime";
import type { SessionContext } from "./session-context";
import { activityHostBuild } from "./versions";

// The row types that place entities in a world.
function placedRowTypes(): ReadonlySet<number> {
  const type = activityBundleItemType();
  return new Set([type.Squad, type.Actor, type.Object]);
}

// The activities whose public host gets the minimal join grant and whose
// authority table is kept by hand (authorityBubbles). Why only the venus_
// activities need this is unknown; other activities with a public host may
// need it too.
function minimalGrantActivity(activityName: string | undefined): boolean {
  return activityName?.startsWith("venus_") ?? false;
}

// The session's SensorAuth updates to its client: the join grant, the
// world's rows, the authority promote and the idle tick.
export class SensorAuthPushes {
  // Every slice this host has sent a dest apply for. The guest holds those
  // tables, so a row update for any of them is deliverable, not only for the
  // bubble the player is standing in.
  readonly appliedSlices = new Set<number>();
  // The global bundle tags this host's world has built since it entered the
  // world. They are built once per activity and kept across slice sets, so a
  // swap only needs their sensors of the new slice set.
  private readonly builtGlobals = new Set<number>();
  private granted = false;

  constructor(private readonly session: SessionContext) {}

  opts() {
    const activityName = this.session.activityName();
    return {
      activityTime: this.session.activityTicks(),
      activityName,
      authorityMachine: this.session.joinIdentity?.machine,
      // The character id, not the 8-byte join player id.
      playerKey: playerKeyFromCharacter(this.session.joinIdentity?.character),
      scenario: activityName ? scenarioClient(activityName) : undefined,
    };
  }

  // The tables are held while an entity slot handoff is purging or a crossing
  // is within the commit band (phase 3 and up).
  get tablesHeld(): boolean {
    const { crossing, entitySlots } = this.session;
    if (entitySlots.awaitingPurge) {
      return true;
    }
    return (
      crossing.crossingInFlight &&
      crossing.transitionPhase !== undefined &&
      crossing.transitionPhase >= 3
    );
  }

  // The player rows' occupants: each member in its membership slot (the row
  // players[slot]), with what the script host knows of them. Before the
  // instance has anyone, this client in slot 0.
  playerRows(activityName: string, ownKey: bigint): PlayerRowsState {
    const keys = new Map<number, bigint>();
    for (const member of activityInstanceFor(
      activityName,
      this.session.hosts
    ).all()) {
      keys.set(member.slot, playerKeyFromCharacter(member.identity.character));
    }
    if (keys.size === 0) {
      keys.set(0, ownKey);
    }
    const host = this.session.scripts.host;
    const rows = host instanceof ScriptHost ? host.itemSink : undefined;
    if (!rows) {
      return {
        occupants: new Map([...keys].map(([slot, key]) => [slot, { key }])),
      };
    }
    rows.setOccupants(keys);
    return rows.players();
  }

  // The join grant. The FAH's carries the authority table and the Lifetime and
  // Player rows (~261 B); a minimal-grant activity's GAH gets ~43 B with no
  // table.
  pushJoinGrant(sessionId: bigint): void {
    if (this.granted) {
      return;
    }
    const opts = this.opts();
    const activityName = opts.activityName ?? "";
    const { kind } = this.session;
    const grantMode =
      kind === "GAH" && minimalGrantActivity(activityName)
        ? "minimal"
        : "authority";
    const bubbles = opts.scenario?.bubbleCount ?? 5;
    // An activity without a binder gets the grant without rows.
    const binder = activityBinder(activityName);
    if (binder) {
      const follows = activityHostBuild().applyLayout.minimalBinderGrant;
      const hasAuthorityTable = !follows || grantMode !== "minimal";
      const host = this.session.scripts.host;
      const grant = buildSensorAuthUpdateRsat({
        activityTime: opts.activityTime,
        authorityMachine: opts.authorityMachine,
        bubbleCount: bubbles,
        emptyBubbles: opts.scenario?.emptyBubbles,
        hasAuthorityTable,
        occupiedBubbles: this.authorityBubbles(),
        senseEntries: buildBinderSenseEntries(
          binder,
          this.playerRows(activityName, opts.playerKey),
          host instanceof ScriptHost
            ? host.itemSink?.lifetimeBody()
            : undefined,
          follows && minimalGrantActivity(activityName)
        ),
      });
      this.session.pushAh(
        sessionId,
        ActivityHostMessageType.SensorAuthUpdate,
        grant,
        `sensor-auth ${grant.length}B ${kind} binder grant ` +
          `activity=${activityName}` +
          (hasAuthorityTable ? ` 0..${bubbles - 1}+64` : " no table"),
        { keepRows: true }
      );
      this.granted = true;
      return;
    }
    const grant = buildSensorAuthUpdateRsat({
      activityTime: opts.activityTime,
      authorityMachine: opts.authorityMachine,
      bubbleCount: opts.scenario?.bubbleCount ?? 1,
      emptyBubbles: opts.scenario?.emptyBubbles,
      hasAuthorityTable: grantMode !== "minimal",
      occupiedBubbles: this.authorityBubbles(),
    });
    this.session.pushAh(
      sessionId,
      ActivityHostMessageType.SensorAuthUpdate,
      grant,
      `sensor-auth ${grant.length}B ${kind} identity grant ` +
        `mode=${grantMode} activity=${opts.activityName ?? "default"}` +
        (grantMode === "minimal" ? "" : ` 0..${bubbles - 1}+64`)
    );
    this.granted = true;
  }

  // The rowless update ahead of a world's own rows (pushApply): hasAuth=0 and
  // the activity time.
  pushRowlessApply(sessionId: bigint, slice: number, label?: string): void {
    // Held while the slot handoff is in flight; completeSlotHandoff sends it.
    if (this.session.retired || this.session.entitySlots.awaitingPurge) {
      return;
    }
    const opts = this.opts();
    const scope = this.applyScope();
    const rsat = buildSensorAuthTickRsat(opts.activityTime);
    // No de-duplication, deliberately: the guest can discard an apply
    // ("discarded auth update because we are expecting an initial update"),
    // and then only the next full table for that slice rescues it.
    this.appliedSlices.add(slice);
    // Rows follow this one when the activity has bundles; a build whose apply
    // is its rows alone sends nothing ahead of them.
    if (
      label === undefined &&
      activityHostBuild().applyLayout.rowsOnlyApply &&
      activityBundles(opts.activityName) !== undefined
    ) {
      return;
    }
    this.session.pushAh(
      sessionId,
      ActivityHostMessageType.SensorAuthUpdate,
      rsat,
      `sensor-auth ${rsat.length}B ${this.session.kind} apply hasAuth=0 scope=${scope} ` +
        `activity=${opts.activityName ?? "default"} slice=${slice}` +
        (label === undefined ? "" : ` (${label})`)
    );
  }

  // An activity's rows for this host's world in a bubble. The guest recreates
  // its sensor client on the world transition, so a world entry carries the
  // binder rows again and a zero auth for every sensor the world builds (the
  // client applies nothing until each has had one); a slice-set swap carries
  // the global bundles' sensors of the new slice set and the bubble's own
  // bundles. What the scripts wrote replaces those zero auths.
  pushApply(
    sessionId: bigint,
    activityName: string,
    bubble: number,
    worldEntry: boolean
  ): void {
    const { crossing, kind, scripts } = this.session;
    const loaded = activityBubble(
      activityName,
      bubble,
      crossing.currentBubbleState
    );
    if (this.session.retired || !loaded) {
      return;
    }
    const opts = this.opts();
    const toggles = readDebugToggles();
    if (worldEntry) {
      this.builtGlobals.clear();
      event_message(
        "activities:host: debug toggles %s",
        describeDebugToggles(toggles)
      );
    }
    const sensors = this.worldTags(activityName, bubble).flatMap((tag) => {
      const global = loaded.global.includes(tag.tag);
      const built = global && this.builtGlobals.has(tag.tag);
      if (global) {
        this.builtGlobals.add(tag.tag);
      }
      const own = activityHostBuild().applyLayout.fillsBundleSlots
        ? slotSensors([tag], bubble)
        : bubbleSensors([tag], bubble).map((sensor) => ({
            ...sensor,
            foreign: false,
          }));
      return own.filter((sensor) => !built || sensor.sliceSet === bubble);
    });
    if (worldEntry) {
      sensors.push(
        ...this.activityWideSensors(activityName).map((sensor) => ({
          ...sensor,
          foreign: false,
        }))
      );
    }
    const binder =
      worldEntry && kind === "FAH" ? activityBinder(activityName) : undefined;
    const host = scripts.host;
    const rows = host instanceof ScriptHost ? host.itemSink : undefined;
    rows?.setDebugToggles(toggles.toggles);
    // A crossing's world entry runs the newly active bundles first, with the
    // clock where it is, so what they place rides the entry. The first entry's
    // scripts start 1.5 s after it, unless it is a debug start into a later
    // phase.
    if (
      worldEntry &&
      (scripts.scriptsTicked || debugStart(activityName) !== undefined) &&
      host instanceof ScriptHost
    ) {
      const active = loadedBundles(
        activityName,
        bubble,
        crossing.currentBubbleState
      );
      if (active) {
        host.setActiveBundles(active);
        host.runReadyThreads();
      }
    }
    const layout = activityHostBuild().applyLayout;
    const applySensors = sensors.map((sensor) => {
      // A trigger group's idle body refs the volume it watches; a zero auth
      // would ref bundle 0 / row 0.
      if (sensor.typeId === activityBundleItemType().TriggerGroup) {
        return {
          ...sensor,
          idle: encodeTriggerGroupAuth(
            triggerGroupVolume(activityName, sensor.bundle, sensor.typeIndex)
          ),
        };
      }
      // A sensor of a slice set the guest has not loaded is hollow where it
      // places entities.
      if (sensor.foreign && placedRowTypes().has(sensor.typeId)) {
        return { ...sensor, hollow: true };
      }
      const squad =
        layout.squadsAtDefinition &&
        sensor.typeId === activityBundleItemType().Squad
          ? squadDefinition(activityName, sensor.bundle, sensor.typeIndex)
          : undefined;
      return squad
        ? {
            ...sensor,
            idle: encodeSquadAuth({
              bindingGeneration: 1,
              objective:
                host instanceof ScriptHost
                  ? host.squadObjective(sensor.bundle, sensor.typeIndex)
                  : undefined,
              roster: Array.from({ length: squad.cells }, () => 0),
            }),
          }
        : sensor;
    });
    // A row can be in several tag copies of its bundle; it goes out once.
    const senseEntries = buildApplySenseEntries({
      binder,
      lifetime: rows?.lifetimeBody(),
      players: this.playerRows(activityName, opts.playerKey),
      scripted:
        host instanceof ScriptHost ? host.itemSink?.entries() : undefined,
      sensors: applySensors,
    });
    const rsat = buildSensorAuthUpdateRsat({
      activityTime: opts.activityTime,
      hasAuthorityTable: false,
      senseEntries,
    });
    this.session.pushAh(
      sessionId,
      ActivityHostMessageType.SensorAuthUpdate,
      rsat,
      `sensor-auth ${rsat.length}B ${kind} apply rows ` +
        `activity=${activityName} bubble=${bubble}.${crossing.currentBubbleState}` +
        `${worldEntry ? " world entry" : ""} rows=${senseEntries.length}`,
      { keepRows: true }
    );
  }

  // The promote after a state refresh. The guest discards every update until
  // one arrives with the authority table bit set, so the join grant alone
  // never initialises the in-world client. The table must match the grant: a
  // held slot missing from a later table asserts, and so does a held slot
  // with a new sequence.
  pushPromote(sessionId: bigint): void {
    if (this.session.retired) {
      return;
    }
    const opts = this.opts();
    const bubbles = this.authorityBubbles();
    const rsat = buildSensorAuthPromoteRsat({
      activityTime: opts.activityTime,
      authorityMachine: opts.authorityMachine,
      scenario: opts.scenario,
      slices: bubbles,
    });
    this.session.pushAh(
      sessionId,
      ActivityHostMessageType.SensorAuthUpdate,
      rsat,
      `sensor-auth ${rsat.length}B ${this.session.kind} promote ` +
        `bubbles=${bubbles?.join(",") ?? "all"} ` +
        `activity=${opts.activityName ?? "default"}`
    );
  }

  // The idle tick: activity time only, no bundle items.
  pushTick(sessionId: bigint): void {
    const rsat = buildSensorAuthTickRsat(this.session.activityTicks());
    this.session.pushAh(
      sessionId,
      ActivityHostMessageType.SensorAuthUpdate,
      rsat,
      `sensor-auth ${rsat.length}B ${this.session.kind} tick`
    );
  }

  pushRows(entries: readonly SensorAuthSenseEntry[]): void {
    const { boundSessionId } = this.session;
    if (boundSessionId === undefined || entries.length === 0) {
      return;
    }
    const rsat = buildSensorAuthUpdateRsat({
      activityTime: this.opts().activityTime,
      hasAuthorityTable: false,
      senseEntries: entries,
    });
    this.session.pushAh(
      boundSessionId,
      ActivityHostMessageType.SensorAuthUpdate,
      rsat,
      `sensor-auth ${rsat.length}B ${this.session.kind} script rows ` +
        entries
          .map(({ clientRef: r }) => `t${r.typeId}#${r.typeIndex}`)
          .join(","),
      { keepRows: true }
    );
  }

  // Sensor rows (bundle:type:index) this host's world has in its current
  // bubble: where a script-written row can go now.
  worldRows(activityName: string): Set<string> | undefined {
    const { boundSessionId, crossing } = this.session;
    const bubble = crossing.clientBubble ?? crossing.currentSlice;
    if (boundSessionId === undefined || bubble === undefined) {
      return;
    }
    return new Set(
      [
        ...bubbleSensors(this.worldTags(activityName, bubble), bubble),
        ...this.activityWideSensors(activityName),
      ].map((sensor) => rowKey(sensor.bundle, sensor.typeId, sensor.typeIndex))
    );
  }

  // Re-sends the full tables, only for the bubble the client is in. The
  // bubble is the one it has swapped into (state refresh), not currentSlice,
  // which follows a crossing's announcement and stays there when the client
  // turns back. Republishing a bubble the guest has since unloaded touches
  // slots naming entities it destroyed and bug-checks on the cookie compare.
  republishTables(label: string): void {
    const { boundSessionId, crossing } = this.session;
    const slice = crossing.clientBubble ?? crossing.currentSlice;
    if (
      boundSessionId === undefined ||
      slice === undefined ||
      this.tablesHeld
    ) {
      return;
    }
    if (!this.appliedSlices.has(slice)) {
      return;
    }
    this.pushRowlessApply(boundSessionId, slice, label);
  }

  // Rows resolve to objects in a specific world, and the guest asserts when
  // the applying client's world is another. With a GAH attached the bubble's
  // world rows go through it and the FAH keeps the player-scoped rows.
  private applyScope(): ApplyScope {
    // A lone FAH (the Tower, or any activity before its first public host)
    // owns every table. Once the activity has had a public host the FAH never
    // carries the public world's tables again, even between public hosts.
    const { hosts, kind } = this.session;
    if (!(hosts.isGahBound() || hosts.hasHadGah())) {
      return "all";
    }
    return kind === "GAH" ? "public" : "private";
  }

  // The tags this host's world builds in a bubble: everything for a lone
  // host, otherwise the private or the public world.
  private worldTags(activityName: string, bubble: number) {
    const scope = this.applyScope();
    return scope === "none"
      ? []
      : worldTags(
          activityName,
          bubble,
          scope,
          this.session.crossing.currentBubbleState
        );
  }

  // The activity-wide sensors a private world builds in every bubble
  // (activitySensors); a public host's world has none of them.
  private activityWideSensors(activityName: string) {
    const scope = this.applyScope();
    return activityHostBuild().applyLayout.activityWideSensors &&
      (scope === "all" || scope === "private")
      ? activitySensors(activityName)
      : [];
  }

  // The bubbles the authority table promotes (plus the domain slot); undefined
  // means every non-empty bubble, the Tower's shape. The table follows the
  // player: a squad sensor only runs its auth handlers while the guest holds
  // authority over its slice set, and only this table sets that. It only
  // grows, because a held slot missing from a later table asserts.
  private authorityBubbles(): readonly number[] | undefined {
    const opts = this.opts();
    if (!minimalGrantActivity(opts.activityName)) {
      return;
    }
    const { crossing } = this.session;
    const initial = opts.scenario?.initialBubble;
    if (initial !== undefined) {
      crossing.promotedBubbles.add(initial);
    }
    if (crossing.currentSlice !== undefined) {
      crossing.promotedBubbles.add(crossing.currentSlice);
    }
    // The bubble the client last reported, not just the one we moved our own
    // state to: a state refresh promotes before it advances currentSlice.
    if (crossing.clientBubble !== undefined) {
      crossing.promotedBubbles.add(crossing.clientBubble);
    }
    return [...crossing.promotedBubbles].filter(
      (bubble) => !crossing.abdicatedBubbles.has(bubble)
    );
  }
}
