import { BitReader, decode } from "@blamnetwork/rsat";
import { expect, it } from "vitest";
import { activityBinder, bubbleSensors, worldTags } from "../../content";
import { describeWithPackages } from "../../test-support/build";
import { activityHostBuild } from "../versions";
import { liveAh } from "../versions/v41375_14_07_03_1501_live/live-ah";
import {
  buildApplySenseEntries,
  buildBinderSenseEntries,
  buildSensorAuthUpdateRsat,
  encodeCinematicAuth,
  encodeLifetimeAuth,
  encodePlayerObjectiveAuth,
  encodeSquadAuth,
  entryOn,
  PlayerObjectiveState,
  sensorAuthReader,
  withoutSenseRows,
} from "./sensor-auth-fields";

const MACHINE = Buffer.from("7c1e52a389ce0000", "hex");
const KEY = 0x2_00_00_00_08n;

function towerBinder() {
  const binder = activityBinder("city_tower_default1");
  if (!binder) {
    throw new Error("no Tower binder");
  }
  return binder;
}

const PLAYERS = { occupants: new Map([[0, { key: KEY }]]) };

// The Tower's world entry (bubble 3, a lone host).
function towerApply(scripted: Parameters<typeof entryOn>[] = []) {
  return buildApplySenseEntries({
    binder: towerBinder(),
    players: PLAYERS,
    scripted: scripted.map((args) => entryOn(...args)),
    sensors: bubbleSensors(worldTags("city_tower_default1", 3, "all"), 3),
  });
}

function grant() {
  return buildSensorAuthUpdateRsat({
    activityTime: 7,
    authorityMachine: MACHINE,
    bubbleCount: 5,
    hasAuthorityTable: true,
    senseEntries: buildBinderSenseEntries(towerBinder(), PLAYERS),
  });
}

// Reads the update's authority section with the table schema; the
// reader is left at the activity time. The two framing bits come back for
// the tests to check.
function skipAuthority(br: BitReader) {
  const hasTable = br.readBit();
  for (let i = 0; i < 65; i++) {
    br.readBit();
  }
  const tableBit = br.readBit();
  return {
    hasTable,
    tableBit,
    table: liveAh().AuthorityTable.decode(br),
  };
}

