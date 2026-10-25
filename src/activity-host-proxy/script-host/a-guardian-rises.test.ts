// A Guardian Rises (act_cosmo_m0_highway, activity 126) and the
// cine_reveal after it: the phase-state tables, the lifetime that names the
// running phase, and the authored scripts (tiger scripts) on the disc
// tables. 2.3.1 captures of it are in tiger-packet-analysis.

import { fnv1 } from "@blamnetwork/bullshcript/destiny1/common";
import { BitReader, decode } from "@blamnetwork/rsat";
import { expect, it } from "vitest";
import {
  activityBinder,
  activityBubble,
  activityBundles,
  activityNavPoints,
  activityPhases,
  activitySensors,
  bubbleSensors,
  bubbleState,
  loadedBundles,
  worldTags,
} from "../../content";
import { describeWithPackages } from "../../test-support/build";
import { SensorRowState } from "../mission/row-state";
import {
  encodeCinematicAuth,
  encodeLifetimeAuth,
  encodeObjectAuth,
  type FinishedBits,
} from "../rsat/sensor-auth-fields";
import { liveAh } from "../versions/v41375_14_07_03_1501_live/live-ah";
import { ItemSink } from "./item-sink";
import { scriptHostFor } from "./runtime";

const MISSION = "act_cosmo_m0_highway";
const HIGHWAY = 14;
const LIFETIME = 16;
const EMPTY_NAME_HASH = 0x81_1c_9d_c5;

function lifetimeOf(sink: ItemSink) {
  return decode(liveAh().LifetimeAuth, sink.lifetimeBody().bytes);
}

// `phase` is the mission the activity resumes at (a debug start; 0 is a
// fresh mission).
function missionHost(
  activityName: string,
  bubble: number,
  state: number,
  phase = 0
) {
  const lines: string[] = [];
  const host = scriptHostFor({
    activityName,
    clock: { activityTicks: () => 0 },
    log: (line: string) => lines.push(line),
    namedHandles: {},
    phaseProgress: { read: () => phase, write: () => undefined },
    players: () => [{ characterKey: "c0", powerLevel: 1, ready: true }],
    state: new SensorRowState(),
    tickSeconds: 1,
  });
  if (!host?.itemSink) {
    throw new Error("no host");
  }
  host.start();
  host.setActiveBundles(
    loadedBundles(activityName, bubble, state) ?? new Set()
  );
  return { host, lines, rows: host.itemSink };
}

describeWithPackages("act_cosmo_m0_highway tables", () => {
  it("lists the seven phases with the bubble each runs in", () => {
    expect(activityPhases(MISSION).map((phase) => phase.bubble)).toEqual([
      14, 14, 3, 12, 12, 13, 13,
    ]);
  });

  it("opens the highway in the intro's own state and swaps back after it", () => {
    expect(activityBundles(MISSION)?.scenario.initialState).toBe(1);
    const [intro, highway] = activityPhases(MISSION);
    expect(bubbleState(MISSION, HIGHWAY, fnv1(intro?.name ?? ""))).toBe(1);
    expect(bubbleState(MISSION, HIGHWAY, fnv1(highway?.name ?? ""))).toBe(0);
    expect(activityBubble(MISSION, HIGHWAY, 1)?.state).toBe(1);
    expect(activityBubble(MISSION, HIGHWAY)?.state ?? 0).toBe(0);
  });

  // The world entry in the 2.3.1 capture: 151 rows, by bundle.
  it("builds the intro's world as the captured world entry does", () => {
    const rows = new Map<string, number>();
    for (const sensor of [
      ...bubbleSensors(worldTags(MISSION, HIGHWAY, "all", 1), HIGHWAY),
      ...activitySensors(MISSION),
    ]) {
      rows.set(
        `${sensor.bundle >>> 0}:${sensor.typeId}:${sensor.typeIndex}`,
        sensor.bundle >>> 0
      );
    }
    const byBundle = new Map<number, number>();
    for (const bundle of rows.values()) {
      byBundle.set(bundle, (byBundle.get(bundle) ?? 0) + 1);
    }
    expect(rows.size).toBe(151);
    expect(byBundle).toEqual(
      new Map([
        [0x99_2b_b4_71, 35],
        [0x3c_2f_5e_d5, 52],
        [0x47_86_c0_e0, 21],
        [0xfc_0e_45_a3, 6],
        [0x92_43_df_fb, 1],
        [0x06_2d_d9_5d, 1],
        [0xec_f5_74_b5, 35],
      ])
    );
  });

  it("adds no activity-wide sensors to the Tower's or Venus's worlds", () => {
    for (const [activity, bubble] of [
      ["city_tower_default1", 3],
      ["venus_portal_1", 15],
    ] as const) {
      const own = new Set(
        bubbleSensors(worldTags(activity, bubble, "all"), bubble).map(
          (sensor) =>
            `${sensor.bundle >>> 0}:${sensor.typeId}:${sensor.typeIndex}`
        )
      );
      expect(
        activitySensors(activity).filter(
          (sensor) =>
            !own.has(
              `${sensor.bundle >>> 0}:${sensor.typeId}:${sensor.typeIndex}`
            )
        )
      ).toEqual([]);
    }
  });

  it("falls back to a bubble's own state for a state the tables lack", () => {
    expect(activityBubble(MISSION, 3, 7)).toBe(activityBubble(MISSION, 3));
  });

  it("has the first objective's nav point", () => {
    // obj_m0_phase00_m1's waypoint (bubble 14, 2.3.1 capture).
    const point = activityNavPoints(MISSION).find(
      (entry) => Math.abs(entry.x - 375.725) < 0.01
    );
    expect(point).toBeDefined();
    expect(point?.y).toBeCloseTo(-796.574, 2);
    expect(point?.z).toBeCloseTo(13.351, 2);
  });
});

