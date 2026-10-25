import { event_message, event_warning } from "@blamnetwork/datamine";
import {
  activityBubble,
  activityBundles,
  activityPrivate,
  bubbleState,
  phaseStart,
} from "../content";
import { activityStart } from "../content/start-config";
import { activityInstanceFor } from "./activity-instance";
import { hexPreview } from "./hex-preview";
import type { AhClientIdentity } from "./join";
import type { PlayerHosts } from "./player-hosts";
import {
  type PendingRegion,
  packBubbleStateHandle,
  parseClientAuthoritativeData,
  unpackBubbleStateHandle,
} from "./rsat";
import type { ClientAuthReport, ClientHardWipe } from "./rsat/client-reports";
import type { ClientEcho } from "./rsat/membership";
import { scenarioClient } from "./scenario-client";
import { activityHostBuild } from "./versions";

// Whether a bubble is one the activity serves: the ones its scenario gives a
// state.
export function servesBubble(activityName: string, bubble: number): boolean {
  return activityBubble(activityName, bubble) !== undefined;
}

// A pending region without the client's transition token, other than the
// crossing under way: after a swap the client parks the region it just left in
// its pending slot. It is not a crossing and must not be applied.
export function isLeftBehindRegion(
  pendingId: number,
  token: number | undefined,
  crossing: { regionId: number } | undefined
): boolean {
  return token === undefined && crossing?.regionId !== pendingId;
}

// Phases 2-4 of a client's transition are the crossing itself walking to
// the commit line.
function isCrossingPhase(phase: number | undefined): boolean {
  return phase !== undefined && phase >= 2 && phase <= 4;
}

// What the region crossing needs of its session.
interface RegionCrossingHost {
  activityName(): string | undefined;
  boundSessionId(): bigint | undefined;
  flushClaims(sessionId: bigint): void;
  hosts(): PlayerHosts;
  joinIdentity(): AhClientIdentity | undefined;
  membershipPushes(): number;
  // The client reported its hard wipe (class 21).
  noteHardWipe(report: ClientHardWipe): void;
  phaseHash(activityName: string): number | undefined;
  pushApply(
    sessionId: bigint,
    activityName: string,
    bubble: number,
    worldEntry: boolean
  ): void;
  pushMembership(sessionId: bigint, force?: boolean): void;
  pushSensorAuthApply(sessionId: bigint, slice: number): void;
  pushSensorAuthPromote(sessionId: bigint): void;
  retired(): boolean;
  worldEntered(): boolean;
}

// Where a client is in the world and the crossing it is making: the bubble
// it stands in, the slice-set transition it announces (class 21), the
// teleportation the host runs, and the tables promoted to it on the way.
export class RegionCrossing {
  // Slice-set transition announced by the client (class 21): the pending
  // region id and the transition token that its PAH row must carry.
  pendingRegion: PendingRegion | undefined;
  // The bubble and token a pending-region crossing last opened. A crossing that
  // did not commit is re-announced with a new token, so keying on the bubble
  // alone would latch the first attempt. The dest apply rides the handoff gate
  // (applyPendingRegion).
  appliedPendingBubble: number | undefined;
  appliedPendingToken: number | undefined;
  currentSlice: number | undefined;
  // The state of currentSlice's bubble (a region is bubble << 3 | state).
  // A story activity swaps a bubble to a phase's own state and back.
  currentBubbleState = 0;
  // The crossing under way only changes currentSlice's state: the swap's
  // apply waits for the client's refresh of that same bubble.
  bubbleStateSwap = false;
  // The region a client left at its last crossing between bubbles,
  // with that crossing's token. Its PAH row (flag false) stays until the
  // client stops naming it (pending -1, phase 0) or crosses again.
  leftBehindRegion: PendingRegion | undefined;
  // The region the client was in when its current crossing opened.
  regionBeforeCrossing: number | undefined;
  // The transition token the client last announced; the PAH rows keep it as
  // their marker after the crossing has landed.
  lastTransitionToken = 0;
  // The region hash a client reports beside each region id in its
  // transition (class 21). The GAS names it as the spawn transition of the
  // region the client is in.
  readonly clientRegionHashes = new Map<number, number>();
  // The client's transition as it last reported it (class 21, merged).
  private clientTransition: ClientEcho | undefined;
  // The id of the last teleportation this client reported (class 21).
  private clientTeleportId = 0;
  // Bubbles the authority table has promoted. It only ever grows: the guest
  // asserts when a slot it holds goes missing from a later table.
  readonly promotedBubbles = new Set<number>();
  // Bubbles the client has given authority over back to us at a swap. Kept
  // out of every later promote until a crossing leads back into them.
  readonly abdicatedBubbles = new Set<number>();
  // From a crossing's opening until the swap lands (or the client stops the
  // transition) no full republish or incremental row push goes out: the guest
  // applies a SensorAuth from a simulation-queue drain, so a table sent just
  // before a swap lands after it, in the rebuilt sensor array (cookie assert).
  // Held rows stay dirty and ride the next apply.
  crossingInFlight = false;
  // The client's last reported transition phase. The hold above applies from
  // phase 3 only (the band nearest the commit line): a crossing opens at phase
  // 1 in the hysteresis band, and a player loitering near a load zone must not
  // freeze table and objective updates.
  transitionPhase: number | undefined;
  // Bubble the client last reported in its state-refresh (undefined = none).
  clientBubble: number | undefined;

