import type * as net from "node:net";
import {
  event_error,
  event_message,
  event_status,
  event_warning,
} from "@blamnetwork/datamine";
import {
  ACTIVITY_HOST_PROXY_IP,
  ACTIVITY_HOST_PROXY_PORT,
  buildGetActivityHostProxyResponse,
  parseGetActivityHostProxyRequest,
} from "../activity-host-proxy";
import {
  ACTIVITY_HOST_NOTIFICATION_VARIANT,
  parseActivityHostToClientNotification,
} from "../activity-host-proxy/notification";
import { activeBuild, clientBuildMatches } from "../builds";
import { progressionDef } from "../content/progressions";
import { levelForXp } from "../investment/character-level";
import type {
  AccountRecord,
  CharacterRecord,
  CharacterStore,
} from "../investment/character-store";
import {
  applyLootPickup,
  lootTableForCharacter,
  rollLootDrop,
} from "../investment/loot";
import {
  type ChannelEnd,
  handleChannelStartup,
  handleSecureHello,
} from "../lib/bap-wire/channel";
import { BungieCodec, type RawBapMessage } from "../lib/bap-wire/codec";
import { BapMessageType, bapMessageTypeName } from "../lib/bap-wire/constants";
import {
  registerPlayer,
  type SelfFamilyPublisher,
  setPlayerCharacter,
  unregisterPlayer,
} from "../players/registry";
import {
  buildAccountIdTranslateResponse,
  parseAccountIdTranslateRequest,
} from "./account-id-translate";
import { buildClientConfigResponseBody } from "./client-config";
import { FamilyPusher } from "./queuez/family-push";
import { characterPowerLevel } from "./queuez/power-level";
import {
  CLIENT_CONFIG_COOKIE,
  CLIENT_CONFIG_SOCIAL_MATCHMAKING_ID,
} from "./stubs/client-config";
import { LOCAL_INVESTMENT_ACCOUNT_SOID } from "./stubs/server-objects";
import { parseSubscribeRequest } from "./subscribe";
import { bapBuild } from "./versions";
import { handleWorldServerRequest } from "./world-server";
import type { WorldServerContext } from "./world-server/context";
import { formatXetrovNotification, xetrovBuild } from "./xetrov";

// A progression step's grantedItem when it grants nothing.
const NO_GRANTED_ITEM = 0xff_ff;

// Self pushes after director_enter_orbit, in ms after the reply; they span a
// console orbit load (scheduleOrbitRefresh).
const ORBIT_REFRESH_DELAYS_MS = [3000, 8000, 15_000, 30_000];

export class BungieAccessProtocolSession implements SelfFamilyPublisher {
  private readonly codec = new BungieCodec();
  private buffer = Buffer.alloc(0);
  private closed = false;
  // The account behind this connection (login_account, 503) and the character
  // it signed in with (login_character, 504). Until 504 the self family
  // carries no character and the client shows the select / create screen.
  private account: AccountRecord | null = null;
  private character: CharacterRecord | null = null;
  // Every character soid on the account, carried by each self baseline for
  // the select list; refreshed on login, create and delete.
  private rosterSoids: bigint[] = [];
  // Store-backed handlers run one at a time, in arrival order: the client
  // sends login_create_character and the follow-up fetch_family back to
  // back, and the roster must already contain the new character.
  private queue: Promise<void> = Promise.resolve();
  private readonly families: FamilyPusher;
  // Pending self pushes after director_enter_orbit (scheduleOrbitRefresh).
  private orbitRefreshTimers: ReturnType<typeof setTimeout>[] = [];
  // An activity the host saw end, whose completion push waits for the
  // client to leave it (completeActivity).
  private pendingActivityComplete: number | undefined;
  private xetrovBuildChecked = false;
  // What the world-server handlers see of this session.
  private readonly world: WorldServerContext;