describeWithPackages("lifetime phases", () => {
  const phases = activityPhases(MISSION);
  const binder = activityBinder(MISSION);
  if (!binder) {
    throw new Error("no act_cosmo_m0_highway binder");
  }
  const lifetime = {
    bundle: binder.bundle,
    typeId: LIFETIME,
    typeIndex: binder.lifetime,
  };

  it("starts at none in the first phase when the activity opens on one", () => {
    const sink = new ItemSink([], () => undefined, {
      phases,
      startsInPhaseState: true,
    });
    // The world entry sends 0, then the scripts' pregame (1).
    const auth = lifetimeOf(sink);
    expect(auth.state).toBe(0);
    expect(auth.phaseIndex).toBe(0);
    expect(auth.phaseHash >>> 0).toBe(fnv1(phases[0]?.name ?? ""));
    expect(auth.field4).toBe(HIGHWAY);
  });

  it("sends the lifetime again when a phase starts", () => {
    const sink = new ItemSink([], () => undefined, { phases });
    sink.bindLifetime(lifetime);
    sink.setPhase(2);
    expect(sink.hasDirty()).toBe(true);
    const auth = lifetimeOf(sink);
    expect(auth.state).toBe(3);
    expect(auth.phaseIndex).toBe(2);
    expect(auth.phaseHash >>> 0).toBe(fnv1("cosmo_m0_phase01_breach"));
    expect(auth.field4).toBe(3);
  });

  it("names no phase once the activity has ended", () => {
    const sink = new ItemSink([], () => undefined, { phases });
    // Runtime state 6 (ended) is wire 7.
    sink.apply({
      item: lifetime,
      kind: "lifetime",
      state: { joinFlag: true, state: 6 },
    });
    const auth = lifetimeOf(sink);
    expect(auth.state).toBe(7);
    expect(auth.phaseIndex).toBe(phases.length);
    expect(auth.phaseHash >>> 0).toBe(EMPTY_NAME_HASH);
    expect(auth.field4).toBe(-1);
  });

  // The tail's last two members lock the time of day: the tables' 0.77
  // (sunset) until a script sets another (2.3.1 capture: 0.025, night, as the
  // garage fight starts).
  it("takes the scripts' time of day over the tables' in the tail", () => {
    const sink = new ItemSink([], () => undefined, {
      lifetimeTail: { instance: 7, timeOfDay: 0.77, timeOfDayLocked: true },
      phases,
    });
    expect(lifetimeOf(sink).timeOfDay).toBeCloseTo(0.77);
    sink.apply({
      item: lifetime,
      kind: "lifetime",
      state: { joinFlag: true, state: 2, timeOfDay: 0.025 },
    });
    const auth = lifetimeOf(sink);
    expect(auth.timeOfDayLocked).toBe(true);
    expect(auth.timeOfDay).toBeCloseTo(0.025);
    // A later push without it keeps the value.
    sink.apply({
      item: lifetime,
      kind: "lifetime",
      state: { joinFlag: false, state: 5 },
    });
    expect(lifetimeOf(sink).timeOfDay).toBeCloseTo(0.025);
  });

  it("keeps the Tower's lifetime without phases", () => {
    const sink = new ItemSink([], () => undefined);
    const auth = lifetimeOf(sink);
    expect(auth.state).toBe(3);
    expect(auth.phaseHash >>> 0).toBe(EMPTY_NAME_HASH);
    expect(auth.field4).toBe(21);
  });
});

