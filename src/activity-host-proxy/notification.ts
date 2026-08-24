import { c } from "@craftycodie/cstruct";
import { buildJoinResultRsat, parseJoinRequest } from "./join";
import { ActivityHostMessageType } from "./messages";

/**
 * Matches the 222-byte join we got after manager startup
 */
const ClientToActivityHostNotificationHeader = c.struct({
  sessionId: c.u64(),
  variant: c.u8(),
  kind: c.u32(),
  length: c.u32(),
});

// see sub_82B7C828
const ActivityHostToClientNotificationHeader = c.struct({
  variant: c.u8(),
  sessionId: c.u64(),
  kind: c.u32(),
  length: c.u32(),
});

export const ACTIVITY_HOST_NOTIFICATION_VARIANT = 1;

export interface ParsedActivityHostNotification {
  kind: number;
  payload: Buffer;
  sessionId: bigint;
  variant: number;
}

export function parseClientToActivityHostNotification(
  body: Buffer
): ParsedActivityHostNotification | null {
  const headerSize = c.sizeof(ClientToActivityHostNotificationHeader);
  if (body.length < headerSize) {
    return null;
  }

  const header = c.read(ClientToActivityHostNotificationHeader, body, "big");
  const end = headerSize + header.length;
  if (end > body.length) {
    return null;
  }

  return {
    sessionId: header.sessionId,
    variant: header.variant,
    kind: header.kind,
    payload: Buffer.from(body.subarray(headerSize, end)),
  };
}

export function parseActivityHostToClientNotification(
  body: Buffer
): ParsedActivityHostNotification | null {
  const headerSize = c.sizeof(ActivityHostToClientNotificationHeader);
  if (body.length < headerSize) {
    return null;
  }

  const header = c.read(ActivityHostToClientNotificationHeader, body, "big");
  const end = headerSize + header.length;
  if (end > body.length) {
    return null;
  }

  return {
    sessionId: header.sessionId,
    variant: header.variant,
    kind: header.kind,
    payload: Buffer.from(body.subarray(headerSize, end)),
  };
}

export function buildActivityHostToClientNotification(
  sessionId: bigint,
  kind: number,
  payload: Buffer
): Buffer {
  const header = c.write(
    ActivityHostToClientNotificationHeader,
    {
      variant: ACTIVITY_HOST_NOTIFICATION_VARIANT,
      sessionId,
      kind,
      length: payload.length,
    },
    "big"
  );
  return Buffer.concat([header, payload]);
}

export function buildJoinResultPayload(joinRequestPayload: Buffer): Buffer {
  return buildJoinResultRsat(joinRequestPayload);
}

export function buildJoinResultNotification(
  sessionId: bigint,
  joinRequestPayload: Buffer
): Buffer {
  return buildActivityHostToClientNotification(
    sessionId,
    ActivityHostMessageType.JoinResult,
    buildJoinResultPayload(joinRequestPayload)
  );
}

export function peekJoinRequest(payload: Buffer): {
  nonce: number;
  activityHostId: bigint;
  machine: Buffer;
  player: Buffer;
  account: bigint;
  character: bigint;
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
  };
}
