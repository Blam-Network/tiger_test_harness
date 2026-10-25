import type * as net from "node:net";
import type { KillFilterDetails } from "@blamnetwork/bullshcript/destiny1/common";
import {
  event_error,
  event_message,
  event_status,
  event_verbose,
  event_warning,
} from "@blamnetwork/datamine";
import { activityBundles, activityPrivate } from "../content";
import { activityName as activityNameForId } from "../content/activities";
import {
  describeDebugToggles,
  readDebugToggles,
} from "../dev-config/debug-toggles";
import {
  type ChannelEnd,
  handleChannelStartup,
  handleSecureHello,
} from "../lib/bap-wire/channel";
import { BungieCodec, type RawBapMessage } from "../lib/bap-wire/codec";
import { BapMessageType, bapMessageTypeName } from "../lib/bap-wire/constants";
import type { ActivityHostKind, ActivityHostService } from "./activity-host";
import { ActivityHostManager } from "./activity-host-manager";
import {
  type ActivityInstance,
  activityInstanceFor,
  activityTicksSince,
  findActivityInstance,
} from "./activity-instance";
import { EntitySlots } from "./entity-slots";
import { hexPreview } from "./hex-preview";
import type { AhClientIdentity } from "./join";
import {
  ActivityHostMessageType,
  activityHostMessageTypeName,
  isActivityHostMessageType,
} from "./messages";
import type { IncidentPosition } from "./mission/incident";
import {
  buildActivityHostToClientNotification,
  buildJoinResultNotification,
  type ParsedActivityHostNotification,
  parseClientToActivityHostNotification,
  peekJoinRequest,
} from "./notification";
import {
  anonymousHosts,
  type BoundHosts,
  type HostSession,
  type PlayerHosts,
} from "./player-hosts";
import { RegionCrossing, servesBubble } from "./region-crossing";
import {
  parseRequestScriptUpdates,
  parseStateRefresh,
  type SensorAuthSenseEntry,
  unpackBubbleStateHandle,
  withoutSenseRows,
} from "./rsat";
import type { StateRefresh } from "./rsat/client-reports";
import { scenarioClient } from "./scenario-client";
import { SessionScriptHost } from "./script-host/session-host";
import type { SessionContext } from "./session-context";
import {
  handleAllocateEntityIndices,
  handleFreeEntityIndices,
  pushEntityIndexGrant,
} from "./session-entity-indices";
import { phaseHash, pushActivityGlobals } from "./session-globals";
import { Keepalive } from "./session-keepalive";
import { MembershipPushes } from "./session-membership";
import { SensorAuthPushes } from "./session-sensor-auth";
import type { ParsedStartRequest } from "./start-request";

// Bytes of a first-message dump per event.
const FIRST_DUMP_CHUNK_BYTES = 800;

// Every connected AH proxy session, for the script debugger (src/debug/).
const liveSessions = new Set<ActivityHostProxySession>();

export function liveAhSessions(): readonly ActivityHostProxySession[] {
  return [...liveSessions];
}

function notificationKindName(kind: number): string {
  return isActivityHostMessageType(kind)
    ? activityHostMessageTypeName(kind)
    : `ah_${kind}`;
}

// TCP session for the activity host proxy.
export class ActivityHostProxySession implements HostSession, SessionContext {
  private readonly remote: string;
  private readonly codec = new BungieCodec();
  private buffer = Buffer.alloc(0);
  closed = false;
  private notifySeq = 0;
  private activityStateSent = false;
  // The FAH session id the pushes are addressed to (set by the first join
  // state or membership push).
  boundSessionId: bigint | undefined;
  joinIdentity: AhClientIdentity | undefined;
  // Start of the activity clock this socket has sent ticks from: its own
  // until the activity is known, then the instance's (see activityTicks).
  private activityClockStarted: number | undefined;
  // The client has entered its world (the refresh after its world
  // transition was answered with the world's apply).
  worldEntered = false;
  private readonly seenClientKinds = new Set<number>();
  private lastRefreshMembership: number | undefined;

  // Where the client is in the world and the crossing it is making.
  readonly crossing: RegionCrossing;
  // The entity slot handoff at a swap.
  readonly entitySlots: EntitySlots;
  // The activity's script host and what feeds it.
  readonly scripts: SessionScriptHost;
  private readonly sensorAuth: SensorAuthPushes;
  private readonly membership: MembershipPushes;
  private readonly keepalive: Keepalive;

  // The player's hosts and which of them this connection is (FAH or GAH).
  // Set by the manager start request, the first message that identifies
  // the player (secure hello -> manager start -> join, always in that
  // order in captures); until then the connection has no player.
  private bound: BoundHosts | undefined;

