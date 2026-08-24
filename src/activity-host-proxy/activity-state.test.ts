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

  it("marks Venus empty bubbles inaccessible in GAS", () => {
    const parsed = parseGlobalActivityState(
      buildGlobalActivityStateRsat({
        instanceId: 1n,
        bubbleCount: 30,
        emptyBubbles: [11, 15, 20, 22],
      })
    );
    expect(parsed.bubbleCount).toBe(30);
    expect(parsed.bubbleStates.states[0]).toBe(0);
    expect(parsed.bubbleStates.states[11]).toBe(-1);
    expect(parsed.bubbleStates.states[15]).toBe(-1);
    expect(parsed.bubbleStates.states[20]).toBe(-1);
    expect(parsed.bubbleStates.states[22]).toBe(-1);
    expect(parsed.bubbleStates.states[16]).toBe(0);
    expect(parsed.bubbleStates.states[30]).toBe(-1);
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
    expect(parsed?.clients.slots).toHaveLength(20);
    expect(parsed?.clients.slots[0]?.identity).toEqual(identity);
    expect(parsed?.clients.slots[0]?.auth).toBeUndefined();
    expect(parsed?.clients.slots[1]?.identity).toBeUndefined();

    const rows = parsed?.pahRegions?.table.rows;
    expect(rows).toHaveLength(40);
    expect(rows?.[0]?.regionId).toBe(0);
    expect(rows?.[0]?.peerMask).toBe(1);
    expect(rows?.[0]?.public.peerSlots.markers[0]).toBe(1);
    expect(rows?.[0]?.ambassador.opcode).toBe(1);
    expect(rows?.[7]?.public.peerSlots.markers[0]).toBe(8);
    expect(rows?.[8]?.regionId).toBe(-1);
  });

  it("covers each bubble × tokens 1..8 in the PAH table", () => {
    const identity = {
      machine: Buffer.from("7c1e52a389ce", "hex"),
      player: Buffer.from("7081b90432aa3b8a", "hex"),
      account: 1n,
      character: 0x200000002n,
    };
    const parsed = parseReplicateMembership(
      buildReplicateMembershipRsat(identity, { bubbleCount: 5, generation: 2 })
    );
    expect(parsed?.generation).toBe(2);
    const rows = parsed?.pahRegions?.table.rows ?? [];
    expect(rows[0]?.regionId).toBe(0);
    expect(rows[8]?.regionId).toBe(1 << 3);
    expect(rows[39]?.regionId).toBe(4 << 3);
    expect(rows[39]?.public.peerSlots.markers[0]).toBe(8);
  });
});