  constructor(
    private readonly socket: net.Socket,
    private readonly store: CharacterStore
  ) {
    const remote = `${socket.remoteAddress}:${socket.remotePort}`;
    event_message("networking:bap: client connected %s", remote);
    this.families = new FamilyPusher({
      accountSoid: () => this.accountSoid,
      character: () => this.character,
      rosterSoids: () => this.rosterSoids,
      send: (message) => this.send(message),
      store,
    });
    this.world = this.createWorldContext();

    socket.on("data", (chunk) => this.onData(chunk));
    socket.on("error", (err) => {
      event_warning("networking:bap: socket error %s: %s", remote, err.message);
    });
    socket.on("close", () => {
      this.closed = true;
      this.clearOrbitRefresh();
      this.character = null;
      unregisterPlayer(this);
      event_message("networking:bap: client disconnected %s", remote);
    });
  }

  private createWorldContext(): WorldServerContext {
    return {
      store: this.store,
      account: () => this.account,
      accountSoid: () => this.accountSoid,
      buildBaselineForFamily: (familyType, rootSoid) =>
        this.families.buildBaselineForFamily(familyType, rootSoid),
      character: () => this.character,
      currentFamilyVersion: (familyType) =>
        this.families.currentFamilyVersion(familyType),
      flushActivityComplete: (after) => this.flushActivityComplete(after),
      nextFamilyVersion: (familyType) =>
        this.families.nextFamilyVersion(familyType),
      pushFamily: (body, label) => this.families.pushFamily(body, label),
      pushInventoryChange: (changed, removed, label) =>
        this.families.pushInventoryChange(changed, removed, label),
      pushLoadoutChange: (changed, label) =>
        this.families.pushLoadoutChange(changed, label),
      pushSelfUpdate: (label) => this.families.pushSelfUpdate(label),
      refreshRoster: () => this.refreshRoster(),
      reply: (message, body, log) => this.worldServerReply(message, body, log),
      replyStatusOnly: (message, responseType, label) =>
        this.handleStatusOnlyReply(message, responseType, label),
      scheduleOrbitRefresh: () => this.scheduleOrbitRefresh(),
      send: (message) => this.send(message),
      setCharacter: (next) => this.setCharacter(next),
      signInAccount: (account, platformId) => {
        this.account = account;
        registerPlayer(this, platformId, account.soid);
      },
    };
  }

  // Keeps the player registry entry for this connection's signed-in
  // character in sync (login/switch/signout) so the AH proxy can find this
  // session by character soid for loot drops.
  private setCharacter(next: CharacterRecord | null): void {
    this.character = next;
    setPlayerCharacter(this, next?.soid);
  }

  private async refreshRoster(): Promise<void> {
    this.rosterSoids = this.account
      ? (await this.store.listCharacters(this.account.soid)).map((c) => c.soid)
      : [];
  }

  // Kill -> drop: roll an item against the resolved combatant's value,
  // allocate a loot slot on this character's table (evicting the oldest one
  // if it's full) and push the self delta that carries it.
  dropLoot(incidentNumber: number, submitterSoid: bigint, value: number): void {
    const character = this.character;
    if (!character) {
      return;
    }
    const roll = rollLootDrop(value);
    if (!roll) {
      return;
    }
    const dropped = lootTableForCharacter(character.soid).drop(
      roll.itemDef,
      roll.quantity,
      incidentNumber,
      submitterSoid
    );
    event_message(
      "networking:bap: loot drop itemDef=%u qty=%d slot=%d incident=%d ordinal=%d char=0x%I64x",
      dropped.slot.itemDef,
      dropped.slot.quantity,
      dropped.index,
      incidentNumber,
      dropped.slot.nonce.ordinal,
      character.soid
    );
    this.families.pushInventoryChange([], [], "loot drop");
  }

  // The client has no XP source of its own: a progression row changing in a
  // family-4 update is what raises the toast and the level-up.
  grantXp(amount: number, reason: string): void {
    const character = this.character;
    if (!character || amount <= 0) {
      return;
    }
    const before = levelForXp(character.progressionXp);
    this.store
      .addProgressionXp(character.soid, amount)
      .then((xp) => {
        character.progressionXp = xp;
        const after = levelForXp(xp);
        character.level = after;
        event_message(
          "networking:bap: grant %d XP (%s) char=0x%I64x xp=%d level=%d%s",
          amount,
          reason,
          character.soid,
          xp,
          after,
          after > before ? " LEVEL UP" : ""
        );
        this.families.pushLoadoutChange([], `xp grant (${reason})`);
      })
      .catch((error: unknown) => {
        event_warning("networking:bap: grant XP failed: %s", String(error));
      });
  }