  constructor(
    private readonly socket: net.Socket,
    private readonly manager: ActivityHostManager
  ) {
    this.crossing = new RegionCrossing({
      activityName: () => this.activityName(),
      boundSessionId: () => this.boundSessionId,
      flushClaims: (sessionId) => this.entitySlots.flushClaims(sessionId),
      hosts: () => this.hosts,
      joinIdentity: () => this.joinIdentity,
      membershipPushes: () => this.membership.pushCount,
      noteHardWipe: (report) => this.scripts.noteHardWipe(report),
      phaseHash: (activityName) => phaseHash(this, activityName),
      pushApply: (sessionId, activityName, bubble, worldEntry) =>
        this.sensorAuth.pushApply(sessionId, activityName, bubble, worldEntry),
      pushMembership: (sessionId, force) =>
        this.membership.push(sessionId, force),
      pushSensorAuthApply: (sessionId, slice) =>
        this.sensorAuth.pushRowlessApply(sessionId, slice),
      pushSensorAuthPromote: (sessionId) =>
        this.sensorAuth.pushPromote(sessionId),
      retired: () => this.retired,
      worldEntered: () => this.worldEntered,
    });
    this.entitySlots = new EntitySlots({
      hasPendingRegion: () => this.crossing.pendingRegion !== undefined,
      onHandoffComplete: (sessionId, reason) =>
        this.completeSlotHandoff(sessionId, reason),
      push: (sessionId, kind, body, label) =>
        this.pushAh(sessionId, kind, body, label),
    });
    this.scripts = new SessionScriptHost({
      activityName: () => this.activityName(),
      activityTicks: () => this.activityTicks(),
      hosts: () => this.hosts,
      joinIdentity: () => this.joinIdentity,
      kind: () => this.kind,
      moveToPhaseStart: (activityName, phaseIndex) =>
        this.crossing.teleportToPhaseStart(activityName, phaseIndex),
      noteInstanceSpawned: () => this.membership.noteSpawned(),
      playerRows: (activityName, ownKey) =>
        this.sensorAuth.playerRows(activityName, ownKey),
      position: () => ({
        bubble: this.crossing.clientBubble ?? this.crossing.currentSlice,
        state: this.crossing.currentBubbleState,
      }),
      pushMembership: () => {
        if (this.boundSessionId !== undefined) {
          this.membership.push(this.boundSessionId, true);
        }
      },
      session: () => this,
      stepTeleport: (activityName) => this.crossing.stepTeleport(activityName),
      teleporting: (activityName) => this.crossing.teleporting(activityName),
      worldEntered: () => this.worldEntered,
    });
    this.sensorAuth = new SensorAuthPushes(this);
    this.membership = new MembershipPushes(this);
    this.keepalive = new Keepalive(this, this.sensorAuth, this.membership);

    const remote = `${socket.remoteAddress}:${socket.remotePort}`;
    this.remote = remote;
    liveSessions.add(this);
    event_message("activities:host: client connected %s", remote);

    socket.on("data", (chunk) => this.onData(chunk));
    socket.on("error", (err) => {
      event_warning(
        "activities:host: socket error %s: %s",
        remote,
        err.message
      );
    });
    socket.on("close", () => {
      this.closed = true;
      liveSessions.delete(this);
      if (this.bound) {
        if (this.bound.kind === "FAH") {
          this.hosts.pah.setFlushHook(null);
          this.hosts.pah.reset();
        }
        this.hosts.setSession(this.bound.kind, undefined, this.bound.host);
        this.hosts.unbind(this.bound.kind, this.bound.host);
      }
      this.membership.leave();
      this.keepalive.stop();
      this.entitySlots.dispose();
      event_message("activities:host: client disconnected %s", remote);
    });
  }

  get hosts(): PlayerHosts {
    return this.bound?.hosts ?? anonymousHosts;
  }

  get kind(): ActivityHostKind {
    return this.bound?.kind ?? "FAH";
  }

  get activityHost(): ActivityHostService {
    return this.bound?.host ?? this.hosts.host(this.kind);
  }

  get retired(): boolean {
    return (
      this.bound?.kind === "GAH" && this.hosts.isRetiredHost(this.bound.host)
    );
  }

  get isPendingTarget(): boolean {
    return this.bound?.host === this.hosts.pendingGah;
  }

  activityName(): string | undefined {
    const start = this.hosts.getStartRequest();
    return start === undefined
      ? undefined
      : activityNameForId(start.activityId);
  }

