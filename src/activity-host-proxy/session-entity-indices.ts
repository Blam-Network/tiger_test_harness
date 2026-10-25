import { event_message } from "@blamnetwork/datamine";
import { ActivityHostMessageType } from "./messages";
import type { SessionContext } from "./session-context";

// The host's entity index mask, once per client.
export function pushEntityIndexGrant(
  session: SessionContext,
  sessionId: bigint
): void {
  const mask = session.activityHost.takeFirstEntityIndexGrant();
  if (!mask) {
    return;
  }
  session.pushAh(
    sessionId,
    ActivityHostMessageType.EntitySlotsAllocated,
    mask,
    `entity-index mask ${mask.length}B`
  );
}

// FreeEntityIndices (class 20).
export function handleFreeEntityIndices(
  session: SessionContext,
  sessionId: bigint,
  payload: Buffer
): void {
  session.activityHost.noteEntityIndicesFreed(payload);
  event_message(
    "activities:host: free_entity_indices absorbed session=0x%I64x mask=%dB",
    sessionId,
    payload.length
  );
}

// AllocateEntityIndices (class 19).
export function handleAllocateEntityIndices(
  session: SessionContext,
  sessionId: bigint,
  payload: Buffer
): void {
  const count = payload.length >= 4 ? payload.readUInt32BE(0) >>> 0 : 0;
  const { grant, granted, source } = session.hosts
    .host(session.kind)
    .takeAllocateEntityIndexGrant(count);
  session.pushAh(
    sessionId,
    ActivityHostMessageType.EntitySlotsAllocated,
    grant,
    `allocate-entity-indices count=${count} granted ${granted} via ${source} ` +
      `mask ${grant.length}B`
  );
}