describeWithPackages("SensorAuth", () => {
  it("stamps promoted authority slots with the 8-byte machine id", () => {
    const { hasTable, tableBit, table } = skipAuthority(
      sensorAuthReader(grant())
    );
    expect([hasTable, tableBit]).toEqual([1, 1]);
    const slot = table.slots.unknown0[64];
    expect(Buffer.from(slot.machine?.bytes ?? [])).toEqual(MACHINE);
    expect(slot.sequence).toBe(1);
  });

  it("grants the Tower lifetime and 30 player rows of bundle 40aebf90", () => {
    const br = sensorAuthReader(grant());
    skipAuthority(br);
    expect(br.readNumber(32)).toBe(7);
    expect(br.readBit()).toBe(1);
    const rows: { typeId: number; typeIndex: number }[] = [];
    while (br.readBit() === 1) {
      const ref = liveAh().SensorClientRef.decode(br);
      expect(ref.bundle >>> 0).toBe(0x40_ae_bf_90);
      const bits = br.readNumber(32);
      // auth bound + present, then the auth body
      expect(br.readBit()).toBe(1);
      expect(br.readBit()).toBe(1);
      if (ref.typeId === 16) {
        expect(liveAh().LifetimeAuth.decode(br).state).toBe(3);
        expect(bits).toBeGreaterThan(2);
      } else {
        const auth = liveAh().PlayerAuth.decode(br);
        // Only the member's own slot (players[0], row 4) carries its key.
        const own = ref.typeIndex === 4;
        expect(auth.identity.key).toBe(own ? KEY : 0n);
        expect(auth.flag).toBe(own);
        expect(auth.unknown4).toBe(own ? 0 : -1);
        // sense bound, no sense body
        expect(br.readBit()).toBe(0);
      }
      rows.push({ typeId: ref.typeId, typeIndex: ref.typeIndex });
    }
    expect(rows[0]).toEqual({ typeId: 16, typeIndex: 2 });
    expect(rows.slice(1).map((r) => r.typeIndex)).toEqual(
      Array.from({ length: 30 }, (_, i) => 4 + i)
    );
  });

  it("drops the rows and keeps the authority section and time", () => {
    const full = grant();
    const stripped = withoutSenseRows(full);
    const br = sensorAuthReader(stripped);
    const { table } = skipAuthority(br);
    expect(Buffer.from(table.slots.unknown0[64].machine?.bytes ?? [])).toEqual(
      MACHINE
    );
    expect(br.readNumber(32)).toBe(7);
    expect(br.readBit()).toBe(0);
    expect(stripped.length).toBeLessThan(full.length);
  });

  it("gives every sensor the Tower's guest had waiting a zero auth", () => {
    // The sensor instances with +24 "needs initial auth" of
    // city_tower_default1 in bubble 3 (read from guest memory).
    const measured = [
      [0x40_ae_bf_90, 15, [0]],
      [0x40_ae_bf_90, 17, [1]],
      [0x40_ae_bf_90, 39, [3]],
      [0xf2_d8_8b_d0, 6, [0, 1]],
      [
        0x8c_c3_14_36,
        1,
        [
          2, 4, 6, 8, 11, 16, 18, 21, 25, 26, 27, 30, 32, 34, 36, 38, 40, 42,
          44, 47,
        ],
      ],
      [
        0x8c_c3_14_36,
        2,
        [
          3, 5, 7, 9, 10, 12, 13, 14, 15, 17, 19, 20, 22, 23, 24, 28, 29, 31,
          33, 35, 37, 39, 41, 43, 45, 46, 48, 49,
        ],
      ],
      [0x8c_c3_14_36, 3, [0, 1]],
      [0x8c_c3_14_36, 4, [50, 51]],
      [0x8c_c3_14_36, 40, Array.from({ length: 23 }, (_, i) => 52 + i)],
    ] as const;
    const binderRows = 1 + towerBinder().players.length;
    const zero = towerApply()
      .slice(binderRows)
      .map(({ clientRef: r }) => `${r.bundle >>> 0}:${r.typeId}:${r.typeIndex}`)
      .sort();
    const expected = measured
      .flatMap(([bundle, typeId, indices]) =>
        indices.map((index) => `${bundle}:${typeId}:${index}`)
      )
      .sort();
    expect(zero).toEqual(expected);
  });

  it("puts script-written rows over their zero auths in the tower apply", () => {
    const TOWER = 0x8c_c3_14_36;
    const placed = encodeSquadAuth({ bindingGeneration: 1, roster: [0] });
    const plain = towerApply();
    const scripted = towerApply([[TOWER, 1, 36, placed, true]]);
    expect(scripted).toHaveLength(plain.length);
    const at = plain.findIndex(
      ({ clientRef: ref }) =>
        ref.bundle === TOWER && ref.typeId === 1 && ref.typeIndex === 36
    );
    expect(scripted[at].authBits).toBe(placed.bitCount);
    expect(plain[at].authBits).not.toBe(placed.bitCount);
  });

  it("builds venus_portal_1's private and public worlds apart", () => {
    const binder = activityBinder("venus_portal_1");
    expect(binder).toEqual({
      bundle: 0xf2_92_21_f5,
      lifetime: 3,
      players: Array.from({ length: 16 }, (_, i) => 4 + i),
    });
    // The plaza (15) is public: the private world keeps the strike's global
    // bundles, the public host builds the plaza's.
    const privateTags = worldTags("venus_portal_1", 15, "private");
    const publicTags = worldTags("venus_portal_1", 15, "public");
    expect(privateTags.map((tag) => tag.bundle >>> 0)).toEqual([
      0x96_e0_a5_e5, 0x0a_30_24_29, 0xa8_60_8b_10, 0xf2_92_21_f5,
    ]);
    expect(publicTags.map((tag) => tag.bundle >>> 0)).toEqual([
      0xea_af_16_e2, 0x8c_c3_14_36, 0x6b_77_9e_60, 0xe1_b2_8d_9a, 0x7a_6a_44_be,
    ]);
    // The first strike apply carries 19 rows of the strike's bundle (2.3.1
    // capture).
    const strike = bubbleSensors(privateTags, 15).filter(
      (sensor) => sensor.bundle === 0x0a_30_24_29
    );
    expect(strike).toHaveLength(19);
    // Engineering (7, private) builds its own copy of the strike bundle with
    // the floor's squads, and its own bundle.
    const engineering = bubbleSensors(
      worldTags("venus_portal_1", 7, "private"),
      7
    );
    expect(
      engineering.filter((sensor) => sensor.bundle === 0x0a_30_24_29)
    ).toHaveLength(42);
    expect(engineering.some((sensor) => sensor.bundle === 0x97_43_8d_09)).toBe(
      true
    );
    expect(() =>
      buildApplySenseEntries({
        binder,
        players: PLAYERS,
        sensors: [...engineering, ...bubbleSensors(publicTags, 15)],
      })
    ).not.toThrow();
  });
});

