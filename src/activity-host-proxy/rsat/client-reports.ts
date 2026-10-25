import type { ClientAuthReport } from "../versions";
import { activityHostBuild } from "../versions";

export type {
  ClientAuthReport,
  ClientHardWipe,
  ClientTeleport,
  ClientTransition,
  ClientTransitionRegion,
} from "../versions";

// Class 17 activity_client_request_state_refresh, 8 bytes: the membership
// number the client is on (the MEM-%d of its log lines), then the world's
// current bubble handle: 0x80000000 | bubble, or 0x7fffffff when the client is
// not in a bubble. Before the world transition the handle is the orbit world's
// (bubble 1), so a valid bubble is not proof of being in the activity; compare
// against the previous refresh instead.
export interface StateRefresh {
  bubble: number | undefined;
  membership: number;
}

// Class 21 client_authoritative_data_update, with the transition (current and
// pending regions, token, phase) and teleportation reduced to what the host
// works with, and the members a build echoes back in the membership slot.
// Returns undefined when the delta does not decode.
export function parseClientAuthoritativeData(
  payload: Buffer
): ClientAuthReport | undefined {
  return activityHostBuild().clientReports.parse(payload);
}

export function parseStateRefresh(payload: Buffer): StateRefresh | undefined {
  if (payload.length < 8) {
    return;
  }
  const handle = payload.readUInt32BE(4);
  return {
    membership: payload.readUInt32BE(0),
    bubble: handle >>> 31 ? handle & 0x7fffffff : undefined,
  };
}