describeWithPackages("act_cosmo_m0_highway scripts on the disc tables", () => {
  it("resolves every binding and starts the first mission", () => {
    const { host, lines } = missionHost(MISSION, HIGHWAY, 1);
    for (let i = 0; i < 5; i++) {
      host.tick();
    }
    expect(host.unresolvedBindings).toEqual([]);
    expect(lines).toContain(
      "lua mission act_cosmo_m0_highway_mission1 starting"
    );
  });

  // Pregame (1) goes out on its own, 1.1 s before the update that starts
  // pf_104_res and holds the lifetime (4) (2.3.1 capture).
  it("sends pregame before the intro cinematic starts", () => {
    const { host, rows } = missionHost(MISSION, HIGHWAY, 1);
    host.tick();
    const first = rows.takeDirty();
    expect(lifetimeOf(rows).state).toBe(1);
    expect(first.some(({ clientRef: r }) => r.typeId === 6)).toBe(false);
    for (let i = 0; i < 3; i++) {
      host.tick();
    }
    expect(lifetimeOf(rows).state).toBe(4);
    expect(
      rows
        .takeDirty()
        .some(({ clientRef: r }) => r.typeId === 6 && r.typeIndex === 1)
    ).toBe(true);
  });

  it("holds the lifetime for the intro cinematic", () => {
    const { host, rows } = missionHost(MISSION, HIGHWAY, 1);
    for (let i = 0; i < 5; i++) {
      host.tick();
    }
    // Pregame (1), then 4 while pf_104_res plays, in the intro.
    const auth = lifetimeOf(rows);
    expect(auth.state).toBe(4);
    expect(auth.phaseIndex).toBe(0);
    expect(auth.phaseHash >>> 0).toBe(fnv1("cosmo_m0_phase00_highway_intro"));
  });

  it("marks the player rows as the intro cinematic starts, as captured", () => {
    const { host, rows } = missionHost(MISSION, HIGHWAY, 1);
    rows.setOccupants(new Map([[0, 0x2_00_00_00_0an]]));
    // The client's own report for players[0] (row 5).
    rows.notePlayerState(5, {
      unknown0: 14,
      unknown1: 0x81_1c_9d_c5,
      unknown2: true,
      unknown3: false,
      unknown4: false,
      unknown5: 3,
      unknown6: 1,
    });
    for (let i = 0; i < 5; i++) {
      host.tick();
    }
    const taken = rows.takeDirty();
    // skeleton_static_1 is created with the cinematic.
    expect(
      taken.some(({ clientRef: r }) => r.typeId === 4 && r.typeIndex === 0)
    ).toBe(true);
    const players = new Map(
      taken
        .filter(({ clientRef: r }) => r.typeId === 12)
        .map((entry) => [
          entry.clientRef.typeIndex,
          decode(liveAh().PlayerAuth, entry.authBody ?? Buffer.alloc(0)),
        ])
    );
    const own = players.get(5);
    expect(own?.identity.key).toBe(0x2_00_00_00_0an);
    expect(own?.unknown0).toMatchObject({ unknown0: 14, unknown3: true });
    expect(own?.identity.unknown1).toBe(1);
    const empty = players.get(6);
    expect(empty?.identity.key).toBe(0n);
    expect(empty?.identity.unknown1).toBe(1);
    expect(empty?.unknown4).toBe(-1);
  });

  it("starts cine_reveal's first cinematic in its phase", () => {
    const { host, lines, rows } = missionHost("cine_reveal", 3, 1);
    for (let i = 0; i < 5; i++) {
      host.tick();
    }
    expect(host.unresolvedBindings).toEqual([]);
    expect(lines).toContain("lua mission cine_reveal_mission1 starting");
    expect(lifetimeOf(rows).phaseHash >>> 0).toBe(fnv1("cine_106_trv_phase"));
  });
});

// The breach entry (2.3.1 capture) carries the nests' actors placed, beside
// squads with one roster cell per member, and crawler8 and the Ghost
// unplaced. The bundle's threads run as the bubble comes up, with the clock
// where it is.
describeWithPackages("the breach bundle coming up (console run 12)", () => {
  const BREACH = 0xfc_0e_45_a3;
  const NEST1 = 77;
  const NEST2 = 86;
  // In the script's order: crawler5 (80) is placed after crawler4 (83).
  const PLACED = [78, 79, 81, 82, 83, 80, 84, 85, 87, 88, 89, 90, 92, 93];

  function breachUp() {
    const { host, rows } = missionHost(MISSION, HIGHWAY, 0);
    host.notePlayerSpawned();
    for (let i = 0; i < 3; i++) {
      host.tick();
    }
    rows.takeDirty();
    const { now, ticks } = host.runtime;
    host.setActiveBundles(loadedBundles(MISSION, 3, 0) ?? new Set());
    host.runReadyThreads();
    return { host, now, rows, ticks };
  }

  it("places the nests' actors without moving the clock", () => {
    const { host, now, rows, ticks } = breachUp();
    expect([host.runtime.now, host.runtime.ticks]).toEqual([now, ticks]);
    const placed = rows.takeDirty();
    const actors = placed
      .filter(({ clientRef: r }) => r.bundle === BREACH && r.typeId === 2)
      .map(({ clientRef: r, authBody }) => ({
        index: r.typeIndex,
        place: liveAh().ActorAuth.decode(
          new BitReader(authBody ?? Buffer.alloc(0))
        ).place,
      }));
    expect(actors.filter((a) => a.place).map((a) => a.index)).toEqual(PLACED);
    expect(actors.some((a) => a.index === 91 || a.index === 95)).toBe(false);
    // Nothing else of the breach has run yet: pt_bubble's objects wait.
    expect(
      placed.some(({ clientRef: r }) => r.bundle === BREACH && r.typeId === 4)
    ).toBe(false);
  });

  it("gives the nests a roster with one cell per member, squads first", () => {
    const { rows } = breachUp();
    const placed = rows.takeDirty();
    const squads = placed.filter(
      ({ clientRef: r }) => r.bundle === BREACH && r.typeId === 1
    );
    // The nests first, then the 27 fallen squads the script gave their
    // Objective (the 2.3.1 capture carries every one with ref0).
    expect(squads.slice(0, 2).map(({ clientRef: r }) => r.typeIndex)).toEqual([
      NEST1,
      NEST2,
    ]);
    expect(squads).toHaveLength(29);
    expect(placed.indexOf(squads[1]!)).toBe(1);
    const auth = (entry: (typeof squads)[number]) =>
      liveAh().SquadAuth.decode(
        new BitReader(entry.authBody ?? Buffer.alloc(0))
      );
    expect(auth(squads[0]!).roster?.slots).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(auth(squads[1]!).roster?.slots).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(auth(squads[0]!).ref0).toBeUndefined();
    // sq_fallen_first_vandal: obj_breach_fallen01 (t3#20), no task yet.
    const vandal = squads.find(({ clientRef: r }) => r.typeIndex === 21);
    expect(auth(vandal!).ref0).toEqual({
      bundle: BREACH | 0,
      typeId: 3,
      typeIndex: 20,
    });
    expect(auth(vandal!).task).toBe(-1);
  });

  it("sends the placements once: the next tick repeats none of them", () => {
    const { host, rows } = breachUp();
    rows.takeDirty();
    host.tick();
    expect(
      rows
        .takeDirty()
        .filter(({ clientRef: r }) => r.bundle === BREACH)
        .map(({ clientRef: r }) => `t${r.typeId}#${r.typeIndex}`)
    ).toEqual([]);
  });

  // The entry names each placed nest actor's performance on its Machine row
  // (t40#126-140 but crawler8's 138), generation 1, no cue yet (2.3.1 capture).
  it("names the nests' performances beside the placements", () => {
    const { rows } = breachUp();
    const machines = rows
      .takeDirty()
      .filter(({ clientRef: r }) => r.bundle === BREACH && r.typeId === 40)
      .map(({ clientRef: r, authBody }) => {
        const br = new BitReader(authBody ?? Buffer.alloc(0));
        br.readBit();
        const name = br.readNumber(32) >>> 0;
        const action = br.readNumber(32) >>> 0;
        const generation = (br.readNumber(32) >>> 0) - 0x80_00_00_00;
        br.readBit();
        return {
          index: r.typeIndex,
          name,
          action,
          generation,
          cues: br.readNumber(3),
        };
      });
    expect(machines.map((m) => m.index).sort((a, b) => a - b)).toEqual([
      126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 139, 140,
    ]);
    for (const m of machines) {
      expect([m.action, m.generation, m.cues]).toEqual([0x9a_5f_60_c9, 1, 0]);
    }
    expect(machines.find((m) => m.index === 126)?.name).toBe(0x26_0e_b5_be);
    expect(machines.find((m) => m.index === 127)?.name).toBe(0x8c_ea_3a_b1);
    expect(machines.find((m) => m.index === 140)?.name).toBe(0xf4_52_84_b9);
  });
});

