import type { ItemChange } from "@blamnetwork/bullshcript/destiny1/common";
import { BitReader, decode } from "@blamnetwork/rsat";
import { expect, it } from "vitest";
import { activityBinder, bundleTags } from "../../content";
import { describeWithPackages } from "../../test-support/build";
import {
  encodeTimerAuth,
  PlayerObjectiveState,
} from "../rsat/sensor-auth-fields";
import { liveAh } from "../versions/v41375_14_07_03_1501_live/live-ah";
import { ItemSink } from "./item-sink";

const BREACH = 0xfc_0e_45_a3 | 0;
const MISSION = 0x99_2b_b4_71 | 0;
const STORY_COMMON = 0x47_86_c0_e0 | 0;
const SQUAD = 1;
const ACTOR = 2;
const OBJECT = 4;
const TIMER = 17;
const HOP_ON = 24;
const TRIGGER_GROUP = 30;
const PLAYER_OBJECTIVE = 32;
const OBJECT_FILTER = 33;
const MACHINE = 40;
const CONTROL_POINT = 56;
const TRIGGER_VOLUME = 58;
const GRAVEYARD = 0x92_43_df_fb | 0;

function breachSink() {
  return new ItemSink(bundleTags("act_cosmo_m0_highway"), () => {
    // the sink's notes are not under test
  });
}

// sq_fallen_nest1__dropper1 placed, as enc_breach_m0 does as its bubble
// comes up.
const placeNestActor: ItemChange = {
  item: { bundle: BREACH, typeId: ACTOR, typeIndex: 78 },
  kind: "actor",
  state: { placed: true },
};

// obj_investigate_wall active with its nav point.
const wallObjective: ItemChange = {
  item: { bundle: MISSION, typeId: PLAYER_OBJECTIVE, typeIndex: 7 },
  kind: "playerObjective",
  state: {
    navPoints: [{ sliceSet: 3, x: 392.1, y: -773.4, z: 17.3 }],
    participants: 1,
    state: PlayerObjectiveState.Active,
  },
};

const keyOf = (entry: { clientRef: { typeId: number; typeIndex: number } }) =>
  `t${entry.clientRef.typeId}#${entry.clientRef.typeIndex}`;

describeWithPackages("ItemSink while a hard wipe holds respawns", () => {
  const TOWER = "city_tower_default1";
  const binder = activityBinder(TOWER);
  if (!binder) {
    throw new Error("no Tower binder");
  }
  const CHARACTER = 0x2_00_00_00_08n;
  const dead = {
    unknown0: 0,
    unknown1: 0,
    unknown2: false,
    unknown3: false,
    unknown4: true,
    unknown5: 0,
    unknown6: 0,
  };
  const asking = {
    unknown0: 0,
    unknown1: true,
    unknown2: false,
    unknown3: false,
  };

  function requestOf(sink: ItemSink) {
    const entries = sink.takeDirty();
    const entry = entries.find(
      (e) => e.clientRef.typeIndex === binder?.players[0]
    );
    if (!entry?.authBody) {
      return;
    }
    const auth = decode(liveAh().PlayerAuth, entry.authBody);
    return auth.unknown1.unknown1;
  }

  it("echoes a dead client's request to respawn until the wipe holds it back", () => {
    const sink = new ItemSink(bundleTags(TOWER), () => undefined);
    sink.bindPlayers(binder.bundle, binder.players);
    sink.setOccupants(new Map([[0, CHARACTER]]));
    sink.notePlayerState(binder.players[0], dead, asking);
    expect(requestOf(sink)).toBe(true);
    sink.holdRespawns(true);
    expect(requestOf(sink)).toBe(false);
    // a world entry in the meantime says the same
    expect(sink.players().occupants.get(0)?.state2).toMatchObject({
      unknown1: false,
    });
    sink.holdRespawns(false);
    expect(requestOf(sink)).toBe(true);
  });

  it("names the character a player row holds", () => {
    const sink = new ItemSink(bundleTags(TOWER), () => undefined);
    sink.bindPlayers(binder.bundle, binder.players);
    sink.setOccupants(new Map([[0, CHARACTER]]));
    expect(sink.occupantKey(binder.players[0])).toBe(CHARACTER);
    expect(sink.occupantKey(binder.players[1])).toBeUndefined();
  });
});