  // The activity clock in 30 Hz ticks. 0 stalls combatant placement; the
  // visual time of day is the GAS worldServerTime, not this.
  //
  // Once the activity is known this is the instance's clock, shared by the
  // FAH, the GAH and the script host, so a stamp the host writes is in the
  // same base as the ticks the world reading it gets. Our own start goes to
  // the instance first, and the earlier of the two wins, so switching over
  // never sends a world less than it has already seen.
  activityTicks(now = Date.now()): number {
    this.activityClockStarted ??= now;
    const activityName = this.activityName();
    if (!activityName) {
      return activityTicksSince(this.activityClockStarted, now);
    }
    const instance = activityInstanceFor(activityName, this.hosts);
    this.activityClockStarted = instance.noteClockStart(
      this.activityClockStarted
    );
    return instance.activityTicks(now);
  }

  pushAh(
    sessionId: bigint,
    kind: ActivityHostMessageType,
    rsatPayload: Buffer,
    label: string,
    opts: { keepRows?: boolean } = {}
  ): void {
    let payload = rsatPayload;
    let note = label;
    if (
      kind === ActivityHostMessageType.SensorAuthUpdate &&
      payload.length > 5 &&
      !(opts.keepRows || readDebugToggles().toggles.senseRows)
    ) {
      payload = withoutSenseRows(payload);
      note += ` (rows dropped, ${payload.length}B sent)`;
    }
    const body = buildActivityHostToClientNotification(
      sessionId,
      kind,
      payload
    );
    const seq = this.notifySeq++ >>> 0;
    this.send({
      msgType: BapMessageType.ActivityHostToClientNotification,
      sequence: seq,
      body,
      activityHostId: sessionId,
    });
    event_verbose(
      "activities:host: %s (seq %x, ah=0x%I64x)",
      note,
      seq,
      sessionId
    );
  }

  // First start request binds the connection to the player's hosts; later
  // ones on the same connection keep the binding. A non-start manager
  // request before any start is answered from the anonymous hosts without
  // binding (never seen in captures).
  private bindHosts(start: ParsedStartRequest | undefined): BoundHosts {
    if (this.bound) {
      return this.bound;
    }
    if (!start) {
      event_warning(
        "activities:host: manager request before start request, unbound reply"
      );
      return { host: anonymousHosts.fah, hosts: anonymousHosts, kind: "FAH" };
    }
    const hosts = this.manager.hostsForStartRequest(start);
    const { host, kind } = hosts.bindHost();
    const bound = { host, hosts, kind };
    this.bound = bound;
    hosts.setSession(kind, this, host);
    event_message(
      "activities:host: bound %s ah=0x%I64x%s",
      kind,
      host.id,
      host === hosts.pendingGah ? " (pending public host)" : ""
    );
    if (kind === "FAH") {
      hosts.pah.reset();
      hosts.pah.setFlushHook(() => {
        if (this.closed || this.boundSessionId === undefined) {
          return;
        }
        event_message(
          "activities:host: PAH revoke flush opcode=%s token=%s",
          hosts.pah.currentAmbassador(),
          hosts.pah.currentRevokeToken()
        );
        this.membership.push(this.boundSessionId, true);
      });
    }
    return bound;
  }

  private onData(chunk: Buffer): void {
    if (this.closed) {
      return;
    }

    this.buffer = Buffer.concat([this.buffer, chunk]);

    try {
      while (true) {
        const { message, consumed } = this.codec.tryDecode(this.buffer);
        if (!consumed) {
          break;
        }
        this.buffer = this.buffer.subarray(consumed);
        if (message) {
          this.handleMessage(message);
        }
      }
    } catch (error) {
      event_error(
        "activities:host: frame error: %s",
        error instanceof Error ? error.message : String(error)
      );
      this.socket.destroy();
    }
  }

  private handleMessage(message: RawBapMessage): void {
    event_status(
      "activities:host: ← %s seq=%u body=%db",
      bapMessageTypeName(message.msgType),
      message.sequence,
      message.body.length
    );

    switch (message.msgType) {
      case BapMessageType.ClientToBapChannelStartupRequest:
        handleChannelStartup(this.channelEnd, message);
        break;
      case BapMessageType.ClientToBapSecureHelloRequest:
        handleSecureHello(this.channelEnd, message);
        break;
      case BapMessageType.ClientToBapEchoRequest:
        this.handleStatusOnlyReply(
          message,
          BapMessageType.ClientToBapEchoResponse,
          "echo"
        );
        break;
      case BapMessageType.ClientToActivityHostManagerRequest:
        this.handleActivityHostManager(message);
        break;
      case BapMessageType.ClientToActivityHostNotification:
        this.handleActivityHostNotification(message);
        break;
      default:
        event_warning(
          "activities:host: unhandled %s seq=%u body=%s",
          bapMessageTypeName(message.msgType),
          message.sequence,
          hexPreview(message.body)
        );
        break;
    }
  }

  // What the shared channel handshake (channel.ts) needs from this session.
  private get channelEnd(): ChannelEnd {
    return {
      category: "activities:host:",
      codec: this.codec,
      send: (message) => this.send(message),
    };
  }

