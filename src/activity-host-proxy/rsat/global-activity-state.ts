import {
  GAS_SECONDS_PER_DAY,
  GAS_TIME_OF_DAY_FRACTION,
  GAS_UNKNOWN6,
  SPAWN_TRANSITION_DEFAULT,
  WORLD_GLOBALS_TICK_MS,
} from "../stubs/world-defaults";
import { activityHostBuild } from "../versions";
import { packBubbleStateHandle } from "./bubble-handle";

const BUBBLE_SLOTS = 64;

// Instantiation (ENUM 27) needs valid=1 and draining=0.

interface GlobalActivityStateFields {
  activityChecksum?: number;
  activityId?: number;
  activityName?: string;
  bubbleCount?: number;
  emptyBubbles?: readonly number[];
  initialBubble?: number;
  initialState?: number;
  instanceId: bigint;
  // Spawn point name hash; SPAWN_TRANSITION_DEFAULT when omitted.
  spawnTransitionName?: number;
  // World options: the activity's start in Unix seconds (constant per
  // instance, 2.3.1 capture). The client's time of day starts at
  // fmod(worldServerTime / secondsPerDay, 1) when its sun settings do not lock
  // it; a fixed daytime value stands when this is omitted. A build whose
  // client keeps a fixed time of day ignores it.
  worldServerTime?: bigint;
}

// The GAS body: its world options carry the activity, the time of day and a
// member sent -1.
export function buildGlobalActivityStateRsat(
  fields: bigint | GlobalActivityStateFields
): Buffer {
  const input = typeof fields === "bigint" ? { instanceId: fields } : fields;
  const bubbleCount = input.bubbleCount ?? 1;
  const empty = new Set(input.emptyBubbles ?? []);
  const states = Array.from({ length: BUBBLE_SLOTS }, (_, i) =>
    i < bubbleCount && !empty.has(i) ? 0 : -1
  );
  return activityHostBuild().globalActivityState.encodeGlobalActivityState({
    activityChecksum: input.activityChecksum ?? 0,
    activityId: input.activityId ?? 0,
    activityName: input.activityName,
    bubbleCount,
    bubbleStates: states,
    initialSlice: packBubbleStateHandle(
      input.initialBubble ?? 0,
      input.initialState ?? 0
    ),
    instanceId: input.instanceId,
    spawnTransitionName: input.spawnTransitionName ?? SPAWN_TRANSITION_DEFAULT,
    unknown6: GAS_UNKNOWN6,
    worldServerTime:
      input.worldServerTime ??
      BigInt(Math.floor(GAS_TIME_OF_DAY_FRACTION * GAS_SECONDS_PER_DAY)),
  });
}

export function buildWorldGlobalsStateRsat(): Buffer {
  return activityHostBuild().globalActivityState.encodeWorldGlobalsState(
    WORLD_GLOBALS_TICK_MS
  );
}
