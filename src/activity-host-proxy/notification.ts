import { buildJoinResultRsat, parseJoinRequest } from "./join";
import { ActivityHostMessageType } from "./messages";
import { activityHostBuild } from "./versions";

export const ACTIVITY_HOST_NOTIFICATION_VARIANT = 1;

export interface ParsedActivityHostNotification {
  kind: number;
  payload: Buffer;
  sessionId: bigint;
  variant: number;
}

type Header = ReturnType<typeof clientToHost>;

function clientToHost() {
  return activityHostBuild().notificationHeader.clientToHost;
}

function hostToClient() {
  return activityHostBuild().notificationHeader.hostToClient;
}

function parseNotification(
  header: Header,
  body: Buffer
): ParsedActivityHostNotification | null {
  if (body.length < header.size) {
    return null;
  }

  const fields = header.read(body);
  const end = header.size + fields.length;
  if (end > body.length) {
    return null;
  }

  return {
    sessionId: fields.sessionId,
    variant: fields.variant,
    kind: fields.kind,
    payload: Buffer.from(body.subarray(header.size, end)),
  };
}

export function parseClientToActivityHostNotification(
  body: Buffer
): ParsedActivityHostNotification | null {
  return parseNotification(clientToHost(), body);
}

export function parseActivityHostToClientNotification(
  body: Buffer
): ParsedActivityHostNotification | null {
  return parseNotification(hostToClient(), body);
}

export function buildActivityHostToClientNotification(
  sessionId: bigint,
  kind: number,
  payload: Buffer
): Buffer {
  const header = hostToClient().write({
    variant: ACTIVITY_HOST_NOTIFICATION_VARIANT,
    sessionId,
    kind,
    length: payload.length,
  });
  return Buffer.concat([header, payload]);
}

export function buildJoinResultNotification(
  sessionId: bigint,
  joinRequestPayload: Buffer
): Buffer {
  return buildActivityHostToClientNotification(
    sessionId,
    ActivityHostMessageType.JoinResult,
    buildJoinResultRsat(joinRequestPayload)
  );
}

export function peekJoinRequest(payload: Buffer): {
  nonce: number;
  activityHostId: bigint;
  machine: Buffer;
  player: Buffer;
  account: bigint;
  character: bigint;
  identityUnknown4: bigint | undefined;
} | null {
  const parsed = parseJoinRequest(payload);
  if (!parsed) {
    return null;
  }
  return {
    nonce: parsed.nonce,
    activityHostId: parsed.sessionId,
    machine: parsed.machine,
    player: parsed.player,
    account: parsed.account,
    character: parsed.character,
    identityUnknown4: parsed.identityUnknown4,
  };
}