// The Ghost's light-up (2.3.1 capture), from
// pt_nux_ghost_light_up_start: the Ghost placed and put on of_ghostlight,
// ho_ghostlight reading that filter and o_breach_nut_back created
// (0.8-0.9 s); o_breach_gating_back (+1 s); o_breach_control created
// (+14 s), its device at position 1 (+0.3-0.7 s), the hop-on let go
// (+0.3-0.6 s) and o_breach_gating_lights' device at position 1 (+7.3-7.7 s).
describeWithPackages(
  "the Ghost lighting the breach up (console run 14)",
  () => {
    const BREACH = 0xfc_0e_45_a3;
    const PT_LIGHT_UP_START = 120;
    const GHOST = 95;
    const HOP_ON = 101;
    const FILTER = 124;
    const O_CONTROL = 0;
    const O_LIGHTS = 4;
    const O_GATING_BACK = 5;
    const O_NUT_BACK = 6;

    // The breach up and its bubble trigger fired, then the light-up trigger;
    // every row the breach bundle writes after it, by the tick it went out.
    function lightUp(ticks: number) {
      const { host, rows } = missionHost(MISSION, HIGHWAY, 0);
      host.notePlayerSpawned();
      for (let i = 0; i < 3; i++) {
        host.tick();
      }
      host.setActiveBundles(loadedBundles(MISSION, 3, 0) ?? new Set());
      host.runReadyThreads();
      host.noteTriggerFired(BREACH, 105);
      host.tick();
      rows.takeDirty();
      host.noteTriggerFired(BREACH, PT_LIGHT_UP_START);
      const sent: { tick: number; key: string; body: Buffer }[] = [];
      for (let tick = 1; tick <= ticks; tick++) {
        host.tick();
        for (const { clientRef: r, authBody } of rows.takeDirty()) {
          if (r.bundle === BREACH) {
            sent.push({
              tick,
              key: `t${r.typeId}#${r.typeIndex}`,
              body: authBody ?? Buffer.alloc(0),
            });
          }
        }
      }
      return sent;
    }

    const ticksOf = (sent: ReturnType<typeof lightUp>, key: string) =>
      sent.filter((e) => e.key === key).map((e) => e.tick);

    function objectDevice(body: Buffer) {
      const br = new BitReader(body);
      br.readNumber(32);
      br.readBit();
      liveAh().SensorClientRef.decode(br);
      if (br.readNumber(2) === 0) {
        return;
      }
      br.readBit();
      br.readNumber(32);
      return liveAh().ObjectDeviceComponent.decode(br);
    }

    function hopOnFilter(body: Buffer) {
      const br = new BitReader(body);
      br.readBit();
      br.readNumber(32);
      return liveAh().SensorClientRef.decode(br).typeIndex;
    }

    it("places the Ghost on the filter the hop-on reads, then the gate behind", () => {
      const sent = lightUp(2);
      const first = sent.filter((e) => e.tick === 1).map((e) => e.key);
      expect(first).toEqual(
        expect.arrayContaining([
          `t4#${O_NUT_BACK}`,
          `t2#${GHOST}`,
          `t33#${FILTER}`,
          `t24#${HOP_ON}`,
        ])
      );
      expect(first).not.toContain(`t4#${O_GATING_BACK}`);
      const hopOn = sent.find((e) => e.key === `t24#${HOP_ON}`);
      expect(hopOnFilter(hopOn?.body ?? Buffer.alloc(0))).toBe(FILTER);
      expect(ticksOf(sent, `t4#${O_GATING_BACK}`)).toEqual([2]);
    });

    it("powers the control 15 s on, lets the hop-on go, then lights the breach", () => {
      const sent = lightUp(26);
      const control = sent.filter((e) => e.key === `t4#${O_CONTROL}`);
      expect(control.map((e) => e.tick)).toEqual([16, 17]);
      expect(objectDevice(control[0]!.body)).toBeUndefined();
      expect(objectDevice(control[1]!.body)).toMatchObject({
        position: 1,
        positionStamp: 1,
        power: 1,
      });
      const hopOn = sent.filter((e) => e.key === `t24#${HOP_ON}`);
      expect(hopOn.map((e) => e.tick)).toEqual([1, 18]);
      expect(hopOnFilter(hopOn[1]!.body)).toBe(-1);
      const lights = sent.filter((e) => e.key === `t4#${O_LIGHTS}`);
      expect(lights.map((e) => e.tick)).toEqual([25]);
      expect(objectDevice(lights[0]!.body)).toMatchObject({
        position: 1,
        positionStamp: 1,
      });
    });

    function machine(body: Buffer) {
      const br = new BitReader(body);
      br.readBit();
      const name = br.readNumber(32) >>> 0;
      br.readNumber(32);
      br.readNumber(32);
      br.readBit();
      const count = br.readNumber(3);
      const cues: number[] = [];
      for (let i = 0; i < count; i++) {
        br.readNumber(32);
        cues.push(br.readNumber(32) >>> 0);
      }
      return { cues, name };
    }

    // From the Ghost's placement: its performance with it, its second cue
    // 21.0-21.4 s on; the nest's scatter cue per crawler at 6.5, 11.4, 19.2,
    // 20.0-20.1, 21.0-21.1 and 21.2-21.7 s (2.3.1 capture).
    it("starts the Ghost's performance and scatters the nest on the captured clock", () => {
      const sent = lightUp(26);
      const ghost = sent.filter((e) => e.key === "t40#125");
      expect(ghost.map((e) => e.tick)).toEqual([1, 23]);
      expect(machine(ghost[0]!.body)).toEqual({
        cues: [],
        name: 0x9b_1d_6a_71,
      });
      expect(machine(ghost[1]!.body).cues).toEqual([0x7a_3e_66_d9]);
      const cueTick = (index: number) => {
        const cued = sent.find(
          (e) => e.key === `t40#${index}` && machine(e.body).cues.length === 1
        );
        expect(machine(cued!.body).cues).toEqual([0xc9_b0_91_0d]);
        return cued!.tick;
      };
      expect(cueTick(131)).toBe(7);
      expect(cueTick(134)).toBe(12);
      expect(cueTick(129)).toBe(20);
      for (const index of [128, 133, 135, 140, 136, 137]) {
        expect(cueTick(index)).toBe(21);
      }
      expect([cueTick(126), cueTick(139)]).toEqual([22, 22]);
      expect([cueTick(127), cueTick(132), cueTick(130)]).toEqual([23, 23, 23]);
    });
  }
);