  private handleActivityHostManager(message: RawBapMessage): void {
    const body = this.manager.handle(message, (start) => this.bindHosts(start));
    if (!body) {
      return;
    }
    this.send({
      msgType: BapMessageType.ClientToActivityHostManagerResponse,
      sequence: message.sequence,
      body,
    });
  }

  private handleActivityHostNotification(message: RawBapMessage): void {
    if (!this.bound) {
      event_warning(
        "activities:host: notification before start request dropped (%dB)",
        message.body.length
      );
      return;
    }
    const parsed = parseClientToActivityHostNotification(message.body);
    if (!parsed) {
      event_warning(
        "activities:host: notification too short (%dB) body=%s",
        message.body.length,
        hexPreview(message.body)
      );
      return;
    }
    this.logFirstOfKind(parsed);
    const { kind, payload, sessionId } = parsed;
    switch (kind) {
      // The client sends the keepalive request (15) itself, after the join
      // result's keepalive interval with nothing else sent; the host never
      // answers it.
      case ActivityHostMessageType.SendClientHeartbeat:
      case ActivityHostMessageType.ActivityClientKeepaliveRequest:
      case ActivityHostMessageType.ActivityClientKeepaliveResponse:
      case ActivityHostMessageType.MembershipAcknowledgement:
        break;
      case ActivityHostMessageType.ActivityClientRequestStateRefresh:
        this.handleStateRefresh(sessionId, payload);
        break;
      case ActivityHostMessageType.ClientAuthoritativeDataUpdate:
        this.crossing.handleClientAuth(sessionId, payload);
        break;
      case ActivityHostMessageType.AbandonEntitySlots:
      case ActivityHostMessageType.AbdicateAuthority:
      case ActivityHostMessageType.RequestPurgeEntitySlots:
        this.entitySlots.handle(sessionId, kind, payload);
        break;
      case ActivityHostMessageType.PeerLeaveRequest:
        event_message(
          "activities:host: peer_leave absorbed session=0x%I64x payload=%s",
          sessionId,
          hexPreview(payload)
        );
        break;
      case ActivityHostMessageType.FreeEntityIndices:
        handleFreeEntityIndices(this, sessionId, payload);
        break;
      case ActivityHostMessageType.AllocateEntityIndices:
        handleAllocateEntityIndices(this, sessionId, payload);
        break;
      case ActivityHostMessageType.SensorSenseUpdate:
        this.handleSensorSense(parsed);
        break;
      case ActivityHostMessageType.RequestScriptUpdates:
        this.absorbRequestScriptUpdates(parsed);
        break;
      case ActivityHostMessageType.ScriptState:
      case ActivityHostMessageType.ScriptEvent:
        this.absorbScriptMessage(parsed);
        break;
      case ActivityHostMessageType.Incident:
        this.scripts.handleIncident(sessionId, payload);
        break;
      case ActivityHostMessageType.JoinRequest:
        this.handleJoinRequest(parsed);
        break;
      default:
        event_warning(
          "activities:host: unhandled %s session=0x%I64x variant=%s payload=%s",
          notificationKindName(kind),
          sessionId,
          parsed.variant,
          hexPreview(payload)
        );
        break;
    }
  }

  // The first message of each class is logged whole (up to 2 KB) for decoding
  // against the schemas.
  private logFirstOfKind(parsed: ParsedActivityHostNotification): void {
    if (this.seenClientKinds.has(parsed.kind)) {
      return;
    }
    this.seenClientKinds.add(parsed.kind);
    // An event's text holds about 2 KB, so the dump goes out in pieces.
    const dump = parsed.payload.subarray(0, 2048);
    for (let at = 0; at < dump.length; at += FIRST_DUMP_CHUNK_BYTES) {
      event_message(
        "activities:host: first %s %dB hex@%d=%s",
        notificationKindName(parsed.kind),
        parsed.payload.length,
        at,
        dump.subarray(at, at + FIRST_DUMP_CHUNK_BYTES).toString("hex")
      );
    }
  }

  private handleSensorSense(parsed: ParsedActivityHostNotification): void {
    const activity = this.activityName();
    if (activity && activityBundles(activity)) {
      this.scripts.handleSensorSense(
        parsed.sessionId,
        activity,
        parsed.payload
      );
      return;
    }
    event_message(
      "activities:host: sensor_sense_update absorbed session=0x%I64x variant=%s payload=%dB",
      parsed.sessionId,
      parsed.variant,
      parsed.payload.length
    );
  }

  private absorbRequestScriptUpdates(
    parsed: ParsedActivityHostNotification
  ): void {
    const req = parseRequestScriptUpdates(parsed.payload);
    let toggle = "?";
    if (req) {
      toggle = req.toggle ? "on" : "off";
    }
    event_message(
      "activities:host: request_script_updates absorbed session=0x%I64x variant=%s toggle=%s payload=%dB",
      parsed.sessionId,
      parsed.variant,
      toggle,
      parsed.payload.length
    );
  }