  // Progression 0 (BapBuild.progressionZero): kills add points toward a
  // one-time reward, the first step's item, granted through the loot pickup
  // insert the moment the running total crosses the step.
  grantProgressionZero(amount: number, reason: string): void {
    const character = this.character;
    const policy = bapBuild().progressionZero;
    if (!(character && policy) || amount <= 0) {
      return;
    }
    const step = progressionDef(policy.progression)?.steps[0];
    if (!step || step.grantedItem === NO_GRANTED_ITEM) {
      return;
    }
    const before = character.progressionZeroXp;
    this.store
      .addProgressionZeroXp(character.soid, amount)
      .then(async (total) => {
        character.progressionZeroXp = total;
        const crossed = before < step.xpRequired && total >= step.xpRequired;
        event_message(
          "networking:bap: grant %d progression-%d points (%s) char=0x%I64x total=%d%s",
          amount,
          policy.progression,
          reason,
          character.soid,
          total,
          crossed ? " REWARD" : ""
        );
        if (!crossed) {
          return;
        }
        const item = await applyLootPickup(
          this.store,
          character,
          step.grantedItem
        );
        this.families.pushInventoryChange(
          [item.soid],
          [],
          `progression-${policy.progression} reward (${reason})`
        );
      })
      .catch((error: unknown) => {
        event_warning(
          "networking:bap: grant progression-%d failed: %s",
          policy.progression,
          String(error)
        );
      });
  }

  powerLevel(): number | undefined {
    return this.character ? characterPowerLevel(this.character) : undefined;
  }

  characterSummary(): { level: number; name: string } | undefined {
    return this.character
      ? { level: this.character.level, name: this.character.name }
      : undefined;
  }

  // The character joined an activity host. The real server pushes a character
  // delta right after every join (2.3.1 capture) naming the activity in
  // progress; the client starts its reward tracker on it. A player's FAH and
  // GAH both join, so the second is a no-op.
  enterActivity(activityIndex: number): void {
    const character = this.character;
    if (!(character && bapBuild().selfNamesActivity)) {
      return;
    }
    const current = character.lastActivity;
    if (current?.index === activityIndex && !current.completed) {
      return;
    }
    character.lastActivity = { completed: false, index: activityIndex };
    this.families.pushInventoryChange(
      [],
      [],
      `activity ${activityIndex} joined`
    );
  }

  // The activity host saw the character's activity end. Finishing the
  // prologue mission takes the prologue flag off. The completion push makes
  // the client launch the activity's next one (act_cosmo_m0_highway ->
  // cine_reveal -> the Tower), so it waits for the client to leave: pushed
  // while the activity is up, the client goes silent and never shows its 14 s
  // results screen. This client's leave is director_enter_orbit.
  completeActivity(activityIndex: number): void {
    const character = this.character;
    if (!(character && bapBuild().selfNamesActivity)) {
      return;
    }
    if (
      activityIndex === bapBuild().prologueMissionActivity &&
      character.prologuePending
    ) {
      character.prologuePending = false;
      this.store.completePrologue(character.soid).catch((error: unknown) => {
        event_warning(
          "networking:bap: prologue complete failed: %s",
          String(error)
        );
      });
    }
    this.pendingActivityComplete = activityIndex;
    event_message(
      "networking:bap: activity %d complete char=0x%I64x prologuePending=%s, push waits for the leave",
      activityIndex,
      character.soid,
      character.prologuePending
    );
  }

