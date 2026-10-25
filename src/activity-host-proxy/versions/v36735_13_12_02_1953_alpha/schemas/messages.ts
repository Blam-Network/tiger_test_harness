import { rsat } from "@blamnetwork/rsat";

export function defineMessageSchemas() {
  const BUBBLE_SLOTS = 64;

  const BubbleStates = rsat.schema(0x80800253, {
    states: rsat.repeat(rsat.i8({ size: 8, bias: 128 }), BUBBLE_SLOTS),
  });

  const ActivityName = rsat.schema(0x80800487, {
    chars: rsat.repeat(rsat.i8({ size: 8, bias: 128 }), 256),
  });

  const WorldHandles = rsat.schema(0x8080448c, {
    handles: rsat.array(rsat.u32(), { lengthBits: 6, max: 50 }),
  });

  const WorldOptions = rsat.schema(0x808044a9, {
    valid: rsat.bool(),
    handles: rsat.nested(WorldHandles),
    unk2: rsat.u32(),
    worldServerTime: rsat.u64(),
    activityId: rsat.i16({ size: 16, bias: 0x8000 }),
    activityName: rsat.nested(ActivityName),
  });

  const GlobalActivityState = rsat.schema(0x80804501, {
    valid: rsat.bool(),
    scenario: rsat.bool(),
    draining: rsat.bool(),
    instanceId: rsat.u64(),
    bubbleCount: rsat.i32(),
    bubbleStates: rsat.nested(BubbleStates),
    initialSlice: rsat.i32(),
    // FNV-1 name of the spawn point the initial slice-set transition uses;
    // "default" when there is no exact match.
    spawnTransitionName: rsat.u32(),
    activityChecksum: rsat.u32(),
    world: rsat.nested(WorldOptions),
  });

  const WorldGlobalsState = rsat.schema(0x80804502, {
    valid: rsat.bool(),
    tickDurationMs: rsat.f32(),
  });
  return {
    BUBBLE_SLOTS,
    BubbleStates,
    ActivityName,
    WorldHandles,
    WorldOptions,
    GlobalActivityState,
    WorldGlobalsState,
  };
}

export type MessageSchemas = ReturnType<typeof defineMessageSchemas>;
