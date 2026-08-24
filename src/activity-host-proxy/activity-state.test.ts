import { BitReader, decode } from "@blamnetwork/rsat";
import { describe, expect, it } from "vitest";
import {
  buildGlobalActivityStateRsat,
  buildReplicateMembershipRsat,
  buildWorldGlobalsStateRsat,
  parseGlobalActivityState,
  parseReplicateMembership,
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

  it("encodes Option<808044E0> membership as local-only slot 0", () => {
    const identity = {
      machine: Buffer.from("7c1e52a389ce", "hex"),
      player: Buffer.from("7081b90432aa3b8a", "hex"),
      account: 1n,
      character: 0x200000002n,
    };
    const payload = buildReplicateMembershipRsat(identity);
    const br = new BitReader(payload);
    expect(br.readBit()).toBe(1);

    const parsed = parseReplicateMembership(payload);
    expect(parsed).not.toBeNull();
    expect(parsed?.generation).toBe(1);
    expect(parsed?.unk).toBe(1);
    expect(parsed?.occupiedMask).toBe(1);
    expect(parsed?.machineMask).toBe(1);
    expect(parsed?.unkMask).toBeUndefined();
    expect(parsed?.replicateMask).toBe(0);
    expect(parsed?.pahRegions).toBeUndefined();
    expect(parsed?.clients.slots).toHaveLength(20);
    expect(parsed?.clients.slots[0]?.identity).toEqual(identity);
    expect(parsed?.clients.slots[0]?.auth).toBeUndefined();
    expect(parsed?.clients.slots[1]?.identity).toBeUndefined();
  });
});