  // The client has left the activity (fetch_universe, or director_enter_orbit
  // when it went another way): the completion goes out now. The client
  // chains only when the finished flag turns on with the activity already
  // named, so a character the join never named it for (a BAP session that
  // reconnected mid-mission) gets it unfinished first.
  private flushActivityComplete(after: string): void {
    const activityIndex = this.pendingActivityComplete;
    const character = this.character;
    if (activityIndex === undefined || !character) {
      return;
    }
    this.pendingActivityComplete = undefined;
    const current = character.lastActivity;
    if (current?.index !== activityIndex || current.completed) {
      character.lastActivity = { completed: false, index: activityIndex };
      this.families.pushInventoryChange(
        [],
        [],
        `activity ${activityIndex} running`
      );
    }
    character.lastActivity = { completed: true, index: activityIndex };
    this.families.pushInventoryChange(
      [],
      [],
      `activity ${activityIndex} complete (${after})`
    );
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
        "networking:bap: frame error: %s",
        error instanceof Error ? error.message : String(error)
      );
      this.socket.destroy();
    }
  }

  private handleMessage(message: RawBapMessage): void {
    event_status(
      "networking:bap: ← %s seq=%u body=%db",
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
      case BapMessageType.ClientToBapQueuezRegisterRequest:
        this.handleStatusOnlyReply(
          message,
          BapMessageType.ClientToBapQueuezRegisterResponse,
          "qz_reg"
        );
        break;
      case BapMessageType.ClientToBapRegisterRelayClientRequest:
        this.handleStatusOnlyReply(
          message,
          BapMessageType.ClientToBapRegisterRelayClientResponse,
          "rrc"
        );
        break;
      case BapMessageType.ClientToBapEchoRequest:
        this.handleStatusOnlyReply(
          message,
          BapMessageType.ClientToBapEchoResponse,
          "echo"
        );
        break;
      case BapMessageType.ClientToWorldServerRequest:
        this.enqueue("world-server req", () =>
          this.handleWorldServerRequest(message)
        );
        break;
      case BapMessageType.ClientToBapSubscriptionRequest:
        this.enqueue("subscription", () =>
          this.handleSubscriptionRequest(message)
        );
        break;
      case BapMessageType.ClientToBapUnsubscribeRequest:
        this.enqueue("unsubscribe", async () =>
          this.handleUnsubscribeRequest(message)
        );
        break;
      case BapMessageType.ClientToBapClientConfigRequest:
        this.handleClientConfig(message);
        break;
      case BapMessageType.ClientToBapAccountIdTranslationPlatformToInvestmentRequest:
        this.enqueue("acct-id xlate", () =>
          this.handleAccountIdTranslation(message)
        );
        break;
      case BapMessageType.ClientToBapGetActivityHostProxyRequest:
        this.handleGetActivityHostProxy(message);
        break;
      case BapMessageType.ClientToXetrovNotification:
        this.checkXetrovBuild(message.body);
        event_message(
          "networking:bap: %s (seq %x, no rsp)",
          formatXetrovNotification(message.body),
          message.sequence
        );
        break;
      case BapMessageType.BapToClientActivityNotification:
        this.handleRelayedActivityNotification(message);
        break;
      default:
        event_warning(
          "networking:bap: unhandled message type 0x%x",
          message.msgType
        );
        break;
    }
  }

  // The first xetrov notification that says which build the client is; one on
  // another build is cut off.
  private checkXetrovBuild(body: Buffer): void {
    if (this.xetrovBuildChecked) {
      return;
    }
    const reported = xetrovBuild(body);
    if (reported === undefined) {
      return;
    }
    this.xetrovBuildChecked = true;
    if (clientBuildMatches(reported) === "mismatch") {
      event_error(
        "networking:bap: client build %s, this server serves %s: closing",
        reported,
        activeBuild()
      );
      this.socket.destroy();
    }
  }

  private enqueue(what: string, task: () => Promise<void>): void {
    this.queue = this.queue.then(task).catch((err) => this.absorb(what, err));
  }

  private absorb(what: string, err: unknown): void {
    const m = err instanceof Error ? err.message : String(err);
    event_warning(
      "networking:bap: %s FAILED, absorbed to keep connection alive: %s",
      what,
      m
    );
  }

  private get accountSoid(): bigint {
    return this.account?.soid ?? LOCAL_INVESTMENT_ACCOUNT_SOID;
  }

  private worldServerReply(
    message: RawBapMessage,
    body: Buffer,
    log: string
  ): void {
    this.send({
      msgType: BapMessageType.ClientToWorldServerResponse,
      sequence: message.sequence,
      body,
    });
    event_message(
      "networking:bap: %s (seq %x, body %dB)",
      log,
      message.sequence,
      body.length
    );
  }

  // The orbit director keeps its node widgets per self family version and
  // snapshots the activity statuses behind them when it moves. Those are
  // rebuilt on a status tick after a family-4 update (every 4th game tick,
  // once orbit enables it), later than the push right after
  // director_enter_orbit, which leaves "Requirements Not Met" on every node.
  // The real server keeps pushing self deltas after orbit (2.3.1 capture), so
  // push a few more while the orbit loads.
  private scheduleOrbitRefresh(): void {
    this.clearOrbitRefresh();
    const character = this.character;
    this.orbitRefreshTimers = ORBIT_REFRESH_DELAYS_MS.map((delay) =>
      setTimeout(() => {
        if (!this.closed && character && this.character === character) {
          this.families.pushSelfUpdate(`orbit refresh +${delay}ms`);
        }
      }, delay)
    );
  }

  private clearOrbitRefresh(): void {
    for (const timer of this.orbitRefreshTimers) {
      clearTimeout(timer);
    }
    this.orbitRefreshTimers = [];
  }

  private handleWorldServerRequest(message: RawBapMessage): Promise<void> {
    return handleWorldServerRequest(this.world, message);
  }

  private handleGetActivityHostProxy(message: RawBapMessage): void {
    try {
      const activityHostId = parseGetActivityHostProxyRequest(message.body);
      if (activityHostId === null) {
        event_warning(
          "networking:bap: get_activity_host_proxy absorbed (short body %dB)",
          message.body.length
        );
        return;
      }

      const body = buildGetActivityHostProxyResponse(
        activityHostId,
        ACTIVITY_HOST_PROXY_IP,
        ACTIVITY_HOST_PROXY_PORT
      );
      this.send({
        msgType: BapMessageType.ClientToBapGetActivityHostProxyResponse,
        sequence: message.sequence,
        body,
      });
      event_message(
        "networking:bap: get_activity_host_proxy rsp (seq %x, ah=0x%I64x → %s:%d, body %dB)",
        message.sequence,
        activityHostId,
        ACTIVITY_HOST_PROXY_IP,
        ACTIVITY_HOST_PROXY_PORT,
        body.length
      );
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      event_warning(
        "networking:bap: get_activity_host_proxy rsp FAILED, absorbed: %s",
        m
      );
    }
  }

  private handleClientConfig(message: RawBapMessage): void {
    try {
      const body = buildClientConfigResponseBody(
        CLIENT_CONFIG_COOKIE,
        CLIENT_CONFIG_SOCIAL_MATCHMAKING_ID
      );
      this.send({
        msgType: BapMessageType.ClientToBapClientConfigResponse,
        sequence: message.sequence,
        body,
      });
      event_message(
        "networking:bap: client_config rsp (seq %x, cookie=%s social_mm=%s, body %dB)",
        message.sequence,
        CLIENT_CONFIG_COOKIE,
        CLIENT_CONFIG_SOCIAL_MATCHMAKING_ID,
        body.length
      );
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      event_warning(
        "networking:bap: client_config rsp FAILED, absorbed: %s",
        m
      );
    }
  }

  private async handleAccountIdTranslation(
    message: RawBapMessage
  ): Promise<void> {
    try {
      const body = message.body;
      if (body.length < 4) {
        event_warning(
          "networking:bap: acct-id xlate absorbed (short body %dB)",
          body.length
        );
        return;
      }
      const account = bapBuild().platformAccount;
      const platformIds = parseAccountIdTranslateRequest(body, account);
      const n = platformIds.length;
      // Single-player: every platform id the client asks about is this
      // connection's own account.
      const rsp = buildAccountIdTranslateResponse(
        platformIds,
        this.accountSoid,
        account
      );

      this.send({
        msgType:
          BapMessageType.ClientToBapAccountIdTranslationPlatformToInvestmentResponse,
        sequence: message.sequence,
        body: rsp,
      });
      event_message(
        "networking:bap: acct-id xlate rsp (seq %x, %d id(s) → 0x%I64x, body %dB)",
        message.sequence,
        n,
        this.accountSoid,
        rsp.length
      );
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      event_warning(
        "networking:bap: acct-id xlate rsp FAILED, absorbed: %s",
        m
      );
    }
  }

  // Sent after signout_character (e.g. a failed launch back to character
  // select). Replies are matched strictly in request order, so an unanswered
  // unsubscribe makes the next reply a mismatch and the client drops BAP
  // ("centipede"). The client never reads the body; echo the root soid like
  // the subscribe ack.
  private handleUnsubscribeRequest(message: RawBapMessage): void {
    const sub = parseSubscribeRequest(message.body);
    const body =
      message.body.length >= 9
        ? Buffer.from(message.body.subarray(1, 9))
        : Buffer.alloc(8);
    this.send({
      msgType: BapMessageType.ClientToBapUnsubscribeResponse,
      sequence: message.sequence,
      body,
    });
    event_message(
      "networking:bap: unsub rsp (seq %x, family_type=%s root=0x%I64x)",
      message.sequence,
      sub?.familyType ?? "?",
      sub?.rootSoid ?? 0n
    );
  }

  private async handleSubscriptionRequest(
    message: RawBapMessage
  ): Promise<void> {
    const sub = parseSubscribeRequest(message.body);
    const subAckRoot =
      message.body.length >= 9
        ? Buffer.from(message.body.subarray(1, 9))
        : Buffer.alloc(8);

    const pushes = await this.families.subscriptionBaselines(sub);

    // Encrypt/send baselines first, then wire-13 ACK (GCM IV order).
    const pushParts: string[] = [];
    for (const p of pushes) {
      const seq = this.families.sendUpdate(p.body);
      pushParts.push(`${p.label} type-123 seq ${seq} ${p.body.length}B`);
    }

    this.send({
      msgType: BapMessageType.ClientToBapSubscriptionResponse,
      sequence: message.sequence,
      body: subAckRoot,
    });

    const familyInfo = sub
      ? `family_type=${sub.familyType} root=0x${sub.rootSoid.toString(16)}`
      : `req ${message.body.length}B unparsed`;
    event_message(
      "networking:bap: sub rsp (seq %x, %s%s)",
      message.sequence,
      familyInfo,
      pushParts.length ? `; pushed ${pushParts.join("; ")}` : "; FIFO ack only"
    );
  }

  // FAH type 100 is dest PRIMARY. The client relays that inner body here as
  // wire 9; we push the same bytes back so investment delivers the join
  // result.
  private handleRelayedActivityNotification(message: RawBapMessage): void {
    const parsed = parseActivityHostToClientNotification(message.body);
    if (!parsed || parsed.variant !== ACTIVITY_HOST_NOTIFICATION_VARIANT) {
      event_warning(
        "networking:bap: b->c not ignored (variant %d, %dB)",
        message.body[0] ?? -1,
        message.body.length
      );
      return;
    }

    const seq = this.families.nextSequence();
    this.send({
      msgType: BapMessageType.BapToClientActivityNotification,
      sequence: seq,
      body: message.body,
    });
    event_message(
      "networking:bap: b->c not echo (seq %x, ah=0x%I64x class=%d payload %dB)",
      seq,
      parsed.sessionId,
      parsed.kind,
      parsed.payload.length
    );
  }

  // Empty-body response (qz_reg / rrc / echo).
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
      "networking:bap: %s rsp (seq %x, req %dB)",
      label,
      message.sequence,
      message.body.length
    );
  }

  // What the shared channel handshake (channel.ts) needs from this session.
  private get channelEnd(): ChannelEnd {
    return {
      category: "networking:bap:",
      codec: this.codec,
      send: (message) => this.send(message),
    };
  }

  private send(message: RawBapMessage): void {
    const frame = this.codec.encode(message);
    event_status(
      "networking:bap: → %s seq=%u frame=%db",
      bapMessageTypeName(message.msgType),
      message.sequence,
      frame.length
    );
    this.socket.write(frame);
  }
}