  private absorbScriptMessage(parsed: ParsedActivityHostNotification): void {
    const preview =
      parsed.payload.length <= 64 ? ` ${hexPreview(parsed.payload)}` : "";
    event_message(
      "activities:host: %s absorbed session=0x%I64x variant=%s payload=%dB%s",
      notificationKindName(parsed.kind),
      parsed.sessionId,
      parsed.variant,
      parsed.payload.length,
      preview
    );
  }

  private handleJoinRequest(parsed: ParsedActivityHostNotification): void {
    try {
      const peek = peekJoinRequest(parsed.payload);
      if (peek) {
        this.joinIdentity = {
          machine: peek.machine,
          player: peek.player,
          account: peek.account,
          character: peek.character,
          identityUnknown4: peek.identityUnknown4,
        };
        this.membership.join();
      }
      const body = buildJoinResultNotification(
        parsed.sessionId,
        parsed.payload
      );
      const seq = this.notifySeq++ >>> 0;
      this.send({
        msgType: BapMessageType.ActivityHostToClientNotification,
        sequence: seq,
        body,
        activityHostId: parsed.sessionId,
      });
      event_message(
        "activities:host: join result (seq %x, session=0x%I64x %s %sreq %dB rsp %dB)",
        seq,
        parsed.sessionId,
        this.kind,
        peek
          ? `nonce=${peek.nonce} ah=0x${peek.activityHostId.toString(16)} ` +
              `account=${peek.account} character=${peek.character} `
          : "",
        parsed.payload.length,
        body.length
      );
      this.pushJoinState(parsed.sessionId);
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      event_warning("activities:host: join result FAILED, absorbed: %s", m);
    }
  }

  // A state refresh: the host answers with the globals and a promote, and
  // applies the bubble the client reports. The dest apply is not gated on a
  // refresh counter (the 2.3.1 capture sends it after client-auth); the Tower
  // still places on refresh (single-host spawn). A PUBLIC Venus start's world
  // lives on the GAH after the PAH revoke, so its FAH only refreshes globals.
  private handleStateRefresh(sessionId: bigint, payload: Buffer): void {
    const opts = this.sensorAuth.opts();
    this.crossing.startAt(
      opts.scenario?.initialBubble ?? 0,
      opts.scenario?.initialState ?? 0
    );
    const { refresh, previousBubble, enteringWorld } =
      this.noteRefresh(payload);
    if (this.retiredByRefresh(refresh, previousBubble)) {
      return;
    }
    this.promotePendingHost(refresh, previousBubble, enteringWorld);
    if (this.activityStateSent) {
      pushEntityIndexGrant(this, sessionId);
      this.membership.push(
        sessionId,
        previousBubble !== this.crossing.clientBubble
      );
    } else {
      this.pushJoinState(sessionId);
    }
    this.abdicateLeftBubble(refresh, previousBubble);
    pushActivityGlobals(this, sessionId);
    // A pending public host is the crossing's PUBLIC TARGET: it does a full
    // join on its own socket and then waits, and the switch task's gate is its
    // membership + GAS + WGS, nothing else. Promoting or applying a bubble on
    // it before the client's swap lands would seed a world it has not been
    // told to enter.
    if (this.isPendingTarget) {
      return;
    }
    this.sensorAuth.pushPromote(sessionId);
    this.landRefreshedBubble(sessionId, previousBubble);
  }

  // Reads the refresh and moves the client's bubble to the one it names;
  // previousBubble is the one it was in before.
  private noteRefresh(payload: Buffer): {
    enteringWorld: boolean;
    previousBubble: number | undefined;
    refresh: StateRefresh | undefined;
  } {
    const refresh = parseStateRefresh(payload);
    const previousRefreshMembership = this.lastRefreshMembership;
    this.lastRefreshMembership = refresh?.membership;
    // A refresh before the client's world exists (membership 0) names wherever
    // it was last, where the 2.3.1 capture's names none: the world is the
    // scenario's start bubble until the client enters it.
    const activityName = this.activityName();
    const preWorld =
      refresh?.membership === 0 &&
      activityName !== undefined &&
      activityBundles(activityName) !== undefined;
    if (preWorld && refresh) {
      refresh.bubble = undefined;
    }
    // The pre-world refresh and the one after the initial slice-set swap can
    // name the same bubble. The second is the world entry, so it must not
    // count as "same bubble".
    const enteringWorld =
      previousRefreshMembership === 0 && (refresh?.membership ?? 0) > 0;
    const previousBubble = enteringWorld
      ? undefined
      : this.crossing.clientBubble;
    this.crossing.clientBubble = refresh?.bubble;
    if (
      refresh?.bubble !== undefined &&
      previousBubble !== undefined &&
      refresh.bubble !== previousBubble
    ) {
      this.keepalive.settleAfterSwap();
    }
    event_message(
      "activities:host: state-refresh membership=%s bubble=%s from=%s payload=%s",
      refresh?.membership ?? "?",
      refresh?.bubble ?? "none",
      previousBubble ?? "none",
      hexPreview(payload)
    );
    return { enteringWorld, previousBubble, refresh };
  }