describeWithPackages("ItemSink clear", () => {
  // A hard wipe puts a row back to untouched: the written body is dropped and
  // the row goes out again as its idle one.
  it("sends a cleared row as its idle body, and not as scripted", () => {
    const sink = breachSink();
    sink.apply(wallObjective);
    const written = sink.takeDirty();
    expect(written.map(keyOf)).toEqual([`t${PLAYER_OBJECTIVE}#7`]);
    sink.clear([wallObjective.item]);
    expect(sink.entries().map(keyOf)).not.toContain(`t${PLAYER_OBJECTIVE}#7`);
    sink.clear([wallObjective.item]);
    const idle = sink.takeDirty();
    expect(idle.map(keyOf)).toEqual([`t${PLAYER_OBJECTIVE}#7`]);
    expect(idle[0].authBody).toBeDefined();
    expect(Buffer.from(idle[0].authBody ?? [])).not.toEqual(
      Buffer.from(written[0].authBody ?? [])
    );
    // written again, it is the scripts' once more
    sink.apply(wallObjective);
    expect(sink.takeDirty()[0].authBody).toEqual(written[0].authBody);
  });
});

describeWithPackages("ItemSink debug toggles", () => {
  it("withholds the row types the toggles name, never the lifetime", () => {
    const sink = breachSink();
    sink.setDebugToggles({ omitScriptRowTypes: [SQUAD, ACTOR, 16] });
    sink.apply(placeNestActor);
    sink.apply(wallObjective);
    const keys = sink.entries().map(keyOf);
    expect(keys).not.toContain(`t${ACTOR}#78`);
    expect(keys).not.toContain(`t${SQUAD}#77`);
    expect(keys).toContain(`t${PLAYER_OBJECTIVE}#7`);
    sink.apply(placeNestActor);
    expect(sink.takeDirty().map(keyOf)).toEqual([]);
    expect(sink.hasDirty()).toBe(false);
  });

  it("sends the nest actor and its squad when nothing is withheld", () => {
    const sink = breachSink();
    sink.apply(placeNestActor);
    expect(sink.entries().map(keyOf)).toEqual([`t${SQUAD}#77`, `t${ACTOR}#78`]);
  });

  // enc_hangar_m0 gives every squad obj_m0_hangar_fallen as it comes up and
  // a task with its placement: sq_m0_fallen_gating goes out with ref0 t3#4
  // and task 2 ("gating"), roster [1, 1, 1] (2.3.1 capture).
  it("carries a squad's objective and task as the captured hangar squads do", () => {
    const HANGAR = 0x06_2d_d9_5d | 0;
    const sink = breachSink();
    const gating = { bundle: HANGAR, typeId: SQUAD, typeIndex: 7 };
    sink.apply({
      item: gating,
      kind: "squad",
      state: {
        carried: false,
        objective: { bundle: HANGAR, typeId: 3, typeIndex: 4 },
        wave: 0,
      },
    });
    const auth = () => {
      const entry = sink
        .entries()
        .find((candidate) => keyOf(candidate) === `t${SQUAD}#7`);
      return liveAh().SquadAuth.decode(
        new BitReader(entry?.authBody ?? Buffer.alloc(0))
      );
    };
    // Before its placement: the objective, no task, an empty roster - the
    // idle body a world entry carries for every fallen squad (2.3.1 capture).
    const idle = auth();
    expect(idle.ref0).toEqual({ bundle: HANGAR, typeId: 3, typeIndex: 4 });
    expect([idle.task, idle.roster]).toEqual([-1, { slots: [0, 0, 0] }]);
    sink.apply({
      item: gating,
      kind: "squad",
      state: {
        bodies: 3,
        carried: false,
        objective: { bundle: HANGAR, typeId: 3, typeIndex: 4 },
        task: 2,
        taskInfluencer: 3,
        wave: 0,
      },
    });
    const placed = auth();
    expect([placed.task, placed.unknown9]).toEqual([2, 3]);
    expect(placed.roster).toEqual({ slots: [1, 1, 1] });
  });

  // The scripts' @objective is the squad's ref0 until a script sets another.
  it("falls back to the scripts' @objective, and a set_objective wins", () => {
    const HANGAR = 0x06_2d_d9_5d | 0;
    const sink = breachSink();
    sink.bindSquadObjectives((bundle, typeIndex) =>
      bundle === HANGAR && typeIndex === 7
        ? { bundle: HANGAR, typeIndex: 4 }
        : undefined
    );
    const squad = { bundle: HANGAR, typeId: SQUAD, typeIndex: 7 };
    const ref0 = () => {
      const entry = sink
        .entries()
        .find((candidate) => keyOf(candidate) === `t${SQUAD}#7`);
      return liveAh().SquadAuth.decode(
        new BitReader(entry?.authBody ?? Buffer.alloc(0))
      ).ref0;
    };
    sink.apply({
      item: squad,
      kind: "squad",
      state: { carried: false, wave: 0 },
    });
    expect(ref0()).toEqual({ bundle: HANGAR, typeId: 3, typeIndex: 4 });
    sink.apply({
      item: squad,
      kind: "squad",
      state: {
        carried: false,
        objective: { bundle: HANGAR, typeId: 3, typeIndex: 9 },
        wave: 0,
      },
    });
    expect(ref0()).toEqual({ bundle: HANGAR, typeId: 3, typeIndex: 9 });
  });

  // A squad whose script authors its counts (@member_counts) goes out with
  // its own roster; any other count is spread over the cells, the first
  // taking the remainder.
  it("sends a script's authored roster per cell, else spreads the bodies", () => {
    const HANGAR = 0x06_2d_d9_5d | 0;
    const rosterFor = (bodies: number, roster?: number[]) => {
      const sink = breachSink();
      sink.apply({
        item: { bundle: HANGAR, typeId: SQUAD, typeIndex: 12 },
        kind: "squad",
        state: { bodies, carried: false, roster, wave: 0 },
      });
      const entry = sink
        .entries()
        .find((candidate) => keyOf(candidate) === `t${SQUAD}#12`);
      return liveAh().SquadAuth.decode(
        new BitReader(entry?.authBody ?? Buffer.alloc(0))
      ).roster?.slots;
    };
    expect(rosterFor(3, [1, 2])).toEqual([1, 2]);
    expect(rosterFor(3)).toEqual([2, 1]);
    expect(rosterFor(2)).toEqual([1, 1]);
  });

  // sq_fallen_nest1's first cell is its named dropper: once the dropper's own
  // ActorAuth places it, the cell asks for no anonymous body.
  it("asks no anonymous body for a named member placed by its own auth", () => {
    const sink = breachSink();
    const squad = { bundle: BREACH, typeId: SQUAD, typeIndex: 77 };
    const roster = () => {
      const entry = sink
        .entries()
        .find((candidate) => keyOf(candidate) === `t${SQUAD}#77`);
      return liveAh()
        .SquadAuth.decode(new BitReader(entry?.authBody ?? Buffer.alloc(0)))
        .roster?.slots.slice(0, 1);
    };
    sink.apply({
      item: squad,
      kind: "squad",
      state: { bodies: 1, carried: false, wave: 0 },
    });
    expect(roster()).toEqual([1]);
    sink.apply(placeNestActor);
    expect(roster()).toEqual([0]);
  });

  it("strips the nav point slots from objectives when asked", () => {
    const withNavs = breachSink();
    withNavs.apply(wallObjective);
    const stripped = breachSink();
    stripped.setDebugToggles({ stripNavPoints: true });
    stripped.apply(wallObjective);
    const bits = (sink: ItemSink) =>
      sink.entries().find((entry) => keyOf(entry) === `t${PLAYER_OBJECTIVE}#7`)
        ?.authBits ?? 0;
    // Ten slots of a ref, a bubble, a position and another ref each; the
    // other members are about 260 bits.
    expect(bits(withNavs)).toBeGreaterThan(2000);
    expect(bits(stripped)).toBeLessThan(400);
  });

  it("shapes a placed actor as captured only under the toggle", () => {
    const bare = breachSink();
    bare.apply(placeNestActor);
    const placed = breachSink();
    placed.setDebugToggles({ actorPlaceBody: "retail" });
    placed.apply(placeNestActor);
    const actor = (sink: ItemSink) => {
      const entry = sink
        .entries()
        .find((candidate) => keyOf(candidate) === `t${ACTOR}#78`);
      return liveAh().ActorAuth.decode(
        new BitReader(entry?.authBody ?? Buffer.alloc(0))
      );
    };
    const bareActor = actor(bare);
    expect([bareActor.place, bareActor.killEpoch, bareActor.behaviour]).toEqual(
      [true, undefined, undefined]
    );
    const capturedActor = actor(placed);
    expect([
      capturedActor.place,
      capturedActor.killEpoch,
      capturedActor.killed,
    ]).toEqual([true, 1, 0]);
    expect(capturedActor.behaviour?.unknown0).toBe(1);
  });
});