// The placement body for every named breach Fallen carries a one-atom command
// script (kind 1, a scripted animation sequence by name: fallen_drop,
// act_fallen_vault_left/right, act_fallen_intro_vandal_drop) in the same
// update as the squad, and the audio sequence sent with it names that actor
// as its source (2.3.1 capture: sq_fallen_bouncedown_c's vandal {[0] 1, place,
// cookie 1, pc 0, one kind-1 atom B16E26C0, no drop},
// seq_fallen_intro_vandal_drop {tick 1433, id 0, ref t2#25}).
describeWithPackages("the breach entrances (console run 19)", () => {
  const BREACH = 0xfc_0e_45_a3;
  const PT_BUBBLE = 105;
  const PT_FALLEN_C_SPAWN = 110;
  const VANDAL = 25;
  const WALL_DREG = 39;
  const SEQ_VANDAL_DROP = 96;
  const SEQ_VAULT_RIGHT = 99;

  // The breach up, then pt_fallen_c_spawn: every breach row of the next tick.
  function fallenC() {
    const { host, rows } = missionHost(MISSION, HIGHWAY, 0);
    host.notePlayerSpawned();
    for (let i = 0; i < 3; i++) {
      host.tick();
    }
    host.setActiveBundles(loadedBundles(MISSION, 3, 0) ?? new Set());
    host.runReadyThreads();
    host.noteTriggerFired(BREACH, PT_BUBBLE);
    host.tick();
    rows.takeDirty();
    host.noteTriggerFired(BREACH, PT_FALLEN_C_SPAWN);
    host.tick();
    const sent = new Map<string, Buffer>();
    for (const { clientRef: r, authBody } of rows.takeDirty()) {
      if (r.bundle === BREACH) {
        sent.set(`t${r.typeId}#${r.typeIndex}`, authBody ?? Buffer.alloc(0));
      }
    }
    return sent;
  }

  // An actor body whose script holds kind-1 atoms only: the sequences named.
  // (the ActorAuth has no member between place and the behaviour; the 2.3.1
  // extra variant list is what sets its body apart.)
  function entranceBody(body: Buffer) {
    const br = new BitReader(body);
    if (br.readBit()) {
      br.readNumber(31);
    }
    br.readNumber(2);
    br.readNumber(3);
    const place = br.readBit() === 1;
    const behaviour = br.readBit() === 1;
    const atoms: string[] = [];
    let cookie: number | undefined;
    let pc: number | undefined;
    if (br.readBit()) {
      cookie = br.readNumber(31);
      pc = br.readNumber(6);
      const count = br.readNumber(6);
      for (let i = 0; i < count; i++) {
        const present = br.readBit();
        const kind = br.readNumber(4) - 1;
        const end = br.readNumber(2) - 1;
        const name = (br.readNumber(32) >>> 0).toString(16);
        atoms.push(`${present} kind ${kind} end ${end} ${name}`);
      }
    }
    const drop = br.readBit() === 1;
    return { atoms, behaviour, cookie, drop, pc, place };
  }

  it("places the vandal and the wall dreg with their entrance in one body", () => {
    const sent = fallenC();
    expect([...sent.keys()]).toEqual(
      expect.arrayContaining([
        "t1#24",
        `t2#${VANDAL}`,
        `t5#${SEQ_VANDAL_DROP}`,
        "t1#38",
        `t2#${WALL_DREG}`,
        `t5#${SEQ_VAULT_RIGHT}`,
      ])
    );
    expect(entranceBody(sent.get(`t2#${VANDAL}`)!)).toEqual({
      atoms: ["1 kind 1 end 0 b16e26c0"],
      behaviour: false,
      cookie: 1,
      drop: false,
      pc: 0,
      place: true,
    });
    expect(entranceBody(sent.get(`t2#${WALL_DREG}`)!).atoms).toEqual([
      "1 kind 1 end 0 2ac3bdba",
    ]);
  });

  it("names the actor as the source of the sequence sent with it", () => {
    const sent = fallenC();
    const source = (key: string) =>
      liveAh().SequenceAuth.decode(new BitReader(sent.get(key)!));
    // The ref's bundle decodes signed.
    expect(source(`t5#${SEQ_VANDAL_DROP}`)).toMatchObject({
      playingId: 0,
      viewers: { bundle: BREACH | 0, typeId: 2, typeIndex: VANDAL },
    });
    expect(source(`t5#${SEQ_VAULT_RIGHT}`).viewers).toEqual({
      bundle: BREACH | 0,
      typeId: 2,
      typeIndex: WALL_DREG,
    });
  });
});

