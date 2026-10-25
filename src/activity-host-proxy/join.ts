import { formatActivityHostTag } from "./config";
import {
  JOIN_KEEPALIVE_INTERVAL_MS,
  JOIN_RECENT_WINDOW_MS,
  JOIN_REPLICATION_EPOCH,
} from "./stubs/world-defaults";
import { activityHostBuild } from "./versions";

export interface AhClientIdentity {
  account: bigint;
  character: bigint;
  // JoinIdentity member 4, echoed back in the membership slot (a build whose
  // identity lacks it leaves this out).
  identityUnknown4?: bigint;
  machine: Buffer;
  player: Buffer;
}

export interface ParsedJoinRequest extends AhClientIdentity {
  nonce: number;
  sessionId: bigint;
}

export function parseJoinRequest(payload: Buffer): ParsedJoinRequest | null {
  try {
    return activityHostBuild().join.decodeRequest(payload);
  } catch {
    return null;
  }
}

// A join request with an empty auth block (tests and tools; the client
// sends its own).
export function encodeJoinRequest(fields: ParsedJoinRequest): Buffer {
  return activityHostBuild().join.encodeRequest(fields);
}

// Class 4: the join result, echoing the class 3 join request. A build whose
// result carries the two canned timings (world defaults) states them.
export function buildJoinResultRsat(joinRequestPayload: Buffer): Buffer {
  return activityHostBuild().join.encodeResult(joinRequestPayload, {
    keepaliveIntervalMs: JOIN_KEEPALIVE_INTERVAL_MS,
    recentWindowMs: JOIN_RECENT_WINDOW_MS,
    replicationEpoch: JOIN_REPLICATION_EPOCH,
    sessionDisplay: formatActivityHostTag,
  });
}