  // A public load-zone swap reaches every socket at once, the old public
  // host's included, in no fixed order. The current GAH hearing a new bubble
  // while a pending GAH exists is the host being swapped out: the client keeps
  // its record open as PUBLIC TARGET until the transition stops, and an apply
  // sent to it lands in a world being torn down (guest cookie assert). It is
  // retired and sent nothing, and is already retired when the pending host's
  // own refresh got here first and promoted it.
  private retiredByRefresh(
    refresh: StateRefresh | undefined,
    previousBubble: number | undefined
  ): boolean {
    if (this.retired) {
      event_message(
        "activities:host: retired public host ah=0x%I64x ignoring state-refresh bubble=%s",
        this.activityHost.id,
        refresh?.bubble ?? "none"
      );
      return true;
    }
    if (this.isSwappedOutBy(refresh?.bubble, previousBubble)) {
      this.hosts.promotePendingGah();
      event_message(
        "activities:host: public host ah=0x%I64x swapped out at bubble %s -> %s; retired, sending it nothing more",
        this.activityHost.id,
        previousBubble,
        refresh?.bubble
      );
      return true;
    }
    return false;
  }

  private isSwappedOutBy(
    bubble: number | undefined,
    previousBubble: number | undefined
  ): boolean {
    return (
      this.bound?.kind === "GAH" &&
      this.bound.host === this.hosts.gah &&
      this.hosts.pendingGah !== undefined &&
      bubble !== undefined &&
      previousBubble !== undefined &&
      bubble !== previousBubble
    );
  }

  // The pending host's own swap refresh promotes it too, but only the swap:
  // its first refresh after joining (membership 0, no bubble) is not one, and
  // promoting then would retire the live public host. Its world exists only
  // once the swap lands, so the refresh that first gives it a membership is the
  // swap, though it never had a bubble to change from. Left pending it skips
  // its bubble's apply, and the client never builds the bundle's squads.
  private promotePendingHost(
    refresh: StateRefresh | undefined,
    previousBubble: number | undefined,
    enteringWorld: boolean
  ): void {
    if (
      this.isPendingTarget &&
      refresh?.bubble !== undefined &&
      (enteringWorld ||
        (previousBubble !== undefined && refresh.bubble !== previousBubble))
    ) {
      this.hosts.promotePendingGah();
    }
  }

  // The client abdicates every entity it holds in the bubble it is leaving
  // before it sends this refresh. Promoting that bubble again hands authority
  // back over slots the swap has just torn down, and the guest asserts; the
  // promote set only grows for slots the client still holds (a held slot
  // missing from a later table asserts), so the bubble leaves the table.
  private abdicateLeftBubble(
    refresh: StateRefresh | undefined,
    previousBubble: number | undefined
  ): void {
    if (
      this.entitySlots.abdicateSeen &&
      previousBubble !== undefined &&
      refresh?.bubble !== undefined &&
      refresh.bubble !== previousBubble
    ) {
      this.crossing.abdicate(previousBubble, refresh.bubble);
      event_message(
        "activities:host: %s bubble %d abdicated at the swap to %d; dropped from the authority table",
        this.kind,
        previousBubble,
        refresh.bubble
      );
    }
    this.entitySlots.abdicateSeen = false;
  }