  constructor(private readonly host: RegionCrossingHost) {}

  // Class 21: the client's own view of its slice-set transition. A valid
  // pending region means it is heading for a load zone; the slice-set-switch
  // task then waits for a PAH row {regionId: pending, markers[slot]: token}
  // in the membership table.
  handleClientAuth(sessionId: bigint, payload: Buffer): void {
    const data = parseClientAuthoritativeData(payload);
    const transition = data?.transition;
    const pending = transition?.pending;
    const pendingId = pending?.regionId ?? -1;
    // The phase and token go into the PAH rows (committed, marker), so they and
    // the region left behind by a swap are taken before the echo below: the
    // table keeps that row, flag false, for as long as the client names it.
    if (transition?.phase !== undefined) {
      this.transitionPhase = transition.phase;
    }
    if (transition?.token !== undefined) {
      this.lastTransitionToken = transition.token;
    }
    if (
      transition &&
      pending &&
      pendingId >= 0 &&
      isLeftBehindRegion(pendingId, transition.token, this.pendingRegion)
    ) {
      this.leftBehindRegion = {
        regionId: pendingId,
        token: this.pendingRegion?.token ?? this.lastTransitionToken,
      };
    } else if (
      transition &&
      pendingId < 0 &&
      (transition.pending !== undefined || transition.current) &&
      !isCrossingPhase(transition.phase ?? this.transitionPhase)
    ) {
      // The client has stopped naming it: the table drops the row with the
      // echo (2.3.1 capture).
      this.leftBehindRegion = undefined;
    }
    this.noteClientIdentity(sessionId, data);
    this.noteClientTeleport(sessionId, data);
    if (data?.hardWipe) {
      this.host.noteHardWipe(data.hardWipe);
    }
    event_message(
      "activities:host:region: client-auth %dB session=0x%I64x %s%s",
      payload.length,
      sessionId,
      data
        ? `current=${transition?.current?.regionId ?? "-"} pending=${pendingId} ` +
            `token=${transition?.token ?? "-"} phase=${transition?.phase ?? "-"}`
        : `undecoded body=${hexPreview(payload)}`,
      payload.length <= 64 ? ` hex=${payload.toString("hex")}` : ""
    );
    if (!transition) {
      return;
    }
    for (const region of [transition.current, transition.pending]) {
      if (region && region.regionId >= 0) {
        this.clientRegionHashes.set(region.regionId, region.unknown1 >>> 0);
      }
    }
    // The client naming the crossing's region as its current one is the swap
    // landing, whether or not a state refresh follows it.
    if (
      transition.current &&
      this.pendingRegion?.regionId === transition.current.regionId
    ) {
      this.crossingInFlight = false;
    }
    // Only a client-auth carrying its own transition token opens a crossing
    // (the client assigns a fresh token to every attempt, retries included). A
    // pending region without one is a follow-up for the crossing under way or,
    // right after a swap, the region the client just left; borrowing the
    // previous token for it would open a crossing back out whose apply lands in
    // the world the guest just tore down (cookie assert).
    if (
      pending &&
      pendingId >= 0 &&
      isLeftBehindRegion(pendingId, transition.token, this.pendingRegion)
    ) {
      event_message(
        "activities:host:region: client-auth pending=%d carries no transition token - not a crossing (the region left behind by a swap)",
        pendingId
      );
      return;
    }
    // Transition stopped (phase 0) before the swap landed: the player turned
    // back. currentSlice moved to the crossing's bubble when it was announced
    // and has to come back, or everything keyed on it goes to a bubble the
    // client never loaded.
    if (
      !(pending && pendingId >= 0) &&
      transition.phase === 0 &&
      this.crossingInFlight
    ) {
      this.abandonCrossing();
    }
    if (pending && pendingId >= 0) {
      const token = transition.token ?? this.pendingRegion?.token ?? 0;
      const next = { regionId: pendingId, token };
      const same =
        this.pendingRegion?.regionId === next.regionId &&
        this.pendingRegion?.token === next.token;
      this.pendingRegion = next;
      if (!same) {
        this.applyPendingRegion(sessionId, pendingId, token);
        this.host.pushMembership(sessionId, true);
      }
      this.host.flushClaims(sessionId);
    } else if (
      (transition.pending !== undefined || transition.current) &&
      !isCrossingPhase(transition.phase ?? this.transitionPhase)
    ) {
      // Pending cleared is not always an abort: phases 2-4 are the crossing
      // walking to the commit line, and the switch task's last gate at phase 4
      // is the PAH row for the region it enters, so keep it until the client
      // stops (0) or the swap lands (5). Class 21 is a delta, so an update
      // without the phase leaves it where it was, and mid-crossing the client
      // reports its current region gone (-1) on its own.
      this.pendingRegion = undefined;
      this.crossingInFlight = false;
    }
  }

