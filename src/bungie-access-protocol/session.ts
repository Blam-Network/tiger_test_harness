import * as crypto from "node:crypto";
import type * as net from "node:net";
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
import type ILogger from "../ILogger";
import {
  buildAccountIdTranslateResponse,
  parseAccountIdTranslateRequest,
} from "./account-id-translate";
import { buildClientConfigResponseBody } from "./client-config";
import { BungieCodec, type RawBapMessage } from "./codec";
import { BAP_SESSION_KEY_AES, BAP_SESSION_KEY_HMAC } from "./config";
import { BapMessageType, bapMessageTypeName } from "./constants";
import { e_queuez_family_type } from "./queuez";
import {
  buildDirectorEnterOrbitResponseBody,
  buildFetchFamilyResponseBody,
  buildInspectionBaselineBody,
  buildLoginAccountResponseBody,
  buildPeerBaselineBody,
  buildProfileSetAccountProfileResponseBody,
  buildProfileSetCharacterProfileResponseBody,
  buildRosterBaselineBody,
  buildSelectCharacterBaselineBody,
  buildSelfBaselineBody,
  buildUniverseBaselineBody,
  e_server_message_network_id,
  INSPECTION_CHECKSUM_PRIMARY,
  LOCAL_INVESTMENT_ACCOUNT_SOID,
  PEER_CHECKSUM_PRIMARY,
  parseFetchFamilyRequest,
  SIGNED_IN_CHARACTER_SOID,
  UNIVERSE_ROOT_SOID,
} from "./rsat";
import { parseSubscribeRequest } from "./subscribe";

export class BungieAccessProtocolSession {
  private readonly codec = new BungieCodec();
  private buffer = Buffer.alloc(0);
  private closed = false;
  /** Sequence for server-pushed type-123 queuez updates. */
  private pushSeq = 1;

  constructor(
    private readonly socket: net.Socket,
    private readonly logger: ILogger
  ) {
    const remote = `${socket.remoteAddress}:${socket.remotePort}`;
    this.logger.log(`BAP client connected ${remote}`);

    socket.on("data", (chunk) => this.onData(chunk));
    socket.on("error", (err) => {
      this.logger.warn(`BAP socket error ${remote}: ${err.message}`);
    });
    socket.on("close", () => {
      this.closed = true;
      this.logger.log(`BAP client disconnected ${remote}`);
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
        `BAP frame error: ${error instanceof Error ? error.message : String(error)}`
      );
      this.socket.destroy();
    }
  }

  private handleMessage(message: RawBapMessage): void {
    this.logger.log(
      `BAP ← ${bapMessageTypeName(message.msgType)} seq=${message.sequence} ` +
        `body=${message.body.length}b`
    );

    switch (message.msgType) {
      case BapMessageType.ClientToBapChannelStartupRequest:
        this.handleChannelStartup(message);
        break;
      case BapMessageType.ClientToBapSecureHelloRequest:
        this.handleSecureHello(message);
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
        this.handleWorldServerRequest(message);
        break;
      case BapMessageType.ClientToBapSubscriptionRequest:
        this.handleSubscriptionRequest(message);
        break;
      case BapMessageType.ClientToBapClientConfigRequest:
        this.handleClientConfig(message);
        break;
      case BapMessageType.ClientToBapAccountIdTranslationPlatformToInvestmentRequest:
        this.handleAccountIdTranslation(message);
        break;
      case BapMessageType.ClientToBapGetActivityHostProxyRequest:
        this.handleGetActivityHostProxy(message);
        break;
      case BapMessageType.ClientToXetrovNotification:
        this.logger.log(
          `BAP xetrov not absorbed (seq ${message.sequence.toString(16)}, ` +
            `${message.body.length}B, no rsp)`
        );
        break;
      case BapMessageType.BapToClientActivityNotification:
        this.handleRelayedActivityNotification(message);
        break;
      default:
        this.logger.warn(
          `BAP unhandled message type 0x${message.msgType.toString(16)}`
        );
        break;
    }
  }

