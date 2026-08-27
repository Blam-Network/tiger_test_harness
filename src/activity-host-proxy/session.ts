import * as crypto from "node:crypto";
import type * as net from "node:net";
import {
  BungieCodec,
  type RawBapMessage,
} from "../bungie-access-protocol/codec";
import {
  BAP_SESSION_KEY_AES,
  BAP_SESSION_KEY_HMAC,
} from "../bungie-access-protocol/config";
import {
  BapMessageType,
  bapMessageTypeName,
} from "../bungie-access-protocol/constants";
import type ILogger from "../ILogger";
import type { ActivityHostKind } from "./activity-host";
import { ActivityHostManager } from "./activity-host-manager";
import { activityNameForId } from "./activity-id";
import type { AhClientIdentity } from "./join";
import {
  ActivityHostMessageType,
  activityHostMessageTypeName,
  isActivityHostMessageType,
} from "./messages";
import {
  buildActivityHostToClientNotification,
  buildJoinResultNotification,
  parseClientToActivityHostNotification,
  peekJoinRequest,
} from "./notification";
import {
  buildGlobalActivityStateRsat,
  buildReplicateMembershipRsat,
  buildSensorAuthTickRsat,
  buildTowerSensorAuthRsat,
  buildWorldGlobalsStateRsat,
  parseStateRefreshSlice,
  playerKeyFromCharacter,
} from "./rsat";
import { scenarioClient } from "./scenario-client";

/**
 * TCP session for the activity host proxy.
 */
export class ActivityHostProxySession {
  private readonly codec = new BungieCodec();
  private buffer = Buffer.alloc(0);
  private closed = false;
  private notifySeq = 0;
  // TOWERSPAWN TODO: Clean these up, move the ones we need into AH
  private activityStateSent = false;
  private sensorAuthGranted = false;
  private membershipPushes = 0;
  private membershipGeneration = 0;
  private joinIdentity: AhClientIdentity | undefined;
  private keepalive: ReturnType<typeof setInterval> | undefined;
  // in-world time
  private activityClockStarted = 0;
  private currentSlice: number | undefined;

  // TOWERSPAWN TODO: WHY DOES THE PROXY HAVE A KIND?
  readonly kind: ActivityHostKind;

