import { rsat } from "@blamnetwork/rsat";

export const BUBBLE_SLOTS = 64;

export const BubbleStates = rsat.schema(0x80800253, {
  states: rsat.repeat(rsat.i8({ size: 8, bias: 128 }), BUBBLE_SLOTS),
});

export const ActivityName = rsat.schema(0x80800487, {
  chars: rsat.repeat(rsat.i8({ size: 8, bias: 128 }), 256),
});

export const WorldHandles = rsat.schema(0x8080448c, {
  handles: rsat.array(rsat.u32(), { lengthBits: 6, max: 50 }),
});

export const WorldOptions = rsat.schema(0x808044a9, {
  valid: rsat.bool(),
  handles: rsat.nested(WorldHandles),
  unk2: rsat.u32(),
  worldServerTime: rsat.u64(),
  activityId: rsat.i16({ size: 16, bias: 0x8000 }),
  activityName: rsat.nested(ActivityName),
});

export const GlobalActivityState = rsat.schema(0x80804501, {
  valid: rsat.bool(),
  scenario: rsat.bool(),
  draining: rsat.bool(),
  instanceId: rsat.u64(),
  bubbleCount: rsat.i32(),
  bubbleStates: rsat.nested(BubbleStates),
  initialSlice: rsat.i32(),
  familyChecksum: rsat.u32(),
  activityChecksum: rsat.u32(),
  world: rsat.nested(WorldOptions),
});

export const WorldGlobalsState = rsat.schema(0x80804502, {
  valid: rsat.bool(),
  tickDurationMs: rsat.f32(),
});
