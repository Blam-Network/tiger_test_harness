import { encode } from "@blamnetwork/rsat";
import type { GlobalActivityStateWire } from "../activity-host-build";
import type { AhSchemas } from "./ah";

// The activity name is 256 chars.
const ACTIVITY_NAME_CHARS = 256;

// The client's time of day starts at worldServerTime / 3600 (a day fraction),
// and the alpha's is always 10:00, so the instance's start time is not used.
const SECONDS_PER_DAY = 3600;
const TIME_OF_DAY_FRACTION = 10 / 24;

function activityNameChars(name: string | undefined): number[] {
  const chars = new Array(ACTIVITY_NAME_CHARS).fill(0);
  if (!name) {
    return chars;
  }
  for (let i = 0; i < name.length && i < ACTIVITY_NAME_CHARS; i++) {
    chars[i] = name.charCodeAt(i);
  }
  return chars;
}

export function createGlobalActivityStateWire(
  ah: AhSchemas
): GlobalActivityStateWire {
  return {
    encodeGlobalActivityState(fields) {
      return encode(ah.GlobalActivityState, {
        valid: true,
        scenario: true,
        draining: false,
        instanceId: fields.instanceId,
        bubbleCount: fields.bubbleCount,
        bubbleStates: { states: [...fields.bubbleStates] },
        initialSlice: fields.initialSlice,
        spawnTransitionName: fields.spawnTransitionName,
        activityChecksum: fields.activityChecksum,
        world: {
          valid: true,
          handles: { handles: [] },
          unk2: 0,
          worldServerTime: BigInt(
            Math.floor(TIME_OF_DAY_FRACTION * SECONDS_PER_DAY)
          ),
          activityId: fields.activityId,
          activityName: { chars: activityNameChars(fields.activityName) },
        },
      });
    },

    encodeWorldGlobalsState(tickMs) {
      return encode(ah.WorldGlobalsState, {
        valid: true,
        tickDurationMs: tickMs,
      });
    },
  };
}