  constructor(
    private readonly socket: net.Socket,
    private readonly logger: ILogger,
    private readonly manager: ActivityHostManager
  ) {
    this.kind = this.manager.bindSession();
    const remote = `${socket.remoteAddress}:${socket.remotePort}`;
    this.logger.log(`AH proxy client connected ${remote} (${this.kind})`);

    socket.on("data", (chunk) => this.onData(chunk));
    socket.on("error", (err) => {
      this.logger.warn(`AH proxy socket error ${remote}: ${err.message}`);
    });
    socket.on("close", () => {
      this.closed = true;
      this.manager.unbindSession(this.kind);
      this.stopKeepalive();
      this.logger.log(`AH proxy client disconnected ${remote}`);
    });
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
      this.logger.error(
        `AH proxy frame error: ${error instanceof Error ? error.message : String(error)}`
      );
      this.socket.destroy();
    }
  }

  private handleMessage(message: RawBapMessage): void {
    this.logger.log(
      `AH proxy ← ${bapMessageTypeName(message.msgType)} seq=${message.sequence} ` +
        `body=${message.body.length}b`
    );

    switch (message.msgType) {
      case BapMessageType.ClientToBapChannelStartupRequest:
        this.handleChannelStartup(message);
        break;
      case BapMessageType.ClientToBapSecureHelloRequest:
        this.handleSecureHello(message);
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
        this.logger.warn(
          `AH proxy unhandled ${bapMessageTypeName(message.msgType)} ` +
            `seq=${message.sequence} body=${hexPreview(message.body)}`
        );
        break;
    }
  }

  private handleChannelStartup(message: RawBapMessage): void {
    const CHANNEL_MAGIC = Buffer.from("DESTINY\x01", "ascii");

    if (
      message.body.length < 8 ||
      !message.body.subarray(0, 8).equals(CHANNEL_MAGIC)
    ) {
      this.logger.warn(
        `AH proxy channel startup magic mismatch (${message.body.length} bytes)`
      );
    }

    const seed = crypto.randomBytes(120);
    const body = Buffer.concat([CHANNEL_MAGIC, seed]);
    this.send({
      msgType: BapMessageType.ClientToBapChannelStartupResponse,
      sequence: message.sequence,
      body,
    });
    this.logger.log("AH proxy channel startup complete");
  }

  private handleSecureHello(message: RawBapMessage): void {
    const gcmKey = crypto.randomBytes(16);
    const gcmIv = crypto.randomBytes(12);
    const cbcNonce = Buffer.alloc(16, 0);

    const dataRaw = Buffer.concat([gcmIv, gcmKey]);
    const dataEncrypted = aes128CbcEncrypt(
      BAP_SESSION_KEY_AES,
      cbcNonce,
      dataRaw
    );

    const payloadCore = Buffer.alloc(
      4 + cbcNonce.length + dataEncrypted.length
    );
    payloadCore.writeUInt32BE(0x50, 0);
    cbcNonce.copy(payloadCore, 4);
    dataEncrypted.copy(payloadCore, 4 + cbcNonce.length);

    const tag = crypto
      .createHmac("sha256", BAP_SESSION_KEY_HMAC)
      .update(payloadCore)
      .digest();

    const payload = Buffer.concat([payloadCore, tag]);
    this.send({
      msgType: BapMessageType.ClientToBapSecureHelloResponse,
      sequence: message.sequence,
      body: payload,
    });

    this.codec.enableEncryption(gcmKey, gcmIv);
    this.logger.log("AH proxy secure hello complete — GCM enabled");
  }

  private handleActivityHostManager(message: RawBapMessage): void {
    const body = this.manager.handle(message, this.kind);
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
    const parsed = parseClientToActivityHostNotification(message.body);
    if (!parsed) {
      this.logger.warn(
        `AH proxy notification too short (${message.body.length}B) ` +
          `body=${hexPreview(message.body)}`
      );
      return;
    }

    const kindName = isActivityHostMessageType(parsed.kind)
      ? activityHostMessageTypeName(parsed.kind)
      : `ah_${parsed.kind}`;
    if (
      parsed.kind === ActivityHostMessageType.SendClientHeartbeat ||
      parsed.kind === ActivityHostMessageType.ActivityClientKeepaliveRequest ||
      parsed.kind === ActivityHostMessageType.ActivityClientKeepaliveResponse ||
      parsed.kind === ActivityHostMessageType.MembershipAcknowledgement
    ) {
      return;
    }
    if (
      parsed.kind === ActivityHostMessageType.ActivityClientRequestStateRefresh
    ) {
      this.handleStateRefresh(parsed.sessionId, parsed.payload);
      return;
    }
    if (parsed.kind === ActivityHostMessageType.ClientAuthoritativeDataUpdate) {
      this.handleClientAuth(parsed.sessionId, parsed.payload);
      return;
    }
    if (
      parsed.kind === ActivityHostMessageType.AbandonEntitySlots ||
      parsed.kind === ActivityHostMessageType.AbdicateAuthority ||
      parsed.kind === ActivityHostMessageType.RequestPurgeEntitySlots
    ) {
      this.logger.log(
        `AH proxy ${kindName} absorbed session=0x${parsed.sessionId.toString(16)} ` +
          `payload=${hexPreview(parsed.payload)}`
      );
      return;
    }
    if (parsed.kind === ActivityHostMessageType.PeerLeaveRequest) {
      this.logger.log(
        `AH proxy peer_leave absorbed session=0x${parsed.sessionId.toString(16)} ` +
          `payload=${hexPreview(parsed.payload)}`
      );
      return;
    }
    if (parsed.kind === ActivityHostMessageType.FreeEntityIndices) {
      this.handleFreeEntityIndices(parsed.sessionId, parsed.payload);
      return;
    }
    if (parsed.kind === ActivityHostMessageType.AllocateEntityIndices) {
      this.handleAllocateEntityIndices(parsed.sessionId, parsed.payload);
      return;
    }
    if (parsed.kind !== ActivityHostMessageType.JoinRequest) {
      this.logger.warn(
        `AH proxy unhandled ${kindName} ` +
          `session=0x${parsed.sessionId.toString(16)} ` +
          `variant=${parsed.variant} payload=${hexPreview(parsed.payload)}`
      );
      return;
    }

    try {
      const peek = peekJoinRequest(parsed.payload);
      if (peek) {
        this.joinIdentity = {
          machine: peek.machine,
          player: peek.player,
          account: peek.account,
          character: peek.character,
        };
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
      this.logger.log(
        `AH proxy join result (seq ${seq.toString(16)}, ` +
          `session=0x${parsed.sessionId.toString(16)}` +
          ` ${this.kind} ` +
          (peek
            ? `nonce=${peek.nonce} ah=0x${peek.activityHostId.toString(16)} ` +
              `account=${peek.account} character=${peek.character} `
            : "") +
          `req ${parsed.payload.length}B rsp ${body.length}B)`
      );
      this.pushJoinState(parsed.sessionId);
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      this.logger.warn(`AH proxy join result FAILED, absorbed: ${m}`);
    }
  }

  /**
   * Retail: first refresh is GAS + WGS + SensorAuth for the live slice.
   * Join already sent the identity grant. Later refreshes carry the
   * destination bubble; we re-bind PAH to that slice.
   */
  private handleStateRefresh(sessionId: bigint, payload: Buffer): void {
    const opts = this.towerAuthOpts();
    const bubbleCount = opts.scenario?.bubbleCount ?? 5;
    if (this.currentSlice === undefined) {
      this.currentSlice = opts.scenario?.initialBubble ?? 0;
    }
    const hinted = parseStateRefreshSlice(payload, bubbleCount);
    const previousSlice =
      hinted !== undefined && hinted !== this.currentSlice
        ? this.currentSlice
        : undefined;
    if (hinted !== undefined) {
      this.currentSlice = hinted;
    }
    this.logger.log(
      `AH proxy state-refresh slice=${this.currentSlice}` +
        (previousSlice === undefined ? "" : ` from=${previousSlice}`) +
        ` hint=${hinted ?? "none"} payload=${hexPreview(payload)}`
    );
    if (this.activityStateSent) {
      this.pushEntityIndexGrant(sessionId);
      this.pushMembership(sessionId, previousSlice !== undefined);
    } else {
      this.pushJoinState(sessionId);
    }
    this.pushActivityGlobals(sessionId);
    if (this.kind === "FAH") {
      this.pushSensorAuthApply(sessionId);
    }
  }

  /**
   * Join-result: identity grant, entity-index, membership. GAS/WGS wait
   * for state-refresh, matching retail.
   */
  private pushJoinState(sessionId: bigint): void {
    if (this.activityStateSent) {
      return;
    }
    this.activityStateSent = true;
    const start = this.manager.getStartRequest();
    const activityName =
      start === undefined ? undefined : activityNameForId(start.activityId);
    const scenario = activityName ? scenarioClient(activityName) : undefined;
    if (start && !scenario) {
      this.logger.warn(
        `AH proxy no scenario for start activity=${start.activityId}`
      );
    }
    this.currentSlice ??= scenario?.initialBubble ?? 0;
    this.pushJoinSensorAuth(sessionId);
    this.pushEntityIndexGrant(sessionId);
    this.pushMembership(sessionId);
    this.startKeepalive(sessionId);
  }

  private pushActivityGlobals(sessionId: bigint): void {
    const start = this.manager.getStartRequest();
    const activityName =
      start === undefined ? undefined : activityNameForId(start.activityId);
    const scenario = activityName ? scenarioClient(activityName) : undefined;
    const gas = buildGlobalActivityStateRsat({
      activityChecksum: scenario?.privateChecksum,
      activityId: start?.activityId,
      activityName: scenario?.activityName,
      bubbleCount: scenario?.bubbleCount,
      emptyBubbles: scenario?.emptyBubbles,
      familyChecksum: scenario?.familyChecksum,
      initialBubble: scenario?.initialBubble,
      instanceId: sessionId,
    });
    const wgs = buildWorldGlobalsStateRsat();
    this.pushAh(
      sessionId,
      ActivityHostMessageType.GlobalActivityState,
      gas,
      `gas ${gas.length}B` +
        (start ? ` start activity=${start.activityId}` : " start=none") +
        (scenario
          ? ` name=${scenario.activityName} bubbles=${scenario.bubbleCount}` +
            (scenario.initialBubble === undefined
              ? ""
              : ` slice=${scenario.initialBubble}`)
          : "")
    );
    this.pushAh(
      sessionId,
      ActivityHostMessageType.WorldGlobalsState,
      wgs,
      `wgs ${wgs.length}B`
    );
  }

  private pushEntityIndexGrant(sessionId: bigint): void {
    const mask = this.manager.host(this.kind).takeFirstEntityIndexGrant();
    if (!mask) {
      return;
    }
    this.pushAh(
      sessionId,
      ActivityHostMessageType.EntitySlotsAllocated,
      mask,
      `entity-index mask ${mask.length}B`
    );
  }

  private handleClientAuth(sessionId: bigint, payload: Buffer): void {
    this.logger.log(
      `AH proxy client-auth ${payload.length}B session=0x${sessionId.toString(16)}`
    );
  }

  // TODO: Entity Indices
  /**
   * FreeEntityIndices (class 20). Retail Tower capture never sent this.
   */
  private handleFreeEntityIndices(sessionId: bigint, payload: Buffer): void {
    this.manager.host(this.kind).noteEntityIndicesFreed(payload);
    this.logger.log(
      `AH proxy free_entity_indices absorbed session=0x${sessionId.toString(16)} ` +
        `mask=${payload.length}B`
    );
  }

  /**
   * AllocateEntityIndices (class 19), not sure what these are for yet.
   */
  private handleAllocateEntityIndices(
    sessionId: bigint,
    payload: Buffer
  ): void {
    const count = payload.length >= 4 ? payload.readUInt32BE(0) >>> 0 : 0;
    const { grant, granted, source } = this.manager
      .host(this.kind)
      .takeAllocateEntityIndexGrant(count);
    this.pushAh(
      sessionId,
      ActivityHostMessageType.EntitySlotsAllocated,
      grant,
      `allocate-entity-indices count=${count} granted ${granted} via ${source} ` +
        `mask ${grant.length}B`
    );
  }

  /**
   * SensorAuth activity ticks @ 30 Hz. 0 stalls combatant place.
   * Visual TOD is GAS worldServerTime, not this.
   */
  private activityTicks(): number {
    if (!this.activityClockStarted) {
      this.activityClockStarted = Date.now();
    }
    return (
      1 + Math.floor((Date.now() - this.activityClockStarted) / (1000 / 30))
    );
  }

  private towerAuthOpts() {
    const start = this.manager.getStartRequest();
    const activityName =
      start === undefined ? undefined : activityNameForId(start.activityId);
    return {
      activityTime: this.activityTicks(),
      authorityMachine: this.joinIdentity?.machine,
      playerKey: playerKeyFromCharacter(this.joinIdentity?.character),
      scenario: activityName ? scenarioClient(activityName) : undefined,
    };
  }

  /**
   * State-refresh apply: identity + current-slice squads + leftover Some.
   * hasAuth=0. Do not None the previous slice's type-1.
   */
  private pushSensorAuthApply(sessionId: bigint): void {
    const opts = this.towerAuthOpts();
    const slice = this.currentSlice ?? opts.scenario?.initialBubble ?? 0;
    const rsat = buildTowerSensorAuthRsat({
      ...opts,
      grantTable: false,
      slice,
    });
    this.pushAh(
      sessionId,
      ActivityHostMessageType.SensorAuthUpdate,
      rsat,
      `sensor-auth ${rsat.length}B ${this.kind} spawn=tower apply hasAuth=0 ` +
        `slice=${slice}`
    );
  }

  /**
   * Join grant (retail 261): Lifetime + Player on 4786, hasAuth=1.
   */
  private pushJoinSensorAuth(sessionId: bigint): void {
    if (this.kind !== "FAH" || this.sensorAuthGranted) {
      return;
    }
    const opts = this.towerAuthOpts();
    const grant = buildTowerSensorAuthRsat({
      ...opts,
      grantTable: true,
    });
    const bubbles = opts.scenario?.bubbleCount ?? 5;
    this.pushAh(
      sessionId,
      ActivityHostMessageType.SensorAuthUpdate,
      grant,
      `sensor-auth ${grant.length}B ${this.kind} spawn=tower identity grant 0..${bubbles - 1}+64`
    );
    this.sensorAuthGranted = true;
  }

  /** Idle tick: activity time only, no bundle items. */
  private pushSensorAuthTick(sessionId: bigint): void {
    const rsat = buildSensorAuthTickRsat(this.activityTicks());
    this.pushAh(
      sessionId,
      ActivityHostMessageType.SensorAuthUpdate,
      rsat,
      `sensor-auth ${rsat.length}B ${this.kind} tick`
    );
  }

  private pushMembership(sessionId: bigint, force = false): void {
    if (!this.joinIdentity || (!force && this.membershipPushes >= 1)) {
      return;
    }
    this.membershipPushes += 1;
    const generation = ++this.membershipGeneration;
    const start = this.manager.getStartRequest();
    const activityName =
      start === undefined ? undefined : activityNameForId(start.activityId);
    const scenario = activityName ? scenarioClient(activityName) : undefined;
    const bubbleCount = scenario?.bubbleCount ?? 1;
    const mem = buildReplicateMembershipRsat(this.joinIdentity, {
      bubbleCount,
      emptyBubbles: scenario?.emptyBubbles,
      generation,
      initialBubble: this.currentSlice ?? scenario?.initialBubble,
    });
    const machine = this.joinIdentity.machine.toString("hex");
    this.pushAh(
      sessionId,
      ActivityHostMessageType.ReplicateMembership,
      mem,
      `membership ${mem.length}B gen=${generation} slot0 machine=${machine} ` +
        `pah bubbles=${bubbleCount} slice=${this.currentSlice ?? scenario?.initialBubble} ` +
        "tokens=1..8 local-only"
    );
  }

  private pushAh(
    sessionId: bigint,
    kind: ActivityHostMessageType,
    payload: Buffer,
    label: string
  ): void {
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
    this.logger.log(
      `AH proxy ${label} (seq ${seq.toString(16)}, ah=0x${sessionId.toString(16)})`
    );
  }

  private startKeepalive(sessionId: bigint): void {
    this.stopKeepalive();
    const beat = (): void => {
      if (this.closed) {
        this.stopKeepalive();
        return;
      }
      this.pushSensorAuthTick(sessionId);
    };
    this.keepalive = setInterval(beat, 3000);
  }

  private stopKeepalive(): void {
    if (this.keepalive) {
      clearInterval(this.keepalive);
      this.keepalive = undefined;
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
    this.logger.log(
      `AH proxy ${label} rsp (seq ${message.sequence.toString(16)}, req ${message.body.length}B)`
    );
  }

  private send(message: RawBapMessage): void {
    const frame = this.codec.encode(message);
    this.logger.log(
      `AH proxy → ${bapMessageTypeName(message.msgType)} seq=${message.sequence} ` +
        `frame=${frame.length}b`
    );
    this.socket.write(frame);
  }
}

function aes128CbcEncrypt(key: Buffer, iv: Buffer, data: Buffer): Buffer {
  const cipher = crypto.createCipheriv("aes-128-cbc", key, iv);
  return Buffer.concat([cipher.update(data), cipher.final()]);
}

function hexPreview(buf: Buffer, max = 64): string {
  const slice = buf.subarray(0, max);
  const hex = slice.toString("hex");
  return buf.length > max ? `${hex}…(${buf.length}B)` : hex;
}