  private handleWorldServerRequest(message: RawBapMessage): void {
    const networkId =
      message.body.length >= 2 ? message.body.readUInt16BE(0) : -1;
    const reqPlain = Buffer.alloc(6 + message.body.length);
    reqPlain.writeUInt16BE(message.msgType, 0);
    reqPlain.writeUInt32BE(message.sequence >>> 0, 2);
    message.body.copy(reqPlain, 6);

    if (
      networkId ===
      e_server_message_network_id._server_message_network_id_login_account
    ) {
      const body = buildLoginAccountResponseBody(reqPlain);
      this.send({
        msgType: BapMessageType.ClientToWorldServerResponse,
        sequence: message.sequence,
        body,
      });
      this.logger.log(
        `BAP login_account rsp (seq ${message.sequence.toString(16)}, ` +
          `body ${body.length}B)`
      );
      return;
    }

    if (
      networkId ===
      e_server_message_network_id._server_message_network_id_fetch_family
    ) {
      try {
        const req = parseFetchFamilyRequest(reqPlain);
        const baseline = req
          ? buildBaselineForFamily(req.familyType, req.rootSoid)
          : null;
        const body = buildFetchFamilyResponseBody(0, baseline?.body ?? null);
        this.send({
          msgType: BapMessageType.ClientToWorldServerResponse,
          sequence: message.sequence,
          body,
        });
        this.logger.log(
          `BAP fetch_family rsp (seq ${message.sequence.toString(16)}, ` +
            "status=0, " +
            `req=${req ? `family ${req.familyType} root 0x${req.rootSoid.toString(16)}` : "unparsed"}, ` +
            `${baseline ? `${baseline.label} baseline ${baseline.body.length}B` : "no baseline"}, ` +
            `body ${body.length}B)`
        );
      } catch (err) {
        const m = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `BAP fetch_family rsp FAILED, absorbed to keep connection alive: ${m}`
        );
      }
      return;
    }

