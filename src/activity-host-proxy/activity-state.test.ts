import { BitReader, BitWriter, decode } from "@blamnetwork/rsat";
import { describe, expect, it } from "vitest";
import {
  buildGlobalActivityStateRsat,
  buildReplicateMembershipRsat,
  buildWorldGlobalsStateRsat,
  packBubbleStateHandle,
  parseClientAuthoritativeData,
  parseStateRefresh,
} from "./rsat";
import { activityHostBuild } from "./versions";
import { liveAh } from "./versions/v41375_14_07_03_1501_live/live-ah";

type LiveAuth = ReturnType<
  ReturnType<typeof liveAh>["ClientAuthoritativeData"]["decode"]
>;

const parseGlobalActivityState = (payload: Buffer) =>
  decode(liveAh().GlobalActivityState, payload).state;
const parseReplicateMembership = (payload: Buffer) =>
  activityHostBuild().membership.decode(payload);
const parseClientIdentity = (payload: Buffer) =>
  parseClientAuthoritativeData(payload)?.echo?.identity as
    | LiveAuth["identity"]
    | undefined;

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
    expect(parsed.world.worldServerTime).toBe(1500n);
  });

  // The world server time is the activity's start in Unix seconds (2.3.1
  // capture of act_cosmo_m0_highway: the same value in every GAS of the run).
  it("carries the instance's start as the world server time when given", () => {
    const parsed = parseGlobalActivityState(
      buildGlobalActivityStateRsat({
        instanceId: 1n,
        worldServerTime: 1_790_780_594n,
      })
    );
    expect(parsed.world.worldServerTime).toBe(1_790_780_594n);
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
    const parsed = decode(
      liveAh().WorldGlobalsState,
      buildWorldGlobalsStateRsat()
    );
    expect(parsed.unknown0.unknown0).toBe(true);
    expect(parsed.unknown0.unknown1).toBeCloseTo(1000 / 30, 5);
  });

  it("encodes Option<808044E0> membership as local-only slot 0", () => {
    const identity = {
      machine: Buffer.from("7c1e52a389ce0000", "hex"),
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
    expect(parsed?.unknownMask).toBe(0);
    expect(parsed?.clients.slots).toHaveLength(20);
    expect(parsed?.clients.slots[0]?.identity).toEqual(identity);
    expect(parsed?.clients.slots[0]?.auth).toBeUndefined();
    expect(parsed?.clients.slots[1]?.identity).toBeUndefined();

    const rows = parsed?.pahRegions?.table.rows;
    expect(rows).toHaveLength(40);
    // One row for the region, no pending transition yet: the guest matches
    // row.markers[localSlot] against its own token, so the rows follow what
    // it reports rather than guessing tokens up front.
    expect(rows?.[0]?.regionId).toBe(0);
    expect(rows?.[0]?.ambassador.opcode).toBe(1);
    expect(rows?.[1]?.regionId).toBe(-1);
  });

  // 80800C93: the host's hard wipe, {cookie, state, an i32 the client never
  // reads}; idle zeros when none is given.
  it("lays the host's hard wipe out as cookie and state", () => {
    const identity = {
      machine: Buffer.from("7c1e52a389ce0000", "hex"),
      player: Buffer.from("7081b90432aa3b8a", "hex"),
      account: 1n,
      character: 0x200000002n,
    };
    const nest = (hardWipe?: { cookie: number; state: number }) => {
      const br = new BitReader(
        buildReplicateMembershipRsat(identity, { hardWipe })
      );
      br.readBit();
      return liveAh().ReplicateMembership.decode(br).pahRegions?.unknown1;
    };
    expect(nest()).toEqual({ unknown0: 0, unknown1: 0, unknown2: 0 });
    for (const state of [0, 1, 2, 3, 4]) {
      expect(nest({ cookie: 255, state })).toEqual({
        unknown0: 255,
        unknown1: state,
        unknown2: 0,
      });
    }
  });

  it("parses class-17 as membership number + current bubble handle", () => {
    // Pre-world FAH, loading, in-world bubble 16.
    expect(parseStateRefresh(Buffer.from("0000000080000001", "hex"))).toEqual({
      membership: 0,
      bubble: 1,
    });
    expect(parseStateRefresh(Buffer.from("000000047fffffff", "hex"))).toEqual({
      membership: 4,
      bubble: undefined,
    });
    expect(parseStateRefresh(Buffer.from("0000000780000010", "hex"))).toEqual({
      membership: 7,
      bubble: 16,
    });
    expect(parseStateRefresh(Buffer.alloc(4))).toBeUndefined();
  });

  // 80800C21 is the client's hard wipe: state, current cookie, start time.
  // Unlike the alpha's it has no last cookie.
  it("reads the client's hard wipe without a last cookie", () => {
    const bw = new BitWriter();
    bw.writeBit(1);
    liveAh().ClientAuthoritativeData.encode(bw, {
      hardWipe: { unknown0: 2, unknown1: 9, unknown2: 4321 },
      identity: undefined,
      teleport: undefined,
      transition: undefined,
    });
    const report = parseClientAuthoritativeData(bw.finish());
    expect(report?.hardWipe).toEqual({
      currentCookie: 9,
      startTime: 4321,
      state: 2,
    });
    expect(report?.hardWipe).not.toHaveProperty("lastCookie");
  });

  it("emits one PAH row for the start bubble", () => {
    const identity = {
      machine: Buffer.from("7c1e52a389ce0000", "hex"),
      player: Buffer.from("7081b90432aa3b8a", "hex"),
      account: 1n,
      character: 0x200000002n,
    };
    const parsed = parseReplicateMembership(
      buildReplicateMembershipRsat(identity, {
        bubbleCount: 5,
        generation: 2,
        initialBubble: 3,
      })
    );
    expect(parsed?.generation).toBe(2);
    const rows = parsed?.pahRegions?.table.rows ?? [];
    expect(rows[0]?.regionId).toBe(packBubbleStateHandle(3));
    expect(rows[1]?.regionId).toBe(-1);
  });

  it("still emits the pending row when the current bubble is out of range", () => {
    // This activity has one bubble, and the pre-world state refresh reports
    // bubble 1. Blanking the whole table for an out-of-range current bubble
    // would leave the client with no row for the region it is asking to cross
    // into.
    const identity = {
      machine: Buffer.from("7c1e52a389ce0000", "hex"),
      player: Buffer.from("7081b90432aa3b8a", "hex"),
      account: 1n,
      character: 0x200000002n,
    };
    const parsed = parseReplicateMembership(
      buildReplicateMembershipRsat(identity, {
        bubbleCount: 1,
        generation: 1,
        initialBubble: 1,
        pendingRegion: { regionId: 0, token: 1 },
      })
    );
    const rows = parsed?.pahRegions?.table.rows ?? [];
    expect(rows[0]?.regionId).toBe(0);
    expect(rows[0]?.public.peerSlots.markers[0]).toBe(1);
    expect(rows[0]?.ambassador.opcode).toBe(1);
    expect(rows[1]?.regionId).toBe(-1);
  });

  it("puts only the Venus start bubble in the PAH table", () => {
    const identity = {
      machine: Buffer.from("7c1e52a389ce0000", "hex"),
      player: Buffer.from("7081b90432aa3b8a", "hex"),
      account: 1n,
      character: 0x200000002n,
    };
    const parsed = parseReplicateMembership(
      buildReplicateMembershipRsat(identity, {
        bubbleCount: 0x1e,
        emptyBubbles: [11, 15, 20, 22],
        generation: 1,
        initialBubble: 16,
      })
    );
    const rows = parsed?.pahRegions?.table.rows ?? [];
    expect(rows[0]?.regionId).toBe(packBubbleStateHandle(16));
    expect(rows[0]?.ambassador.opcode).toBe(1);
    expect(rows[1]?.regionId).toBe(-1);
    expect(rows[0]?.public.activityHostId).toBe(0n);
    // Poisoned slice=0 must not be able to hide PUB128 when caller pins 16.
    const poisoned = parseReplicateMembership(
      buildReplicateMembershipRsat(identity, {
        bubbleCount: 0x1e,
        generation: 2,
        initialBubble: 0,
      })
    );
    const poisonedRows = poisoned?.pahRegions?.table.rows ?? [];
    expect(
      poisonedRows.some((r) => r.regionId === packBubbleStateHandle(16))
    ).toBe(false);
    expect(poisonedRows[0]?.regionId).toBe(0);
  });

  it("puts a second joined console in its own slot with both mask bits set", () => {
    const host = {
      machine: Buffer.from("7c1e52a389ce0000", "hex"),
      player: Buffer.from("7081b90432aa3b8a", "hex"),
      account: 1n,
      character: 0x200000002n,
    };
    const guest = {
      machine: Buffer.from("7ced8da3e1080000", "hex"),
      player: Buffer.from("aabbccddeeff0011", "hex"),
      account: 2n,
      character: 0x300000003n,
    };
    const parsed = parseReplicateMembership(
      buildReplicateMembershipRsat(
        [
          { identity: host, pendingRegion: undefined, slot: 0 },
          { identity: guest, pendingRegion: undefined, slot: 1 },
        ],
        { generation: 1 }
      )
    );
    expect(parsed?.occupiedMask).toBe(0b11);
    expect(parsed?.machineMask).toBe(0b11);
    expect(parsed?.clients.slots[0]?.identity).toEqual(host);
    expect(parsed?.clients.slots[1]?.identity).toEqual(guest);
    expect(parsed?.clients.slots[2]?.identity).toBeUndefined();
  });

  it("gives each peer its own marker on a shared pending row", () => {
    // Each client counts its own transition token independently, so one PAH
    // row legitimately carries different marker bytes per slot.
    const host = {
      machine: Buffer.from("7c1e52a389ce0000", "hex"),
      player: Buffer.from("7081b90432aa3b8a", "hex"),
      account: 1n,
      character: 0x200000002n,
    };
    const guest = {
      machine: Buffer.from("7ced8da3e1080000", "hex"),
      player: Buffer.from("aabbccddeeff0011", "hex"),
      account: 2n,
      character: 0x300000003n,
    };
    const parsed = parseReplicateMembership(
      buildReplicateMembershipRsat(
        [
          { identity: host, pendingRegion: { regionId: 0, token: 3 }, slot: 0 },
          {
            identity: guest,
            pendingRegion: { regionId: 0, token: 9 },
            slot: 1,
          },
        ],
        { bubbleCount: 1, generation: 1, initialBubble: 1 }
      )
    );
    const rows = parsed?.pahRegions?.table.rows ?? [];
    expect(rows[0]?.regionId).toBe(0);
    expect(rows[0]?.public.peerSlots.markers[0]).toBe(3);
    expect(rows[0]?.public.peerSlots.markers[1]).toBe(9);
    expect(rows[0]?.peerMask).toBe(0b11);
    expect(rows[1]?.regionId).toBe(-1);
  });

  // The region being entered needs a live ambassador. The revoke only exists
  // to make the guest spin up its GAH and never flips back, so mirroring it
  // onto a pending row makes the guest log "has no ambassador; avoiding the
  // citizen-join task for now" for the region it is crossing into.
  it("keeps a revoked ambassador off the region being entered", () => {
    const host = {
      machine: Buffer.from("7c1e52a389ce0000", "hex"),
      player: Buffer.from("7081b90432aa3b8a", "hex"),
      account: 1n,
      character: 0x200000002n,
    };
    const rowsFor = (pendingAmbassadorOpcode?: number) =>
      parseReplicateMembership(
        buildReplicateMembershipRsat(
          [
            {
              identity: host,
              pendingRegion: { regionId: 5, token: 1 },
              slot: 0,
            },
          ],
          {
            ambassadorOpcode: 2,
            ambassadorRevokeToken: 1,
            bubbleCount: 1,
            generation: 1,
            initialBubble: 1,
            pendingAmbassadorOpcode,
          }
        )
      )?.pahRegions?.table.rows ?? [];

    // Before the GAH is bound the pending row mirrors the policy, so the
    // revoke still reaches the guest and the host spins up.
    const mirrored = rowsFor();
    expect(mirrored[0]?.regionId).toBe(5);
    expect(mirrored[0]?.ambassador.opcode).toBe(2);
    expect(mirrored[0]?.ambassador.revokeToken).toBe(1);
    // Before the GAH exists the initial transition leaves matchmaking through
    // the REVOKE exit, so the threshold flag stays off.
    expect(mirrored[0]?.ambassador.flag).toBe(false);

    // Once it is bound the region being entered is advertised as assigned,
    // and names our own slot: a slot that is not ours sends the client to
    // join a peer that does not exist.
    const assigned = rowsFor(1);
    expect(assigned[0]?.regionId).toBe(5);
    expect(assigned[0]?.ambassador.opcode).toBe(1);
    expect(assigned[0]?.ambassador.revokeToken).toBe(0);
    expect(assigned[0]?.ambassador.slot).toBe(0);
    // ASSIGN closes the REVOKE exit out of the citizen-join task, and a solo
    // search never finishes on its own, so the row has to open the other one:
    // row+24.
    expect(assigned[0]?.ambassador.flag).toBe(true);
  });

  // A bubble handle packs as bubble << 3, so standing in bubble 10 and crossing
  // into bubble 10 produce the same regionId and the pending row IS the current
  // row. The ambassador override still applies to it, or the row keeps REVOKE
  // and the crossing is stranded.
  it("assigns the ambassador when the pending region is the current one", () => {
    const host = {
      machine: Buffer.from("7c1e52a389ce0000", "hex"),
      player: Buffer.from("7081b90432aa3b8a", "hex"),
      account: 1n,
      character: 0x200000002n,
    };
    const rows =
      parseReplicateMembership(
        buildReplicateMembershipRsat(
          [
            {
              identity: host,
              pendingRegion: { regionId: 80, token: 2 },
              slot: 0,
            },
          ],
          {
            ambassadorOpcode: 2,
            ambassadorRevokeToken: 1,
            bubbleCount: 30,
            generation: 1,
            // Bubble 10 with state 0 packs to region handle 80 - the same
            // handle the crossing above names.
            initialBubble: 10,
            initialState: 0,
            pendingAmbassadorOpcode: 1,
          }
        )
      )?.pahRegions?.table.rows ?? [];
    expect(rows[0]?.regionId).toBe(80);
    expect(rows[0]?.ambassador.opcode).toBe(1);
    expect(rows[0]?.ambassador.slot).toBe(0);
    expect(rows[1]?.regionId).toBe(-1);
  });

  it("gives peers crossing into different regions their own rows", () => {
    const host = {
      machine: Buffer.from("7c1e52a389ce0000", "hex"),
      player: Buffer.from("7081b90432aa3b8a", "hex"),
      account: 1n,
      character: 0x200000002n,
    };
    const guest = {
      machine: Buffer.from("7ced8da3e1080000", "hex"),
      player: Buffer.from("aabbccddeeff0011", "hex"),
      account: 2n,
      character: 0x300000003n,
    };
    const parsed = parseReplicateMembership(
      buildReplicateMembershipRsat(
        [
          { identity: host, pendingRegion: { regionId: 5, token: 1 }, slot: 0 },
          {
            identity: guest,
            pendingRegion: { regionId: 9, token: 1 },
            slot: 1,
          },
        ],
        { bubbleCount: 1, generation: 1, initialBubble: 1 }
      )
    );
    const rows = parsed?.pahRegions?.table.rows ?? [];
    expect(rows[0]?.regionId).toBe(5);
    expect(rows[0]?.public.peerSlots.markers[0]).toBe(1);
    expect(rows[0]?.peerMask).toBe(0b01);
    expect(rows[1]?.regionId).toBe(9);
    expect(rows[1]?.public.peerSlots.markers[1]).toBe(1);
    expect(rows[1]?.peerMask).toBe(0b10);
    expect(rows[2]?.regionId).toBe(-1);
  });
});