  // A client's teleportation state (class 21). It goes back out in its
  // membership slot, and moves the host's teleportation on: the host reports
  // 3 once the client has completed it (its world entry into the teleport's
  // region), and 0 once the client has gone inactive again (2.3.1 capture).
  private noteClientTeleport(
    sessionId: bigint,
    data: ClientAuthReport | undefined
  ): void {
    this.noteClientTransition(sessionId, data);
    const teleport = data?.teleport;
    const activityName = this.host.activityName();
    const identity = this.host.joinIdentity();
    if (!(teleport && activityName && identity)) {
      return;
    }
    const instance = activityInstanceFor(activityName, this.host.hosts());
    const member = instance.member(identity);
    if (member && this.echoesClientTransition(activityName)) {
      member.clientTeleport = data?.echo?.teleport;
      member.clientTransition = this.clientTransition;
    }
    this.clientTeleportId = teleport.id;
    event_message(
      "activities:host:region: client teleport state=%s id=%s region=%s",
      teleport.state,
      teleport.id,
      teleport.region
    );
    const host = instance.teleport;
    if (host && teleport.id === host.id) {
      if (teleport.state === 3 && host.state < 3) {
        host.state = 3;
      } else if (teleport.state === 0 && host.state === 3) {
        host.state = 0;
      }
    }
    if (this.host.membershipPushes() >= 1) {
      this.host.pushMembership(sessionId, true);
    }
  }

  // A client's transition (class 21), its deltas merged. A teleport's switch
  // waits for every peer to synchronise: the client compares the
  // teleportation's id with each occupied slot's echoed transition u8 in the
  // membership and holds the switch at phase 4 ("Still waiting on peers to
  // synchronize") until they match, so the whole transition is echoed.
  private noteClientTransition(
    sessionId: bigint,
    data: ClientAuthReport | undefined
  ): void {
    const transition = data?.echo?.transition;
    if (!transition) {
      return;
    }
    const changed = Object.fromEntries(
      Object.entries(transition).filter(([, value]) => value !== undefined)
    );
    this.clientTransition = {
      ...transition,
      ...this.clientTransition,
      ...changed,
    };
    const activityName = this.host.activityName();
    const identity = this.host.joinIdentity();
    if (!(activityName && identity)) {
      return;
    }
    const instance = activityInstanceFor(activityName, this.host.hosts());
    const member = instance.member(identity);
    if (member && this.echoesClientTransition(activityName)) {
      member.clientTransition = this.clientTransition;
      if (this.host.membershipPushes() >= 1) {
        this.host.pushMembership(sessionId, true);
      }
    }
  }

  // The 2.3.1 capture echoes a client's transition and teleportation in its
  // membership slot at every step. We do so for a private activity and for any
  // activity once the host has run a teleportation; a public-host activity that
  // never teleports (venus_portal_1) keeps its membership as is.
  private echoesClientTransition(activityName: string): boolean {
    return (
      (activityHostBuild().membership.echoesClientData &&
        activityPrivate(activityName)) ||
      activityInstanceFor(activityName, this.host.hosts()).teleport !==
        undefined
    );
  }