    if (
      networkId ===
      e_server_message_network_id._server_message_network_id_director_enter_orbit
    ) {
      try {
        const body = buildDirectorEnterOrbitResponseBody();
        this.send({
          msgType: BapMessageType.ClientToWorldServerResponse,
          sequence: message.sequence,
          body,
        });
        this.logger.log(
          `BAP director_enter_orbit ack (seq ${message.sequence.toString(16)}, ` +
            `body ${body.length}B)`
        );
      } catch (err) {
        const m = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `BAP director_enter_orbit ack FAILED, absorbed to keep connection alive: ${m}`
        );
      }
      return;
    }

    if (
      networkId ===
      e_server_message_network_id._server_message_network_id_profile_set_account_profile
    ) {
      try {
        const body = buildProfileSetAccountProfileResponseBody();
        this.send({
          msgType: BapMessageType.ClientToWorldServerResponse,
          sequence: message.sequence,
          body,
        });
        this.logger.log(
          `BAP profile_set_account_profile ack (seq ${message.sequence.toString(16)}, ` +
            `body ${body.length}B)`
        );
      } catch (err) {
        const m = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `BAP profile_set_account_profile ack FAILED, absorbed to keep connection alive: ${m}`
        );
      }
      return;
    }

    if (
      networkId ===
      e_server_message_network_id._server_message_network_id_profile_set_character_profile
    ) {
      try {
        const body = buildProfileSetCharacterProfileResponseBody();
        this.send({
          msgType: BapMessageType.ClientToWorldServerResponse,
          sequence: message.sequence,
          body,
        });
        this.logger.log(
          `BAP profile_set_character_profile ack (seq ${message.sequence.toString(16)}, ` +
            `body ${body.length}B)`
        );
      } catch (err) {
        const m = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `BAP profile_set_character_profile ack FAILED, absorbed to keep connection alive: ${m}`
        );
      }
      return;
    }

    this.logger.warn(
      `BAP world-server req network-id=${networkId} (${message.body.length}B) — ` +
        "no handler yet; sending status-only type-11"
    );
    this.handleStatusOnlyReply(
      message,
      BapMessageType.ClientToWorldServerResponse,
      `world-server network-id ${networkId}`
    );
  }

  private handleGetActivityHostProxy(message: RawBapMessage): void {
    try {
      const activityHostId = parseGetActivityHostProxyRequest(message.body);
      if (activityHostId === null) {
        this.logger.warn(
          `BAP get_activity_host_proxy absorbed (short body ${message.body.length}B)`
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
      this.logger.log(
        `BAP get_activity_host_proxy rsp (seq ${message.sequence.toString(16)}, ` +
          `ah=0x${activityHostId.toString(16)} → ` +
          `${ACTIVITY_HOST_PROXY_IP}:${ACTIVITY_HOST_PROXY_PORT}, body ${body.length}B)`
      );
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `BAP get_activity_host_proxy rsp FAILED, absorbed: ${m}`
      );
    }
  }

  private handleClientConfig(message: RawBapMessage): void {
    try {
      const body = buildClientConfigResponseBody(1n, 0);
      this.send({
        msgType: BapMessageType.ClientToBapClientConfigResponse,
        sequence: message.sequence,
        body,
      });
      this.logger.log(
        `BAP client_config rsp (seq ${message.sequence.toString(16)}, ` +
          `cookie=1 social_mm=0, body ${body.length}B)`
      );
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      this.logger.warn(`BAP client_config rsp FAILED, absorbed: ${m}`);
    }
  }

  private handleAccountIdTranslation(message: RawBapMessage): void {
    try {
      const body = message.body;
      if (body.length < 4) {
        this.logger.warn(
          `BAP acct-id xlate absorbed (short body ${body.length}B)`
        );
        return;
      }
      const platformIds = parseAccountIdTranslateRequest(body);
      const n = platformIds.length;
      const rsp = buildAccountIdTranslateResponse(
        platformIds,
        LOCAL_INVESTMENT_ACCOUNT_SOID
      );

      this.send({
        msgType:
          BapMessageType.ClientToBapAccountIdTranslationPlatformToInvestmentResponse,
        sequence: message.sequence,
        body: rsp,
      });
      this.logger.log(
        `BAP acct-id xlate rsp (seq ${message.sequence.toString(16)}, ` +
          `${n} id(s) → 0x${LOCAL_INVESTMENT_ACCOUNT_SOID.toString(16)}, body ${rsp.length}B)`
      );
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      this.logger.warn(`BAP acct-id xlate rsp FAILED, absorbed: ${m}`);
    }
  }

  private handleSubscriptionRequest(message: RawBapMessage): void {
    const sub = parseSubscribeRequest(message.body);
    const subAckRoot =
      message.body.length >= 9
        ? Buffer.from(message.body.subarray(1, 9))
        : Buffer.alloc(8);

    const pushes: { body: Buffer; label: string }[] = [];
    if (sub?.familyType === e_queuez_family_type._queuez_family_type_self) {
      const accountSoid = LOCAL_INVESTMENT_ACCOUNT_SOID;
      pushes.push({
        body: buildSelfBaselineBody(
          accountSoid,
          accountSoid,
          1,
          undefined,
          SIGNED_IN_CHARACTER_SOID
        ),
        label: "self",
      });
      pushes.push({
        body: buildSelectCharacterBaselineBody(
          accountSoid,
          accountSoid,
          1,
          undefined,
          [SIGNED_IN_CHARACTER_SOID]
        ),
        label: "select_character",
      });
    } else if (
      sub?.familyType ===
      e_queuez_family_type._queuez_family_type_select_character
    ) {
      const accountSoid = LOCAL_INVESTMENT_ACCOUNT_SOID;
      pushes.push({
        body: buildSelectCharacterBaselineBody(
          accountSoid,
          accountSoid,
          1,
          undefined,
          [SIGNED_IN_CHARACTER_SOID]
        ),
        label: "select_character",
      });
    } else if (sub) {
      const root =
        sub.familyType === e_queuez_family_type._queuez_family_type_universe
          ? sub.rootSoid || UNIVERSE_ROOT_SOID
          : sub.rootSoid || LOCAL_INVESTMENT_ACCOUNT_SOID;
      const baseline = buildBaselineForFamily(sub.familyType, root);
      if (baseline) {
        pushes.push(baseline);
      }
    }

    // Encrypt/send baselines first, then wire-13 ACK (GCM IV order).
    const pushParts: string[] = [];
    for (const p of pushes) {
      const seq = this.pushSeq++ >>> 0;
      this.send({
        msgType: BapMessageType.QueuezToClientUpdateNotification,
        sequence: seq,
        body: p.body,
      });
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
    this.logger.log(
      `BAP sub rsp (seq ${message.sequence.toString(16)}, ${familyInfo}` +
        `${pushParts.length ? `; pushed ${pushParts.join("; ")}` : "; FIFO ack only"})`
    );
  }

  /**
   * FAH type 100 is dest PRIMARY. The client relays that inner body
   * here as wire 9; we push the same bytes back so investment delivers
   * the join result.
   */
  private handleRelayedActivityNotification(message: RawBapMessage): void {
    const parsed = parseActivityHostToClientNotification(message.body);
    if (!parsed || parsed.variant !== ACTIVITY_HOST_NOTIFICATION_VARIANT) {
      this.logger.warn(
        `BAP b->c not ignored (variant ${message.body[0] ?? -1}, ` +
          `${message.body.length}B)`
      );
      return;
    }

    const seq = this.pushSeq++ >>> 0;
    this.send({
      msgType: BapMessageType.BapToClientActivityNotification,
      sequence: seq,
      body: message.body,
    });
    this.logger.log(
      `BAP b->c not echo (seq ${seq.toString(16)}, ` +
        `ah=0x${parsed.sessionId.toString(16)} class=${parsed.kind} ` +
        `payload ${parsed.payload.length}B)`
    );
  }

  /** Empty-body response (qz_reg / rrc / echo). */
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
      `BAP ${label} rsp (seq ${message.sequence.toString(16)}, req ${message.body.length}B)`
    );
  }

  private handleChannelStartup(message: RawBapMessage): void {
    // I think this is arbitrary, v4g uses this magic.
    const CHANNEL_MAGIC = Buffer.from("DESTINY\x01", "ascii");

    if (
      message.body.length < 8 ||
      !message.body.subarray(0, 8).equals(CHANNEL_MAGIC)
    ) {
      this.logger.warn(
        `BAP channel startup magic mismatch (${message.body.length} bytes)`
      );
    }

    const seed = crypto.randomBytes(120);
    const body = Buffer.concat([CHANNEL_MAGIC, seed]);
    this.send({
      msgType: BapMessageType.ClientToBapChannelStartupResponse,
      sequence: message.sequence,
      body,
    });
    this.logger.log("BAP channel startup complete");
  }

  /** Secure hello: wrap GCM key/IV in signon AES-CBC+HMAC, then enable codec GCM. */
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
    this.logger.log("BAP secure hello complete — GCM enabled");
  }

  private send(message: RawBapMessage): void {
    const frame = this.codec.encode(message);
    this.logger.log(
      `BAP → ${bapMessageTypeName(message.msgType)} seq=${message.sequence} ` +
        `frame=${frame.length}b`
    );
    this.socket.write(frame);
  }
}