// act_cosmo_m0_highway's story rows (2.3.1 capture).
describeWithPackages("story rows", () => {
  const EMPTY = 0x81_1c_9d_c5;
  const biased = (value: number) => (value + 0x80_00_00_00) >>> 0;

  // sq_m0_fallen_gating at its placement (7 of 7 captures): ref0
  // obj_m0_hangar_fallen, task 2 ("gating"), the task's +0xC 3 beside it,
  // three roster cells.
  it("names a squad's objective and task, the captured hangar gating squad", () => {
    const auth = decode(
      liveAh().SquadAuth,
      encodeSquadAuth({
        bindingGeneration: 1,
        objective: { bundle: 0x06_2d_d9_5d, typeIndex: 4 },
        roster: [1, 1, 1],
        task: 2,
        taskInfluencer: 3,
      }).bytes
    );
    expect(auth.ref0).toEqual({
      bundle: 0x06_2d_d9_5d,
      typeId: 3,
      typeIndex: 4,
    });
    expect([auth.task, auth.unknown9]).toEqual([2, 3]);
    expect(auth.roster).toEqual({ slots: [1, 1, 1] });
    // No objective yet (the idle fallen squads of a world entry carry ref0
    // and task -1; a squad nothing authored carries neither).
    const idle = decode(
      liveAh().SquadAuth,
      encodeSquadAuth({ bindingGeneration: 1, roster: [0] }).bytes
    );
    expect([idle.ref0, idle.task, idle.unknown9]).toEqual([
      undefined,
      -1,
      undefined,
    ]);
  });

  it("names the running phase and its bubble in the lifetime", () => {
    const auth = decode(
      liveAh().LifetimeAuth,
      encodeLifetimeAuth(4, true, {
        bubble: 14,
        hash: 0x00_bc_0b_b1,
        index: 0,
      }).bytes
    );
    expect([auth.state, auth.phaseIndex, auth.field4]).toEqual([4, 0, 14]);
    expect(auth.phaseHash >>> 0).toBe(0x00_bc_0b_b1);
  });

  it("encodes a playing cinematic with its start tick and generation", () => {
    const bits = encodeCinematicAuth(2, 300);
    expect(bits.bitCount).toBe(166);
    const br = new BitReader(bits.bytes);
    expect(br.readNumber(32) >>> 0).toBe(biased(300));
    expect(br.readNumber(32)).toBe(2);
    expect([br.readBit(), br.readBit()]).toEqual([1, 0]);
    expect(liveAh().SensorClientRef.decode(br).bundle >>> 0).toBe(EMPTY);
    expect(br.readNumber(6)).toBe(2);
  });

  it("encodes an idle cinematic at tick 0, not playing", () => {
    const br = new BitReader(encodeCinematicAuth(4).bytes);
    expect(br.readNumber(32) >>> 0).toBe(biased(0));
    expect(br.readNumber(32)).toBe(4);
    expect(br.readBit()).toBe(0);
  });

  // [0]..[7] of 80802A1B come to 188 bits; [8] is the nav slots.
  const NAV_SLOTS_AT = 188;

  function navSlots(bits: { bytes: Buffer }) {
    const br = new BitReader(bits.bytes);
    for (let i = 0; i < NAV_SLOTS_AT; i++) {
      br.readBit();
    }
    return br;
  }

  it("fills an active objective's first nav slot with its waypoint", () => {
    const br = navSlots(
      encodePlayerObjectiveAuth({
        navPoints: [
          {
            ref: { bundle: 0x99_2b_b4_71, typeId: 44, typeIndex: 87 },
            sliceSet: 14,
            x: 375.725,
            y: -796.574,
            z: 13.351,
          },
        ],
        state: PlayerObjectiveState.Active,
      })
    );
    expect(br.readBit()).toBe(1);
    expect(br.readNumber(4)).toBe(2);
    expect(br.readNumber(3)).toBe(1);
    liveAh().SensorClientRef.decode(br);
    expect(br.readNumber(32) >>> 0).toBe(biased(14));
    const xyz = Buffer.alloc(12);
    for (let i = 0; i < 12; i++) {
      xyz[i] = br.readNumber(8);
    }
    expect(xyz.readFloatBE(0)).toBeCloseTo(375.725, 3);
    expect(xyz.readFloatBE(8)).toBeCloseTo(13.351, 3);
    const row = liveAh().SensorClientRef.decode(br);
    expect([row.bundle >>> 0, row.typeId, row.typeIndex]).toEqual([
      0x99_2b_b4_71, 44, 87,
    ]);
    // The next slot is empty.
    expect(br.readNumber(4)).toBe(1);
  });

  it("leaves the nav slots out when the caller has none", () => {
    const br = navSlots(
      encodePlayerObjectiveAuth({ state: PlayerObjectiveState.Active })
    );
    expect(br.readBit()).toBe(0);
  });

  // act_cosmo_m0_highway, every objective of 7 captures: 2 incoming, 3
  // active, 0 cleared (bias 1 on the wire).
  it("numbers the states as captured: 2 incoming, 3 active, 0 cleared", () => {
    const wire = (state: PlayerObjectiveState) => {
      const br = new BitReader(encodePlayerObjectiveAuth({ state }).bytes);
      expect(br.readBit()).toBe(1);
      return br.readNumber(3) - 1;
    };
    expect(wire(PlayerObjectiveState.None)).toBe(0);
    expect(wire(PlayerObjectiveState.Incoming)).toBe(2);
    expect(wire(PlayerObjectiveState.Active)).toBe(3);
  });

  it("empties nav slot 0 with the clear, as the captured cleared row does", () => {
    const br = navSlots(
      encodePlayerObjectiveAuth({
        navPoints: [{ sliceSet: 14, x: 375.725, y: -796.574, z: 13.351 }],
        state: PlayerObjectiveState.None,
      })
    );
    expect(br.readBit()).toBe(1);
    // Slot 0: no waypoint, [1] 0, unset ref, bubble -1.
    expect(br.readNumber(4)).toBe(1);
    expect(br.readNumber(3)).toBe(1);
    liveAh().SensorClientRef.decode(br);
    expect(br.readNumber(32) >>> 0).toBe(biased(-1));
  });
});