// The Ketch arrival. The 2.3.1 capture places each pilot with its fly-in
// command script in one body as the cinematic starts (ships 1, 3, 2, 4 within
// 2.8 s), drops the cargo 9 s after the script with the doors open, and sends
// ships 1 and 4 out 5 s later.
describeWithPackages("the Ketch arrival flying the dropships in", () => {
  const GRAVEYARD = 0x92_43_df_fb;
  const PT_KETCH = 24;
  const PILOT_1 = 5;
  const PILOT_4 = 11;

  function pilotBody(body: Buffer) {
    const br = new BitReader(body);
    if (br.readBit()) {
      br.readNumber(31);
    }
    br.readNumber(2);
    br.readNumber(3);
    const place = br.readBit() === 1;
    const behaviour = br.readBit() === 1;
    const atoms: string[] = [];
    let cookie = -1;
    if (br.readBit()) {
      cookie = br.readNumber(31);
      br.readNumber(6);
      const count = br.readNumber(6);
      for (let i = 0; i < count; i++) {
        br.readBit();
        const kind = br.readNumber(4) - 1;
        br.readNumber(2);
        switch (kind) {
          case 0:
          case 3: {
            const ref = liveAh().SensorClientRef.decode(br);
            const index = br.readNumber(8);
            const stop = kind === 3 ? ` stop=${br.readBit()}` : "";
            atoms.push(
              `${kind === 0 ? "snap_to" : "move_to"} t${ref.typeId}#${ref.typeIndex} #${index}${stop}`
            );
            break;
          }
          case 7: {
            const channel = br.readNumber(32) >>> 0;
            const values: number[] = [];
            for (let v = 0; v < 4; v++) {
              const buf = Buffer.alloc(4);
              buf.writeUInt32BE(br.readNumber(32) >>> 0);
              values.push(buf.readFloatBE(0));
            }
            atoms.push(`set_channel ${channel.toString(16)} [${values}]`);
            break;
          }
          case 9: {
            const name = br.readNumber(32) >>> 0;
            const argument = br.readNumber(32) >>> 0;
            br.readNumber(32);
            liveAh().SensorClientRef.decode(br);
            br.readNumber(3);
            br.readNumber(8);
            atoms.push(`ability ${name.toString(16)} ${argument.toString(16)}`);
            break;
          }
          default:
            atoms.push(`kind ${kind}`);
        }
      }
    }
    const drop = br.readBit()
      ? (() => {
          const count = br.readNumber(4);
          const refs: number[] = [];
          for (let i = 0; i < count; i++) {
            refs.push(liveAh().SensorClientRef.decode(br).typeIndex);
          }
          return { refs, id: br.readNumber(31) };
        })()
      : undefined;
    return { atoms, behaviour, cookie, drop, place };
  }

  function ketch(ticks: number) {
    const { host, rows } = missionHost(MISSION, HIGHWAY, 0);
    host.notePlayerSpawned();
    for (let i = 0; i < 3; i++) {
      host.tick();
    }
    host.setActiveBundles(loadedBundles(MISSION, 12, 0) ?? new Set());
    host.runReadyThreads();
    host.tick();
    rows.takeDirty();
    host.noteTriggerFired(GRAVEYARD, PT_KETCH);
    const sent: { tick: number; key: string; body: Buffer }[] = [];
    for (let tick = 1; tick <= ticks; tick++) {
      host.tick();
      for (const { clientRef: r, authBody } of rows.takeDirty()) {
        if (r.bundle === GRAVEYARD) {
          sent.push({
            tick,
            key: `t${r.typeId}#${r.typeIndex}`,
            body: authBody ?? Buffer.alloc(0),
          });
        }
      }
    }
    return sent;
  }

  it("places each pilot with its script as the cinematic starts, ship 1 first", () => {
    const sent = ketch(8);
    const cinematic = sent.find((e) => e.key === "t6#22")!.tick;
    const first = (key: string) => sent.find((e) => e.key === key)!;
    expect(first(`t2#${PILOT_1}`).tick).toBe(cinematic);
    expect(first("t2#9").tick).toBe(cinematic + 1);
    expect(first("t2#7").tick).toBe(cinematic + 2);
    expect(first(`t2#${PILOT_4}`).tick).toBe(cinematic + 3);
    expect(pilotBody(first(`t2#${PILOT_1}`).body)).toEqual({
      atoms: [
        "snap_to t56#76 #0",
        "ability 7ebf354 4b6a2c60",
        "move_to t56#76 #1 stop=1",
        "set_channel 80296344 [1,1,1,1]",
      ],
      behaviour: false,
      cookie: 1,
      drop: undefined,
      place: true,
    });
    // Ships 2 and 3 hover: no stop, a second ability, no doors.
    expect(pilotBody(first("t2#9").body).atoms).toEqual([
      "snap_to t56#80 #0",
      "ability 7ebf354 4b6a2c60",
      "move_to t56#80 #1 stop=0",
      "ability 7ebf354 7b0d3643",
    ]);
  });

  it("drops the cargo 9 s after the script and leaves 5 s after that", () => {
    const sent = ketch(26);
    const cinematic = sent.find((e) => e.key === "t6#22")!.tick;
    const pilot = sent.filter((e) => e.key === `t2#${PILOT_1}`);
    expect(pilot.map((e) => e.tick)).toEqual([
      cinematic,
      cinematic + 9,
      cinematic + 14,
    ]);
    expect(pilotBody(pilot[1]!.body).drop).toEqual({ refs: [14], id: 1 });
    const leave = pilotBody(pilot[2]!.body);
    expect(leave.cookie).toBe(2);
    expect(leave.atoms).toEqual([
      "set_channel 80296344 [0,0,0,0]",
      "move_to t56#77 #0 stop=0",
      "ability 7ebf354 1e35df11",
    ]);
    const ship4 = sent.filter((e) => e.key === `t2#${PILOT_4}`);
    expect(pilotBody(ship4[1]!.body).drop?.refs.sort()).toEqual([15, 16]);
  });
});