describe("membership client identity", () => {
  // The Tower join's first class-21 update (capture, 164 bytes).
  const joinClientAuth = Buffer.from(
    "e7d7e5e4dfb0b9b3b0b2b0b2b6dfb0b6b2b6b4b9dfb0b0b0b0b0b1c0f8e5c0f0eeade3ef" +
      "e4e9e5c0b7c3b1c5b5b2c1b3b8b9c3c5" +
      "80".repeat(77) +
      "966288a2fb485bd21ee905a4f8a05ad78c0000000e00000006f83ca547139c00010e00",
    "hex"
  );

  it("reads the identity the client sends at join", () => {
    const identity = parseClientIdentity(joinClientAuth);
    expect(identity?.unknown2).toBe(0x2c_c5_11_45_f6_90_b7_a4n);
    expect(identity?.unknown5).toBe(0xee_90_5a_4f_8a_05_ad_78n);
    expect(identity?.machine?.bytes).toEqual([
      0x7c, 0x1e, 0x52, 0xa3, 0x89, 0xce, 0, 0,
    ]);
  });

  it("echoes it in the member's slot", () => {
    const clientAuth = parseClientIdentity(joinClientAuth);
    const payload = buildReplicateMembershipRsat([
      {
        clientAuth,
        identity: {
          machine: Buffer.from("7c1e52a389ce0000", "hex"),
          player: Buffer.from("eb1baf30f8f6fa58", "hex"),
          account: 0x1_0000_0002n,
          character: 0x2_0000_0008n,
        },
        slot: 0,
      },
    ]);
    const auth = parseReplicateMembership(payload)?.clients.slots[0]?.auth as
      | LiveAuth
      | undefined;
    expect(auth?.identity).toEqual(clientAuth);
    expect(auth?.transition).toBeUndefined();
  });
});