// The Ghost's light-up in the breach: the rows written beside the objects, in
// the shapes of the 2.3.1 capture.
describeWithPackages("ItemSink breach light-up rows", () => {
  function bodyOf(sink: ItemSink, typeId: number, typeIndex: number) {
    const entry = sink
      .takeDirty()
      .find(
        ({ clientRef: r }) => r.typeId === typeId && r.typeIndex === typeIndex
      );
    return new BitReader(entry?.authBody ?? Buffer.alloc(0));
  }

  // The lifetime_timer at the end of act_cosmo_m0_highway: running from the
  // update's tick, min and max 0, rate 1, no bar (2.3.1 capture).
  it("sends the binder's lifetime_timer running with 0 to count", () => {
    const sink = breachSink();
    sink.apply({
      item: { bundle: STORY_COMMON, typeId: TIMER, typeIndex: 2 },
      kind: "timer",
      state: {
        running: { progressBar: false, rate: 1, seconds: 0, startedAt: 5024 },
      },
    });
    expect(liveAh().TimerAuth.decode(bodyOf(sink, TIMER, 2))).toEqual({
      options: {
        unknown0: true,
        unknown1: 0,
        unknown2: 0,
        unknown3: 0,
        unknown4: 0,
        unknown5: 5024,
        unknown6: 1,
      },
      progressBar: false,
      barOffsetSeconds: 0,
    });
  });

  it("idles a timer as captured: stopped, INT_MIN..INT_MAX, rate 1", () => {
    expect(
      liveAh().TimerAuth.decode(new BitReader(encodeTimerAuth().bytes))
    ).toEqual({
      options: {
        unknown0: false,
        unknown1: -2_147_483_648,
        unknown2: 2_147_483_647,
        unknown3: 0,
        unknown4: 0,
        unknown5: 0,
        unknown6: 1,
      },
      progressBar: false,
      barOffsetSeconds: 0,
    });
  });

  it("refs tg_m0_gating's volume sv_m0_gating beside the state a script set", () => {
    const sink = breachSink();
    sink.apply({
      item: { bundle: MISSION, typeId: TRIGGER_GROUP, typeIndex: 36 },
      kind: "triggerGroup",
      state: { state: 1 },
    });
    const br = bodyOf(sink, TRIGGER_GROUP, 36);
    expect(liveAh().SensorClientRef.decode(br)).toEqual({
      bundle: MISSION,
      typeId: TRIGGER_VOLUME,
      typeIndex: 54,
    });
    expect(br.readNumber(2) - 1).toBe(1);
  });

  it("points ho_ghostlight at of_ghostlight, then at nothing", () => {
    const sink = breachSink();
    const filter = { bundle: BREACH, typeId: OBJECT_FILTER, typeIndex: 124 };
    sink.apply({
      item: { bundle: BREACH, typeId: HOP_ON, typeIndex: 101 },
      kind: "hopOn",
      state: { filter },
    });
    let br = bodyOf(sink, HOP_ON, 101);
    expect(br.readBit()).toBe(0);
    expect(br.readNumber(32) >>> 0).toBe(0x80_00_00_00);
    expect(liveAh().SensorClientRef.decode(br)).toEqual(filter);
    sink.apply({
      item: { bundle: BREACH, typeId: HOP_ON, typeIndex: 101 },
      kind: "hopOn",
      state: {},
    });
    br = bodyOf(sink, HOP_ON, 101);
    br.readBit();
    br.readNumber(32);
    expect(liveAh().SensorClientRef.decode(br).typeIndex).toBe(-1);
  });

  it("puts the Ghost on of_ghostlight as a single-row predicate", () => {
    const sink = breachSink();
    const ghost = { bundle: BREACH, typeId: ACTOR, typeIndex: 95 };
    sink.apply({
      item: { bundle: BREACH, typeId: OBJECT_FILTER, typeIndex: 124 },
      kind: "objectFilter",
      state: { predicates: [{ kind: "slotObject", item: ghost }] },
    });
    const br = bodyOf(sink, OBJECT_FILTER, 124);
    expect(br.readNumber(4)).toBe(1);
    expect(br.readBit()).toBe(1);
    expect(br.readNumber(32) >>> 0).toBe(
      liveAh().ObjectFilterRowPredicate.hash
    );
    expect(liveAh().ObjectFilterRowPredicate.decode(br)).toEqual({
      mode: 0,
      item: ghost,
    });
  });

  // of_ultra_servitor.add(sq_bossbattle_boss01): the squad form, naming the
  // Squad row (2.3.1 capture), not a row predicate and not left out.
  it("puts a squad on a filter as a squad-members predicate", () => {
    const sink = breachSink();
    const servitor = { bundle: BREACH, typeId: SQUAD, typeIndex: 3 };
    sink.apply({
      item: { bundle: BREACH, typeId: OBJECT_FILTER, typeIndex: 124 },
      kind: "objectFilter",
      state: { predicates: [{ kind: "squadMembers", item: servitor }] },
    });
    const br = bodyOf(sink, OBJECT_FILTER, 124);
    expect(br.readNumber(4)).toBe(1);
    expect(br.readBit()).toBe(1);
    expect(br.readNumber(32) >>> 0).toBe(
      liveAh().ObjectFilterSquadMembersPredicate.hash
    );
    expect(liveAh().ObjectFilterSquadMembersPredicate.decode(br)).toEqual({
      mode: 0,
      item: servitor,
    });
  });

  // This build has a schema for the row, squad-members and activity flag
  // predicates only, and none for taking matches out.
  it("leaves out the filter predicates it has no class for", () => {
    const sink = breachSink();
    const ghost = { bundle: BREACH, typeId: ACTOR, typeIndex: 95 };
    const squad = { bundle: BREACH, typeId: SQUAD, typeIndex: 3 };
    sink.apply({
      item: { bundle: BREACH, typeId: OBJECT_FILTER, typeIndex: 124 },
      kind: "objectFilter",
      state: {
        predicates: [
          { kind: "combatantType", typeNameHash: 0x3e_a0_3d_56 },
          { kind: "slotObject", item: ghost, remove: true },
          { kind: "squadMembers", item: squad, remove: true },
          { kind: "playersOnTeam", teamIndex: 1 },
        ],
      },
    });
    expect(bodyOf(sink, OBJECT_FILTER, 124).readNumber(4)).toBe(0);
  });

  it("carries a driven device as the object's one component, powered", () => {
    const sink = breachSink();
    sink.apply({
      item: { bundle: BREACH, typeId: OBJECT, typeIndex: 4 },
      kind: "object",
      state: { incarnation: 1, present: true },
    });
    let br = bodyOf(sink, OBJECT, 4);
    br.readNumber(32);
    br.readBit();
    liveAh().SensorClientRef.decode(br);
    expect(br.readNumber(2)).toBe(0);
    sink.apply({
      item: { bundle: BREACH, typeId: OBJECT, typeIndex: 4 },
      kind: "object",
      state: {
        device: { position: 1, revision: 1 },
        incarnation: 1,
        present: true,
      },
    });
    br = bodyOf(sink, OBJECT, 4);
    expect(br.readNumber(32) >>> 0).toBe(0x80_00_00_01);
    expect(br.readBit()).toBe(1);
    liveAh().SensorClientRef.decode(br);
    expect(br.readNumber(2)).toBe(1);
    expect(br.readBit()).toBe(1);
    expect(br.readNumber(32) >>> 0).toBe(liveAh().ObjectDeviceComponent.hash);
    expect(liveAh().ObjectDeviceComponent.decode(br)).toEqual({
      powerStamp: 0,
      unknown1: 0,
      power: 1,
      lockStamp: 0,
      unknown4: 0,
      lock: 0,
      positionStamp: 1,
      unknown7: 0,
      position: 1,
    });
  });
});