  // The world a phase moves to: when the running phase owns another state of
  // the client's bubble than the one it is in (or none, while it is in a
  // phase's own), the host teleports every client there (the membership's
  // teleportation goes 1 then 2, 0.1 s apart) and the client enters by the
  // spawn transition.
  stepTeleport(activityName: string): void {
    const sessionId = this.host.boundSessionId();
    if (
      sessionId === undefined ||
      !this.host.worldEntered() ||
      !this.host.joinIdentity()
    ) {
      return;
    }
    const instance = activityInstanceFor(activityName, this.host.hosts());
    const running = instance.teleport;
    if (running?.state === 1) {
      running.state = 2;
      this.host.pushMembership(sessionId, true);
      return;
    }
    if (running && running.state !== 0) {
      return;
    }
    const phaseNow = this.host.phaseHash(activityName);
    if (instance.teleportHeldForPhase !== undefined) {
      if (instance.teleportHeldForPhase === phaseNow) {
        return;
      }
      instance.teleportHeldForPhase = undefined;
    }
    // A crossing the client has committed to (phase 3 and up) runs its course
    // first. One it is only standing in (phase 1-2) does not hold the teleport:
    // the capture starts it regardless and drops the crossing's PAH row.
    if (this.pendingRegion && (this.transitionPhase ?? 0) >= 3) {
      return;
    }
    const phase = this.host.phaseHash(activityName);
    const bubbleBefore = this.clientBubble ?? this.currentSlice;
    if (bubbleBefore === undefined || phase === undefined) {
      return;
    }
    const state = bubbleState(activityName, bubbleBefore, phase);
    if (state === this.currentBubbleState) {
      return;
    }
    if (this.pendingRegion) {
      this.abandonCrossing();
    }
    const bubble = this.currentSlice;
    if (bubble === undefined) {
      return;
    }
    const id = Math.max(this.clientTeleportId, running?.id ?? 0) + 1;
    instance.teleport = {
      id,
      region: packBubbleStateHandle(bubble, state),
      state: 1,
      transition: scenarioClient(activityName)?.spawnTransition ?? 0,
    };
    event_message(
      "activities:host:region: teleport %d to %d.%d (phase 0x%x)",
      id,
      bubble,
      state,
      phase
    );
    this.host.pushMembership(sessionId, true);
  }

  // A teleport the debugger asks for: every client of the instance into
  // `region` (a packed bubble.state handle), entering by `transition` (the
  // spawn point's name hash). It runs as the phase's own do, and holds those
  // back until the phase changes.
  debugTeleport(region: number, transition: number): string {
    return this.teleport(region, transition, "debugger");
  }

  // A hard wipe brings every client back at the start of the running phase: the
  // host teleports them to the phase's own state of its bubble, by the spawn
  // point the region is known by, while they are on their wipe screens. Without
  // it a forced respawn lands on the breadcrumbs, near where the fireteam fell.
  teleportToPhaseStart(activityName: string, phaseIndex: number): string {
    const start = phaseStart(activityName, phaseIndex);
    if (!start) {
      return "the phase has no start to come back to";
    }
    const region = packBubbleStateHandle(start.bubble, start.state);
    const transition =
      activityStart(activityName)?.regionSpawnTransitions[region] ??
      scenarioClient(activityName)?.spawnTransition ??
      0;
    return this.teleport(region, transition, "hard wipe");
  }

  // The host's teleportation has not come back to 0: the client has not
  // reported it done and gone inactive again.
  teleporting(activityName: string): boolean {
    const running = activityInstanceFor(
      activityName,
      this.host.hosts()
    ).teleport;
    return running !== undefined && running.state !== 0;
  }

  private teleport(region: number, transition: number, why: string): string {
    const activityName = this.host.activityName();
    const sessionId = this.host.boundSessionId();
    if (
      !(activityName && sessionId !== undefined && this.host.worldEntered())
    ) {
      return "the player is not in a world yet";
    }
    const instance = activityInstanceFor(activityName, this.host.hosts());
    const running = instance.teleport;
    // One still running is replaced: the client takes any id that differs
    // from its own as a new teleportation and drops the old one.
    const replaced =
      running && running.state !== 0
        ? ` (replaces ${running.id}, which stood at state ${running.state})`
        : "";
    if (this.pendingRegion) {
      this.abandonCrossing();
    }
    const id = Math.max(this.clientTeleportId, running?.id ?? 0) + 1;
    instance.teleport = { id, region, state: 1, transition };
    instance.teleportHeldForPhase = this.host.phaseHash(activityName);
    const { bubble, state } = unpackBubbleStateHandle(region);
    const line =
      `teleport ${id} to ${bubble}.${state} ` +
      `(transition 0x${(transition >>> 0).toString(16)})${replaced}`;
    event_message("activities:host:region: %s %s", why, line);
    this.host.pushMembership(sessionId, true);
    return line;
  }