// 808004A4, the hard_wipe_globals row.
describeWithPackages("the hard wipe row", () => {
  const HARD_WIPE_GLOBALS = 0x80_80_04_a4;
  const row = (enabled: boolean) => {
    const bits = activityHostBuild().sensor.encodeHardWipeGlobals(enabled);
    return {
      bits,
      auth: liveAh().HardWipeGlobalsAuth.decode(new BitReader(bits.bytes)),
    };
  };

  it("says whether a hard wipe is armed, with the countdown idle", () => {
    for (const enabled of [false, true]) {
      const { auth, bits } = row(enabled);
      expect(bits.bitCount).toBe(197);
      expect(auth).toEqual({
        countdown: {
          unknown0: false,
          unknown1: -0x80_00_00_00,
          unknown2: 0x7f_ff_ff_ff,
          unknown3: 0,
          unknown4: 0,
          unknown5: 0,
          unknown6: 1,
        },
        enabled,
        unknown1: false,
        unknown2: 0,
      });
    }
  });

  it("is idle as nothing armed, not the all-zero body", () => {
    const idle = activityHostBuild().sensor.idleAuth(HARD_WIPE_GLOBALS);
    expect(idle?.bytes).toEqual(row(false).bits.bytes);
    expect(idle?.bytes).not.toEqual(row(true).bits.bytes);
  });
});

describeWithPackages("a player's death in the sense", () => {
  const state = (dead: boolean) => ({
    unknown0: 0,
    unknown1: 0,
    unknown2: false,
    unknown3: false,
    unknown4: dead,
    unknown5: 0,
    unknown6: 0,
  });
  const second = (request: boolean) => ({
    unknown0: 0,
    unknown1: request,
    unknown2: false,
    unknown3: false,
  });

  it("reads the fifth member of the first state as dead", () => {
    const { sense } = activityHostBuild().sensor;
    for (const dead of [false, true]) {
      expect(
        sense.playerReport({ unknown0: state(dead), unknown1: second(false) })
          ?.dead
      ).toBe(dead);
    }
  });

  it("withholds the request to respawn the host would grant, and nothing else", () => {
    const { withholdRespawn } = activityHostBuild().sensor;
    expect(withholdRespawn(second(true))).toEqual({
      ...second(true),
      unknown1: false,
    });
    expect(withholdRespawn(undefined)).toBeUndefined();
  });
});