  // The dest apply when the client reports a new bubble. A world transition
  // recreates the guest's sensor client, which discards everything until an
  // update with sense rows arrives, so the pre-world apply (orbit bubble)
  // never counts, and a repeat for the same bubble must not re-apply (squads
  // reconcile again and combatants stack).
  private landRefreshedBubble(
    sessionId: bigint,
    previousBubble: number | undefined
  ): void {
    const bubble = this.crossing.clientBubble;
    // A swap to another state of the same bubble reports the same bubble but is
    // still a new world (the capture re-sends the whole table, binder
    // included).
    const stateSwap =
      this.crossing.bubbleStateSwap &&
      bubble !== undefined &&
      bubble === previousBubble;
    if (bubble === undefined || (bubble === previousBubble && !stateSwap)) {
      return;
    }
    this.crossing.bubbleStateSwap = false;
    const start = this.hosts.getStartRequest();
    const activityName = this.activityName();
    // A bubble the activity cannot serve (the world fallback included: a Venus
    // mission can start the player in bubble 7) is not its bubble. The handle
    // in a refresh is the world's current bubble, still wherever the client
    // was last before the world transition; taking it as the current slice
    // would make every row fail its bundle-to-slice lookup and be held.
    if (activityName && !servesBubble(activityName, bubble)) {
      event_message(
        "activities:host: state-refresh bubble %d is not a bubble %s serves, keeping slice %s",
        bubble,
        activityName,
        this.crossing.currentSlice ?? "none"
      );
      return;
    }
    this.crossing.landSwap(
      bubble,
      previousBubble,
      activityPrivate(activityName)
    );
    // The world transition throws away every table the guest held, so nothing
    // counts as applied across a slice switch; the applies that follow re-add
    // them.
    this.sensorAuth.appliedSlices.clear();
    // The scripts must be up before the apply. A refresh that comes with an
    // entity slot handoff (awaitingPurge, set by the abdicate before it) holds
    // the apply off, and completeSlotHandoff sends it once the handoff is
    // done; only a plain single-host spawn applies here directly.
    if (activityName && this.kind === "FAH") {
      this.scripts.start(activityName, start?.activityId);
    }
    this.sensorAuth.pushRowlessApply(sessionId, bubble);
    // The rows follow the rowless apply. Every refresh into another bubble or
    // state is a world entry: the capture re-sends the whole world, binder
    // included, at each crossing.
    if (activityName && activityBundles(activityName)) {
      if (!this.entitySlots.awaitingPurge) {
        this.sensorAuth.pushApply(sessionId, activityName, bubble, true);
      }
      this.worldEntered = true;
    }
    this.scripts.markMissionLive();
    // Bump the membership generation after the dest apply.
    this.membership.push(sessionId, true);
  }

  // The join result's follow-up: identity grant, entity index mask and
  // membership. The GAS and WGS wait for the state refresh, as in the 2.3.1
  // capture.
  private pushJoinState(sessionId: bigint): void {
    if (this.activityStateSent) {
      return;
    }
    this.activityStateSent = true;
    this.boundSessionId = sessionId;
    const start = this.hosts.getStartRequest();
    const activityName = this.activityName();
    const scenario = activityName ? scenarioClient(activityName) : undefined;
    if (start && !scenario) {
      event_warning(
        "activities:host: no scenario for start activity=%s",
        start.activityId
      );
    }
    this.crossing.startAt(
      scenario?.initialBubble ?? 0,
      scenario?.initialState ?? 0
    );
    // Venus skips activity-level matchmaking, so findSessions never arms
    // pah-policy: arm it on the FAH join so ASSIGN -> REVOKE can spin up a GAH
    // for PUBLIC start bubbles, and pre-create the GAH so the PUBLIC TARGET
    // join after the revoke has a live host. An all-private activity never has
    // one to spin up: its PAH rows stay ASSIGN for the whole session.
    if (this.kind === "FAH" && !activityPrivate(activityName)) {
      this.hosts.pah.noteMatchmakingSearch();
      this.hosts.ensureGah();
    }
    this.sensorAuth.pushJoinGrant(sessionId);
    pushEntityIndexGrant(this, sessionId);
    this.membership.push(sessionId);
    this.keepalive.start(sessionId);
    // debug-toggles.json, read again at every join and world entry.
    event_message(
      "activities:host: debug toggles %s",
      describeDebugToggles(readDebugToggles())
    );
  }

  // The entity slot handoff is over (EntitySlots): the apply that waited for
  // it goes out.
  private completeSlotHandoff(sessionId: bigint, reason: string): void {
    const slice = this.crossing.currentSlice;
    if (this.retired || this.closed || slice === undefined) {
      return;
    }
    event_message(
      "activities:host: %s slot handoff complete (%s); applying slice %d",
      this.kind,
      reason,
      slice
    );
    const start = this.hosts.getStartRequest();
    const activityName = this.activityName();
    // The scripts must be up before the apply, and a crossing does not go
    // through a state refresh to start them: only the handoff landing here
    // does.
    if (activityName && this.kind === "FAH") {
      this.scripts.start(activityName, start?.activityId);
    }
    this.sensorAuth.pushRowlessApply(sessionId, slice);
    // A swap to another state of the same bubble is applied on the client's
    // refresh of it; any other crossing's apply is the whole world again
    // (landRefreshedBubble).
    if (
      activityName &&
      activityBundles(activityName) &&
      !this.crossing.bubbleStateSwap
    ) {
      this.sensorAuth.pushApply(sessionId, activityName, slice, true);
    }
    // The activity and world globals are re-sent right after the dest apply;
    // without them the client sits in transition phase 3 and never flips.
    pushActivityGlobals(this, sessionId);
    // The region being entered needs both hosts. A crossing announces itself on
    // one socket only, so the peer never otherwise hears about the bubble.
    // pendingRegion names this crossing's target for as long as the client
    // keeps advertising it, so a landing apply recognises it was one.
    const pending = this.crossing.pendingRegion
      ? unpackBubbleStateHandle(this.crossing.pendingRegion.regionId)
      : undefined;
    if (pending?.bubble === slice) {
      this.hosts
        .session(this.kind === "FAH" ? "GAH" : "FAH")
        ?.applyCrossing(
          slice,
          this.crossing.pendingRegion?.token,
          pending.state
        );
    }
  }