  // Clears the host's teleportation (state 0), whatever state it stood at:
  // the client goes inactive and the phase's own teleports run again.
  debugTeleportClear(): string {
    const activityName = this.host.activityName();
    const sessionId = this.host.boundSessionId();
    if (!(activityName && sessionId !== undefined)) {
      return "no activity";
    }
    const instance = activityInstanceFor(activityName, this.host.hosts());
    const running = instance.teleport;
    instance.teleportHeldForPhase = undefined;
    if (!running || running.state === 0) {
      return "no teleport running";
    }
    const was = running.state;
    running.state = 0;
    this.host.pushMembership(sessionId, true);
    event_message(
      "activities:host:region: debugger cleared teleport %d",
      running.id
    );
    return `teleport ${running.id} cleared (was state ${was})`;
  }

  // The AH replicates each member's own class-21 identity back in its
  // membership slot. The guest keys its simulation player on member 5 of it:
  // without it the player is never added, and the Tower launch sits in
  // activity:initial_slice_set_loading waiting for a local player.
  private noteClientIdentity(
    sessionId: bigint,
    data: ClientAuthReport | undefined
  ): void {
    const identity = data?.echo?.identity;
    const activityName = this.host.activityName();
    const joined = this.host.joinIdentity();
    if (
      !(
        identity &&
        activityName &&
        joined &&
        activityHostBuild().membership.echoesClientData
      )
    ) {
      return;
    }
    const member = activityInstanceFor(activityName, this.host.hosts()).member(
      joined
    );
    if (!member) {
      return;
    }
    // Class 21 is a delta: an absent member means unchanged, not cleared.
    const changed = Object.fromEntries(
      Object.entries(identity).filter(([, value]) => value !== undefined)
    );
    member.clientAuth = { ...identity, ...member.clientAuth, ...changed };
    event_message(
      "activities:host:region: client identity slot=%d %s",
      member.slot,
      activityHostBuild().clientReports.describeIdentity(member.clientAuth)
    );
    if (this.host.membershipPushes() >= 1) {
      this.host.pushMembership(sessionId, true);
    }
  }

  // Starts the client in the scenario's bubble, until a crossing or a
  // refresh moves it.
  startAt(bubble: number, state: number): void {
    if (this.currentSlice === undefined) {
      this.currentSlice = bubble;
      this.currentBubbleState = state;
    }
  }

  // The client has abdicated `previousBubble` on its way to `bubble`: it holds
  // no slots there any more, so the bubble leaves the authority table until a
  // crossing leads back into it.
  abdicate(previousBubble: number, bubble: number): void {
    this.abdicatedBubbles.add(previousBubble);
    this.promotedBubbles.delete(previousBubble);
    this.abdicatedBubbles.delete(bubble);
  }

  // The client's refresh named `bubble`, which the activity serves: the swap
  // has landed and the crossing is over. `leavesRegionBehind` is for a
  // private activity, where the region the crossing left keeps its PAH row
  // (flag false) from the entry on (2.3.1 capture).
  landSwap(
    bubble: number,
    previousBubble: number | undefined,
    leavesRegionBehind: boolean
  ): void {
    this.currentSlice = bubble;
    this.appliedPendingBubble = undefined;
    this.crossingInFlight = false;
    this.appliedPendingToken = undefined;
    if (
      this.regionBeforeCrossing !== undefined &&
      previousBubble !== undefined &&
      previousBubble !== bubble &&
      leavesRegionBehind
    ) {
      this.leftBehindRegion = {
        regionId: this.regionBeforeCrossing,
        token: this.pendingRegion?.token ?? this.lastTransitionToken,
      };
    }
    this.regionBeforeCrossing = undefined;
  }

  private abandonCrossing(): void {
    if (
      this.clientBubble !== undefined &&
      this.currentSlice !== this.clientBubble
    ) {
      event_message(
        "activities:host:region: crossing into %s abandoned, back to slice %s",
        this.currentSlice,
        this.clientBubble
      );
      this.currentSlice = this.clientBubble;
    }
    this.pendingRegion = undefined;
    this.crossingInFlight = false;
    this.appliedPendingBubble = undefined;
    this.appliedPendingToken = undefined;
    this.regionBeforeCrossing = undefined;
  }