// Machine rows (type 40) and command scripts, in the shapes of the 2.3.1
// capture.
describeWithPackages("ItemSink machines and command scripts", () => {
  function bodyOf(sink: ItemSink, typeId: number, typeIndex: number) {
    const entry = sink
      .entries()
      .find((candidate) => keyOf(candidate) === `t${typeId}#${typeIndex}`);
    return new BitReader(entry?.authBody ?? Buffer.alloc(0));
  }

  it("names the Ghost's performance with complete_action and lists its cues", () => {
    const sink = breachSink();
    sink.apply({
      item: { bundle: BREACH, typeId: MACHINE, typeIndex: 125 },
      kind: "machine",
      state: {
        cues: [0x10_0e_2b_1d, 0x7a_3e_66_d9],
        performance: { generation: 1, name: 0x9b_1d_6a_71 },
      },
    });
    const br = bodyOf(sink, MACHINE, 125);
    expect(br.readBit()).toBe(1);
    expect(br.readNumber(32) >>> 0).toBe(0x9b_1d_6a_71);
    expect(br.readNumber(32) >>> 0).toBe(0x9a_5f_60_c9);
    expect((br.readNumber(32) >>> 0) - 0x80_00_00_00).toBe(1);
    expect(br.readBit()).toBe(1);
    expect(br.readNumber(3)).toBe(2);
    expect(br.readNumber(32) >>> 0).toBe(0x81_1c_9d_c5);
    expect(br.readNumber(32) >>> 0).toBe(0x10_0e_2b_1d);
    expect(br.readNumber(32) >>> 0).toBe(0x81_1c_9d_c5);
    expect(br.readNumber(32) >>> 0).toBe(0x7a_3e_66_d9);
  });

  it("places a dropship pilot with its fly-in script, atom by atom as captured", () => {
    const sink = breachSink();
    const path = { bundle: GRAVEYARD, typeId: CONTROL_POINT, typeIndex: 76 };
    sink.apply({
      item: { bundle: GRAVEYARD, typeId: ACTOR, typeIndex: 5 },
      kind: "actor",
      state: {
        placed: true,
        commandScript: {
          cookie: 1,
          atoms: [
            { kind: 0, point: path, index: 0, end: { kind: 0 } },
            {
              kind: 9,
              name: 0x07_eb_f3_54,
              argument: 0x4b_6a_2c_60,
              slot: -1,
              index: 0,
              end: { kind: 0 },
            },
            { kind: 3, point: path, index: 1, stop: true, end: { kind: 0 } },
            {
              kind: 7,
              channel: 0x80_29_63_44,
              values: [1, 1, 1, 1],
              end: { kind: 0 },
            },
          ],
        },
      },
    });
    const br = bodyOf(sink, ACTOR, 5);
    expect(br.readBit()).toBe(0);
    expect([br.readNumber(2), br.readNumber(3), br.readBit()]).toEqual([
      1, 1, 1,
    ]);
    expect(br.readBit()).toBe(0);
    expect(br.readBit()).toBe(1);
    expect([br.readNumber(31), br.readNumber(6), br.readNumber(6)]).toEqual([
      1, 0, 4,
    ]);
    const ref = () => {
      const r = liveAh().SensorClientRef.decode(br);
      return `${(r.bundle >>> 0).toString(16)}:t${r.typeId}#${r.typeIndex}`;
    };
    // snap_to the path's point 0.
    expect([br.readBit(), br.readNumber(4), br.readNumber(2)]).toEqual([
      1, 1, 1,
    ]);
    expect(ref()).toBe("9243dffb:t56#76");
    expect(br.readNumber(8)).toBe(0);
    // ability dropship / 4B6A2C60 / empty, no point, any slot, index 0.
    expect([br.readBit(), br.readNumber(4), br.readNumber(2)]).toEqual([
      1, 10, 1,
    ]);
    expect(br.readNumber(32) >>> 0).toBe(0x07_eb_f3_54);
    expect(br.readNumber(32) >>> 0).toBe(0x4b_6a_2c_60);
    expect(br.readNumber(32) >>> 0).toBe(0x81_1c_9d_c5);
    expect(liveAh().SensorClientRef.decode(br).typeId).toBe(-1);
    expect([br.readNumber(3), br.readNumber(8)]).toEqual([0, 0x80]);
    // move to point 1 and stop.
    expect([br.readBit(), br.readNumber(4), br.readNumber(2)]).toEqual([
      1, 4, 1,
    ]);
    expect(ref()).toBe("9243dffb:t56#76");
    expect([br.readNumber(8), br.readBit()]).toEqual([1, 1]);
    // doors channel, four 1.0s.
    expect([br.readBit(), br.readNumber(4), br.readNumber(2)]).toEqual([
      1, 8, 1,
    ]);
    expect(br.readNumber(32) >>> 0).toBe(0x80_29_63_44);
    for (let i = 0; i < 4; i++) {
      expect(br.readNumber(32) >>> 0).toBe(0x3f_80_00_00);
    }
    // No drop.
    expect(br.readBit()).toBe(0);
  });

  it("encodes an actor without a script as the schema does", () => {
    const sink = breachSink();
    sink.apply(placeNestActor);
    const br = bodyOf(sink, ACTOR, 78);
    expect(liveAh().ActorAuth.decode(br)).toMatchObject({
      place: true,
      killed: 0,
      carried: 0,
    });
  });
});

