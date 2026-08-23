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
import { ActivityHostManager } from "./activity-host-manager";
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
  buildWorldGlobalsStateRsat,
} from "./rsat";

/**
 * TCP session for the activity host proxy.
 */
export class ActivityHostProxySession {
  private readonly codec = new BungieCodec();
  private buffer = Buffer.alloc(0);
  private closed = false;
  private notifySeq = 0;
  private activityStateSent = false;
  private keepalive: ReturnType<typeof setInterval> | undefined;

  private readonly activityHostManager: ActivityHostManager;

  constructor(
    private readonly socket: net.Socket,
    private readonly logger: ILogger
  ) {
    this.activityHostManager = new ActivityHostManager(logger);
    const remote = `${socket.remoteAddress}:${socket.remotePort}`;
    this.logger.log(`AH proxy client connected ${remote}`);

    socket.on("data", (chunk) => this.onData(chunk));
    socket.on("error", (err) => {
      this.logger.warn(`AH proxy socket error ${remote}: ${err.message}`);
    });
    socket.on("close", () => {
      this.closed = true;
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
    const body = this.activityHostManager.handle(message);
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
      parsed.kind === ActivityHostMessageType.ActivityClientKeepaliveResponse
    ) {
      return;
    }
    if (
      parsed.kind === ActivityHostMessageType.ActivityClientRequestStateRefresh
    ) {
      this.handleStateRefresh(parsed.sessionId, parsed.payload);
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
          `session=0x${parsed.sessionId.toString(16)} ` +
          (peek
            ? `nonce=${peek.nonce} ah=0x${peek.activityHostId.toString(16)} ` +
              `account=${peek.account} character=${peek.character} `
            : "") +
          `req ${parsed.payload.length}B rsp ${body.length}B)`
      );
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      this.logger.warn(`AH proxy join result FAILED, absorbed: ${m}`);
    }
  }

  private handleStateRefresh(sessionId: bigint, payload: Buffer): void {
    // TOOD: this is kindof hacky, update in future.
    const mask = this.activityHostManager.fah.takeFirstEntityIndexGrant();
    if (mask) {
      this.pushAh(
        sessionId,
        ActivityHostMessageType.EntitySlotsAllocated,
        mask,
        `state-refresh → entity-index req ${payload.length}B mask ${mask.length}B`
      );
    }

    if (!this.activityStateSent) {
      this.activityStateSent = true;
      const start = this.activityHostManager.getStartRequest();
      const gas = buildGlobalActivityStateRsat({
        instanceId: sessionId,
        activityId: start?.activityId,
      });
      const wgs = buildWorldGlobalsStateRsat();
      this.pushAh(
        sessionId,
        ActivityHostMessageType.GlobalActivityState,
        gas,
        `state-refresh → gas ${gas.length}B` +
          (start ? ` start activity=${start.activityId}` : " start=none")
      );
      this.pushAh(
        sessionId,
        ActivityHostMessageType.WorldGlobalsState,
        wgs,
        `state-refresh → wgs ${wgs.length}B`
      );
      this.startKeepalive(sessionId);
    }
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
      this.pushAh(
        sessionId,
        ActivityHostMessageType.ActivityClientKeepaliveRequest,
        Buffer.alloc(1, 0),
        "keepalive"
      );
    };
    beat();
    this.keepalive = setInterval(beat, 1000);
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