  // Phase 1 of a crossing (the class-21 pending-region open) gets only the
  // promote and the PAH row (pushMembership, right after this), never the dest
  // apply: a client can sit in the hysteresis band for many seconds before it
  // commits, and applying here would land the destination's rows in the world
  // still being shown. The dest apply rides the handoff gate (awaitingPurge /
  // onHandoffComplete) once the client's state refresh reports the new bubble.
  applyPendingRegion(
    sessionId: bigint,
    regionId: number,
    token?: number
  ): void {
    if (this.host.retired()) {
      return;
    }
    const { bubble, state } = unpackBubbleStateHandle(regionId);
    // Only the bubble+token pair guards this. Skipping the bubble currentSlice
    // names would swallow walk-backs (a crossing does not go through a state
    // refresh, so currentSlice still names the slice left one crossing ago; the
    // Tower's load zones all lead back to the spawn bubble) and the first
    // crossing into the world (it starts at the scenario's initialBubble).
    if (
      bubble === this.appliedPendingBubble &&
      token === this.appliedPendingToken
    ) {
      return;
    }
    const activityName = this.host.activityName();
    if (!(activityName && servesBubble(activityName, bubble))) {
      // Nothing to send means the client waits at the commit line until it
      // times out, which reads in game as a load zone that will not let you
      // through. Say which bubble, because the fix is a table for it.
      event_warning(
        "activities:host:region: pending region bubble %d (region=%s) has no slice table for %s - no promote, no dest apply, the crossing cannot complete",
        bubble,
        regionId,
        activityName ?? "unknown activity"
      );
      return;
    }
    // A crossing is a world transition, so the bubble being entered becomes the
    // current one; without it the republish keeps sending the previous bubble's
    // table into a world the guest has torn down and the next apply asserts.
    this.bubbleStateSwap =
      bubble === this.currentSlice && state !== this.currentBubbleState;
    // A new crossing replaces the row of the region the last one left (2.3.1
    // capture). The region this one leaves is kept for its own row once the
    // world is entered; a swap within the bubble leaves none.
    this.leftBehindRegion = undefined;
    this.regionBeforeCrossing =
      this.currentSlice !== undefined && bubble !== this.currentSlice
        ? packBubbleStateHandle(this.currentSlice, this.currentBubbleState)
        : undefined;
    this.currentSlice = bubble;
    this.currentBubbleState = state;
    this.appliedPendingBubble = bubble;
    this.appliedPendingToken = token;
    this.crossingInFlight = true;
    // Crossing a load zone does not go through a state refresh, so this is the
    // only chance to give the guest authority over the bubble it is entering;
    // without it that bubble's squads are received into sensors whose handlers
    // bail.
    this.promotedBubbles.add(bubble);
    this.abdicatedBubbles.delete(bubble);
    this.host.pushSensorAuthPromote(sessionId);
    // The rest (script host start, dest apply, globals re-send, the peer's
    // promote and apply) waits for the swap to land and the entity-slot handoff
    // to finish (onHandoffComplete, which keys off pendingRegion to know a
    // landing apply is this crossing's).
  }

  // The peer host's half of a crossing: its own promote and its own scoped
  // apply for the bubble being entered. The script host, the activity globals
  // and the pending-region bookkeeping belong to the socket the client talks
  // to.
  applyCrossing(bubble: number, token?: number, state = 0): void {
    const sessionId = this.host.boundSessionId();
    if (sessionId === undefined || this.host.retired()) {
      return;
    }
    // Dedupe on the crossing, not on the bubble: promotedBubbles only grows and
    // appliedSlices is not cleared at a crossing, so on a return visit both are
    // already set. The pair this host last applied a pending region for does
    // not latch, and it stops the ping-pong: a crossing is announced on both
    // sockets, so the peer's client-auth reaches us again with the same token.
    if (
      bubble === this.appliedPendingBubble &&
      token === this.appliedPendingToken
    ) {
      return;
    }
    // Same as applyPendingRegion: the peer republishes on its own keepalive,
    // so it has to follow the player out of the previous bubble too.
    this.currentSlice = bubble;
    this.currentBubbleState = state;
    this.crossingInFlight = true;
    this.promotedBubbles.add(bubble);
    this.abdicatedBubbles.delete(bubble);
    this.host.pushSensorAuthPromote(sessionId);
    this.host.pushSensorAuthApply(sessionId, bubble);
    const activityName = this.host.activityName();
    if (activityName && activityBundles(activityName)) {
      this.host.pushApply(sessionId, activityName, bubble, false);
    }
  }
}