function bitsOf(body: FinishedBits): string {
  let out = "";
  for (let i = 0; i < body.bitCount; i++) {
    out += (body.bytes[i >> 3]! >> (7 - (i & 7))) & 1;
  }
  return out;
}

// The rows in the update that starts the intro (2.3.1 capture), past their
// two frame bits. The 2.3.1 client refs carry a 7-bit type where this build's
// have 6, and it adds members after these, so the members around the (unset)
// ref are compared.
const UNSET_REF_BITS = 54;

describeWithPackages(
  "act_cosmo_m0_highway intro rows against the captured bits",
  () => {
    it("starts pf_104_res as captured (start tick 210, generation 2)", () => {
      const ours = bitsOf(encodeCinematicAuth(2, 210));
      // Start tick 210 (bias 2^31), generation 2, playing, [3] false.
      expect(ours.slice(0, 66)).toBe(
        "10000000000000000000000011010010" +
          "00000000000000000000000000000010" +
          "10"
      );
      // [5] raw 2, two empty lists, [8] 0: the capture's last 46 bits.
      expect(ours.slice(66 + UNSET_REF_BITS)).toBe(
        `00001000000000${"0".repeat(32)}`
      );
    });

    // The answer to cinematic_skip (2.3.1 capture).
    it("answers a skip as captured (generation 3, stopped, the skipper)", () => {
      const ours = bitsOf(
        encodeCinematicAuth(3, 210, [0x20_00_00_00_0e_f9_9f_64n])
      );
      expect(ours.slice(0, 66)).toBe(
        "10000000000000000000000011010010" +
          "00000000000000000000000000000011" +
          "00"
      );
      expect(ours.slice(66 + UNSET_REF_BITS)).toBe(
        "000010" +
          "00001" +
          "0010000000000000000000000000000000001110111110011001111101100100" +
          "000" +
          "0".repeat(32)
      );
    });

    it("creates skeleton_static_1 as captured (generation 1, present)", () => {
      const ours = bitsOf(encodeObjectAuth(1, true));
      expect(ours.slice(0, 33)).toBe(`${"1".padEnd(31, "0")}11`);
    });

    it("sends the lifetime's captured members at pregame", () => {
      const auth = decode(
        liveAh().LifetimeAuth,
        encodeLifetimeAuth(
          1,
          true,
          { bubble: 14, hash: 0x00_bc_0b_b1, index: 0 },
          { instance: 64_054, timeOfDay: 0.77, timeOfDayLocked: true }
        ).bytes
      );
      expect(auth).toMatchObject({
        field4: 14,
        flag1: true,
        phaseIndex: 0,
        state: 1,
        unknown6: 64_054,
        unknown7: -1,
        timeOfDayLocked: true,
      });
      expect(auth.phaseHash >>> 0).toBe(0x00_bc_0b_b1);
      expect(auth.unknown8 >>> 0).toBe(0x81_1c_9d_c5);
      expect(auth.timeOfDay).toBeCloseTo(0.77, 5);
    });
  }
);