// The refinery's hack console (cosmo_portal_1): its object carries a
// mission-interactable component gated on its ObjectFilter, the filter one
// players-with-activity-flag predicate, and every player row the flag while
// the scan objective is active (2.3.1 capture).
describeWithPackages("ItemSink interactable and activity flag rows", () => {
  const STRIKE = "cosmo_portal_1";
  const REFINERY = 0x4c_63_79_2c | 0;
  const CONSOLE = 66;
  const CONSOLE_FILTER = 67;
  const SCAN_FLAG = 0x1c_45_0a_3d;

  function strikeSink() {
    return new ItemSink(bundleTags(STRIKE), () => {
      // the sink's notes are not under test
    });
  }

  function bodyOf(sink: ItemSink, typeId: number, typeIndex: number) {
    const entry = sink
      .takeDirty()
      .find(
        ({ clientRef: r }) => r.typeId === typeId && r.typeIndex === typeIndex
      );
    return new BitReader(entry?.authBody ?? Buffer.alloc(0));
  }

  it("gates the console on its filter as the one component", () => {
    const sink = strikeSink();
    sink.apply({
      item: { bundle: REFINERY, typeId: OBJECT, typeIndex: CONSOLE },
      kind: "object",
      state: {
        incarnation: 1,
        interactable: {
          enabled: false,
          filter: {
            bundle: REFINERY,
            typeId: OBJECT_FILTER,
            typeIndex: CONSOLE_FILTER,
          },
          used: { stamp: 0, value: false },
        },
        present: true,
      },
    });
    const br = bodyOf(sink, OBJECT, CONSOLE);
    expect(br.readNumber(32) >>> 0).toBe(0x80_00_00_01);
    expect(br.readBit()).toBe(1);
    liveAh().SensorClientRef.decode(br);
    expect(br.readNumber(2)).toBe(1);
    expect(br.readBit()).toBe(1);
    expect(br.readNumber(32) >>> 0).toBe(
      liveAh().ObjectInteractableComponent.hash
    );
    expect(liveAh().ObjectInteractableComponent.decode(br)).toEqual({
      mode: 1,
      filter: {
        bundle: REFINERY,
        typeId: OBJECT_FILTER,
        typeIndex: CONSOLE_FILTER,
      },
      usedStamp: 0,
      used: false,
    });
  });

  it("sends the interactable ahead of the device, as the captured console", () => {
    const sink = strikeSink();
    sink.apply({
      item: { bundle: REFINERY, typeId: OBJECT, typeIndex: CONSOLE },
      kind: "object",
      state: {
        device: { position: 0.1, revision: 1 },
        incarnation: 1,
        interactable: { enabled: false },
        present: true,
      },
    });
    const br = bodyOf(sink, OBJECT, CONSOLE);
    br.readNumber(32);
    br.readBit();
    liveAh().SensorClientRef.decode(br);
    expect(br.readNumber(2)).toBe(2);
    br.readBit();
    expect(br.readNumber(32) >>> 0).toBe(
      liveAh().ObjectInteractableComponent.hash
    );
    liveAh().ObjectInteractableComponent.decode(br);
    br.readBit();
    expect(br.readNumber(32) >>> 0).toBe(liveAh().ObjectDeviceComponent.hash);
    expect(liveAh().ObjectDeviceComponent.decode(br).position).toBeCloseTo(0.1);
  });

  it("writes a players-with-activity-flag predicate", () => {
    const sink = strikeSink();
    sink.apply({
      item: {
        bundle: REFINERY,
        typeId: OBJECT_FILTER,
        typeIndex: CONSOLE_FILTER,
      },
      kind: "objectFilter",
      state: {
        predicates: [
          { flagNameHash: SCAN_FLAG, kind: "playersWithActivityFlag" },
        ],
      },
    });
    const br = bodyOf(sink, OBJECT_FILTER, CONSOLE_FILTER);
    expect(br.readNumber(4)).toBe(1);
    expect(br.readBit()).toBe(1);
    expect(br.readNumber(32) >>> 0).toBe(
      liveAh().ObjectFilterActivityFlagPredicate.hash
    );
    expect(liveAh().ObjectFilterActivityFlagPredicate.decode(br)).toEqual({
      mode: 0,
      flag: SCAN_FLAG,
    });
  });

  // Every player row is marked as the lifetime goes active (wire 3), and the
  // spawn waits on it: an activity with no intro cinematic must still get it
  // (cosmo_patrols_1).
  it("marks every player row ready when the lifetime goes active", () => {
    const sink = strikeSink();
    const binder = activityBinder(STRIKE);
    if (!binder) {
      throw new Error("no binder");
    }
    sink.bindPlayers(binder.bundle, binder.players);
    sink.setOccupants(new Map([[0, 0x2_00_00_00_01n]]));
    sink.takeDirty();
    sink.apply({
      item: { bundle: binder.bundle, typeId: 16, typeIndex: 3 },
      kind: "lifetime",
      state: { joinFlag: true, state: 2 },
    } as never);
    const rows = sink
      .takeDirty()
      .filter(({ clientRef: r }) => r.typeId === 12)
      .map((entry) =>
        decode(liveAh().PlayerAuth, entry.authBody ?? Buffer.alloc(0))
      );
    expect(rows).toHaveLength(16);
    for (const row of rows) {
      expect(row.identity.unknown1).toBe(1);
    }
  });

  it("puts a raised flag on every player row and takes it off again", () => {
    const sink = strikeSink();
    const binder = activityBinder(STRIKE);
    if (!binder) {
      throw new Error("no binder");
    }
    sink.bindPlayers(binder.bundle, binder.players);
    sink.setOccupants(new Map([[0, 0x2_00_00_00_01n]]));
    sink.takeDirty();
    sink.setActivityFlag(SCAN_FLAG, true);
    const raised = sink
      .takeDirty()
      .filter(({ clientRef: r }) => r.typeId === 12)
      .map((entry) =>
        decode(liveAh().PlayerAuth, entry.authBody ?? Buffer.alloc(0))
      );
    expect(raised).toHaveLength(16);
    for (const row of raised) {
      expect(row.identity.activityFlags.flags).toEqual([SCAN_FLAG]);
    }
    expect(sink.players().activityFlags).toEqual([SCAN_FLAG]);
    // Raising it again changes nothing.
    sink.setActivityFlag(SCAN_FLAG, true);
    expect(sink.takeDirty()).toEqual([]);
    sink.setActivityFlag(SCAN_FLAG, false);
    const cleared = sink
      .takeDirty()
      .filter(({ clientRef: r }) => r.typeId === 12)
      .map((entry) =>
        decode(liveAh().PlayerAuth, entry.authBody ?? Buffer.alloc(0))
      );
    expect(cleared).toHaveLength(16);
    expect(cleared[0]?.identity.activityFlags.flags).toEqual([]);
    expect(cleared[0]?.identity.key).toBe(0x2_00_00_00_01n);
  });
});
