import { encode } from "@blamnetwork/rsat";
import type { GlobalActivityStateWire } from "../activity-host-build";
import type { AhSchemas } from "./ah";

// 80800CC5 member 7: 40 chars.
const ACTIVITY_NAME_CHARS = 40;

function activityNameChars(name: string | undefined): number[] {
  const chars = new Array(ACTIVITY_NAME_CHARS).fill(0);
  if (!name) {
    return chars;
  }
  for (let i = 0; i < name.length && i < ACTIVITY_NAME_CHARS - 1; i++) {
    chars[i] = name.charCodeAt(i);
  }
  return chars;
}

// 80800E76 {80800B8F}: the GAS body, whose world options 80800CC5 have a
// bool after unk2 and an i16 after the activity id (sent false / -1).
export function createGlobalActivityStateWire(
  ah: AhSchemas
): GlobalActivityStateWire {
  return {
    encodeGlobalActivityState(fields) {
      return encode(ah.GlobalActivityState, {
        state: {
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
            unknown3: false,
            worldServerTime: fields.worldServerTime,
            activityId: fields.activityId,
            unknown6: fields.unknown6,
            activityName: {
              text: { chars: activityNameChars(fields.activityName) },
            },
          },
        },
      });
    },

    encodeWorldGlobalsState(tickMs) {
      return encode(ah.WorldGlobalsState, {
        unknown0: { unknown0: true, unknown1: tickMs },
      });
    },
  };
}