// The hangar's mission 6 "sq_m0_fallen_2 up" gate has to read the squad's
// alive_count() from the per-cell death tally, not the client's [3] alone,
// which only counts members at their firing area (the Fallen die on the way in
// and it never rises above 0). The client sends the per-cell death tally with
// its first sense of the squad and bumps a cell per death; the host reads
// roster minus tally.
describeWithPackages("the hangar twice in one process (console run 20)", () => {
  const HANGAR = 0x06_2d_d9_5d;
  const MISSION_BUNDLE = 0x99_2b_b4_71;
  const PT_FALLEN_SHIP = 17;
  const PT_MAIN_ROOM = 16;
  const PT_FALLEN_BACKUP = 18;
  const M04A_TRIGGER = 41;
  const SQ_SHIP = [8, 9, 10];
  const SQ_FALLEN_1 = 11;
  const SQ_FALLEN_2 = 12;
  const HANGAR_PHASE = 5;

  // Mission 6 from the hangar, driven as the client does: the triggers in
  // the captured order, every squad's tally with its first sense and a cell per
  // death, and never a firing-area count. Returns the tick each step landed
  // on and the host's lines.
  function playHangar() {
    const { host, lines, rows } = missionHost(MISSION, 13, 0, HANGAR_PHASE);
    host.notePlayerSpawned();
    const ticks: Record<string, number> = {};
    let tick = 0;
    const step = (name: string, when: () => boolean) => {
      while (!when()) {
        host.tick();
        rows.takeDirty();
        tick += 1;
        if (tick > 120) {
          throw new Error(`${name} never came (tick ${tick})`);
        }
      }
      ticks[name] = tick;
    };
    const said = (pattern: RegExp) => lines.some((line) => pattern.test(line));
    for (const squad of [...SQ_SHIP, SQ_FALLEN_1, SQ_FALLEN_2]) {
      host.noteSquadTally(HANGAR, squad, squad === SQ_FALLEN_2 ? [0, 0] : [0]);
    }
    step("m04a armed", () =>
      said(/obj_m0_m04a._player_trigger t29#41 trigger armed/)
    );
    host.noteTriggerFired(MISSION_BUNDLE, M04A_TRIGGER);
    step("m04a cleared", () =>
      said(/obj_m0_m04a._player_objective t32#23 player objective cleared/)
    );
    host.noteTriggerFired(HANGAR, PT_FALLEN_SHIP);
    host.noteTriggerFired(HANGAR, PT_MAIN_ROOM);
    // Their script's counts (@member_counts): [3] and [1, 2].
    step("fallen_1 placed", () => said(/sq_m0_fallen_1 t1#11 bodies=3/));
    host.noteTriggerFired(HANGAR, PT_FALLEN_BACKUP);
    step("fallen_2 placed", () => said(/sq_m0_fallen_2 t1#12 bodies=3/));
    // Two ticks on, every Fallen is dead without reaching its area: each
    // death bumps its own cell of the tally.
    host.tick();
    rows.takeDirty();
    tick += 1;
    for (const squad of SQ_SHIP) {
      host.noteSquadTally(HANGAR, squad, [1]);
    }
    host.noteSquadTally(HANGAR, SQ_FALLEN_1, [3]);
    host.noteSquadTally(HANGAR, SQ_FALLEN_2, [1, 2]);
    ticks["all dead"] = tick;
    step("m04b cleared", () =>
      said(/obj_m0_m04b._player_objective t32#26 player objective cleared/)
    );
    step("mission 7", () =>
      said(/mission act_cosmo_m0_highway_mission7 starting/)
    );
    return { lines, ticks };
  }

  it("ends the hangar on the death tally with no firing-area count reported", () => {
    const { lines, ticks } = playHangar();
    expect(ticks["mission 7"]).toBeGreaterThan(ticks["fallen_2 placed"]);
    // The gate passed on the placement, not on a report that never came.
    expect(lines.some((line) => /alive d+ (reported)/.test(line))).toBe(false);
    expect(lines.some((line) => /thread main has waited/.test(line))).toBe(
      false
    );
    // obj_m0_m04b clears 8 ticks after the last death (2.3.1 capture: 6.8-7.2 s):
    // the gate sees the tally on the next tick, the 6 s sleep, the end.
    expect(ticks["m04b cleared"] - ticks["all dead"]).toBe(8);
  });

  it("plays the same way the second time in one process", () => {
    const first = playHangar();
    const second = playHangar();
    expect(second.ticks).toEqual(first.ticks);
    const rowLines = (lines: string[]) =>
      lines.filter((line) => / td+#d+ /.test(line));
    expect(rowLines(second.lines)).toEqual(rowLines(first.lines));
  });
});