  private handleStatusOnlyReply(
    message: RawBapMessage,
    responseType: BapMessageType,
    label: string
  ): void {
    this.send({
      msgType: responseType,
      sequence: message.sequence,
      body: Buffer.alloc(0),
    });
    event_message(
      "activities:host: %s rsp (seq %x, req %dB)",
      label,
      message.sequence,
      message.body.length
    );
  }

  private send(message: RawBapMessage): void {
    const frame = this.codec.encode(message);
    // Notifications go out many times a second; keep their trace off the status level.
    const trace =
      message.msgType === BapMessageType.ActivityHostToClientNotification
        ? event_verbose
        : event_status;
    trace(
      "activities:host: → %s seq=%u frame=%db",
      bapMessageTypeName(message.msgType),
      message.sequence,
      frame.length
    );
    this.socket.write(frame);
  }

  // What the player's other host and the script host reach this connection
  // through (HostSession).
  applyCrossing(bubble: number, token?: number, state = 0): void {
    this.crossing.applyCrossing(bubble, token, state);
  }

  notePlayerTrigger(bundle: number, typeIndex: number): void {
    this.scripts.notePlayerTrigger(bundle, typeIndex);
  }

  noteClientIncident(nameHash: number): void {
    this.scripts.noteClientIncident(nameHash);
  }

  noteKill(details: KillFilterDetails): void {
    this.scripts.noteKill(details);
  }

  noteSquadKill(idents: readonly number[], at?: IncidentPosition): void {
    this.scripts.noteSquadKill(idents, at);
  }

  noteInteraction(carries: (name: number) => boolean): void {
    this.scripts.noteInteraction(carries);
  }

  noteLootGathered(carries: (material: number) => boolean): void {
    this.scripts.noteLootGathered(carries);
  }

  pushRows(entries: readonly SensorAuthSenseEntry[]): void {
    this.sensorAuth.pushRows(entries);
  }

  republishTables(label: string): void {
    this.sensorAuth.republishTables(label);
  }

  worldRows(activityName: string): Set<string> | undefined {
    return this.sensorAuth.worldRows(activityName);
  }

  // The script debugger's hooks (src/debug/) and the script rebuild's.

  // The player this connection belongs to, for the debugger's player list.
  debugHosts(): PlayerHosts | undefined {
    return this.bound?.hosts;
  }

  // A script rebuild (script-build.ts): this connection's activity has a
  // host running stale scripts, so the socket closes and the client
  // relaunches into the new build. The close path ends the instance with its
  // host once the last socket is gone. Says what was dropped, or nothing when
  // there was no scripted host to drop.
  closeForScriptReload(): string | undefined {
    const activityName = this.activityName();
    if (!activityName || this.closed) {
      return;
    }
    const instance = findActivityInstance(activityName, this.hosts);
    if (!instance?.host()) {
      return;
    }
    this.socket.destroy();
    return `${this.kind} ${this.remote} in ${activityName}`;
  }

  // The debugger's kick: the connection drops as a host crash would, and the
  // client goes back to orbit. The instance ends with its last socket.
  debugKick(): string {
    const activityName = this.activityName() ?? "no activity";
    this.socket.destroy();
    return `${this.kind} ${this.remote} (${activityName})`;
  }

  debugBubble(): string | undefined {
    const bubble = this.crossing.clientBubble ?? this.crossing.currentSlice;
    return bubble === undefined
      ? undefined
      : `${bubble}.${this.crossing.currentBubbleState}`;
  }

  logRowsFlushed(count: number): void {
    event_message("activities:host: debugger pushed %d changed row(s)", count);
  }

  activityInstance(): ActivityInstance | undefined {
    const activityName = this.activityName();
    return activityName
      ? activityInstanceFor(activityName, this.hosts)
      : undefined;
  }

  // A teleport the debugger asks for (RegionCrossing.debugTeleport).
  debugTeleport(region: number, transition: number): string {
    return this.crossing.debugTeleport(region, transition);
  }

  debugTeleportClear(): string {
    return this.crossing.debugTeleportClear();
  }

  // The debugger changed rows (an expression, a row action): they go out now,
  // spawned or not, since the tick that would send them waits for a spawn.
  debugFlushRows(): number {
    return this.scripts.debugFlushRows();
  }
}
