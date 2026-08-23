import { decode } from "@blamnetwork/rsat";
import { describe, expect, it } from "vitest";
import {
  buildGlobalActivityStateRsat,
  buildWorldGlobalsStateRsat,
  parseGlobalActivityState,
  WorldGlobalsState,
} from "./rsat";

describe("activity state RSAT", () => {
  it("encodes GAS with valid/scenario set and draining clear", () => {
    const parsed = parseGlobalActivityState(buildGlobalActivityStateRsat(1n));
    expect(parsed.valid).toBe(true);
    expect(parsed.scenario).toBe(true);
    expect(parsed.draining).toBe(false);
    expect(parsed.instanceId).toBe(1n);
    expect(parsed.bubbleCount).toBe(1);
    expect(parsed.world.valid).toBe(true);
    expect(parsed.world.handles.handles).toEqual([]);
  });

  it("encodes WGS as valid 30 Hz ticks", () => {
    const parsed = decode(WorldGlobalsState, buildWorldGlobalsStateRsat());
    expect(parsed.valid).toBe(true);
    expect(parsed.tickDurationMs).toBeCloseTo(1000 / 30, 5);
  });
});