function aes128CbcEncrypt(key: Buffer, iv: Buffer, data: Buffer): Buffer {
  const cipher = crypto.createCipheriv("aes-128-cbc", key, iv);
  return Buffer.concat([cipher.update(data), cipher.final()]);
}

function buildBaselineForFamily(
  familyType: number,
  rootSoid: bigint
): { body: Buffer; label: string } | null {
  switch (familyType) {
    case e_queuez_family_type._queuez_family_type_self:
      return {
        body: buildSelfBaselineBody(
          rootSoid,
          rootSoid,
          1,
          undefined,
          SIGNED_IN_CHARACTER_SOID
        ),
        label: "self",
      };
    case e_queuez_family_type._queuez_family_type_select_character:
      return {
        body: buildSelectCharacterBaselineBody(
          rootSoid,
          rootSoid,
          1,
          undefined,
          [SIGNED_IN_CHARACTER_SOID]
        ),
        label: "select_character",
      };
    case e_queuez_family_type._queuez_family_type_inspection:
      return {
        body: buildInspectionBaselineBody(
          rootSoid,
          rootSoid,
          1,
          INSPECTION_CHECKSUM_PRIMARY,
          SIGNED_IN_CHARACTER_SOID
        ),
        label: "inspection",
      };
    case e_queuez_family_type._queuez_family_type_peer:
      return {
        body: buildPeerBaselineBody(
          rootSoid,
          rootSoid,
          1,
          PEER_CHECKSUM_PRIMARY,
          SIGNED_IN_CHARACTER_SOID
        ),
        label: "peer",
      };
    case e_queuez_family_type._queuez_family_type_roster:
      return {
        body: buildRosterBaselineBody(rootSoid, rootSoid),
        label: "roster",
      };
    case e_queuez_family_type._queuez_family_type_universe:
      return {
        body: buildUniverseBaselineBody(rootSoid, rootSoid),
        label: "universe",
      };
    default:
      return null;
  }
}
