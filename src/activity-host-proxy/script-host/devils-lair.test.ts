// The Devils' Lair (cosmo_portal_1, activities 5/6 and the Vanguard
// playlists): the tables and the authored strike scripts (tiger scripts) on
// them, through the package host. Built from one 2.3.1 capture.
import { BitReader, decode } from "@blamnetwork/rsat";
import { expect, it } from "vitest";
import {
  activityBinder,
  activityBundles,
  activityPhases,
  activityPrivate,
  bubbleSensors,
  loadedBundles,
  worldTags,
} from "../../content";
import { describeWithPackages } from "../../test-support/build";
import { SensorRowState } from "../mission/row-state";
import { liveAh } from "../versions/v41375_14_07_03_1501_live/live-ah";
import type { ItemSink } from "./item-sink";
import { scriptHostFor } from "./runtime";

const STRIKE = "cosmo_portal_1";
const ROOT = 0x3c_3e_c7_28;
const STORY_COMMON = 0x47_86_c0_e0;
const ROCKETYARD = 20;
const REFINERY = 19;
const PLAYER_OBJECTIVE = 32;

function lifetimeOf(sink: ItemSink) {
  return decode(liveAh().LifetimeAuth, sink.lifetimeBody().bytes);
}

// The sensor rows the private world builds in a bubble.
function worldRows(bubble: number): Set<string> {
  return new Set(
    bubbleSensors(worldTags(STRIKE, bubble, "private"), bubble).map(
      (s) => `${s.bundle >>> 0}:${s.typeId}:${s.typeIndex}`
    )
  );
}

// `phase` is the mission the activity resumes at (a debug start; 0 is a
// fresh strike).
function strikeHost(bubble: number, phase = 0) {
  const lines: string[] = [];
  const host = scriptHostFor({
    activityName: STRIKE,
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
  host.setActiveBundles(loadedBundles(STRIKE, bubble) ?? new Set());
  return { host, lines, rows: host.itemSink };
}

describeWithPackages("cosmo_portal_1 tables", () => {
  it("runs eight phases: the rocketyard, three in the refinery, the blast, three in the ship", () => {
    expect(activityPhases(STRIKE).map((phase) => phase.bubble)).toEqual([
      20, 19, 19, 19, 2, 21, 21, 21,
    ]);
    expect(activityPhases(STRIKE).map((phase) => phase.name)).toEqual([
      "phase00",
      "phase01",
      "phase02",
      "phase03",
      "phase04",
      "phase05",
      "phase06",
      "phase07",
    ]);
  });

  it("starts in the public rocketyard at the captured spawn point", () => {
    const scenario = activityBundles(STRIKE)?.scenario;
    expect(scenario?.initialBubble).toBe(ROCKETYARD);
    expect(scenario?.initialState).toBeUndefined();
    // fnv1("cosmo_portal_1_phase00"), the GAS spawn transition of the 2.3.1
    // capture.
    expect(scenario?.spawnTransition).toBe(0x70_80_8b_57);
    expect(activityPrivate(STRIKE)).toBe(false);
    expect(
      activityBundles(STRIKE)?.bubbles.find((b) => b.index === ROCKETYARD)
        ?.public
    ).toBe(true);
  });

  it("binds through story_common, as the mission does", () => {
    const binder = activityBinder(STRIKE);
    expect(binder?.bundle).toBe(STORY_COMMON);
    expect(binder?.lifetime).toBe(3);
    expect(binder?.players).toHaveLength(16);
  });
});

describeWithPackages("cosmo_portal_1 scripts on the disc tables", () => {
  it("runs each bundle's script once, with its missions and archetypes", () => {
    const { host, lines } = strikeHost(ROCKETYARD);
    // story_common, the root, the audio and the refinery, blast and ship
    // encounters; eight missions; eleven archetypes (the scripts' declared
    // ones, the ambient encounters' and the public events' among them); and
    // the Cosmodrome ambient and public event scripts its public bubbles load
    // (the Array's, the Last Array's landing and their chests and thorium).
    expect(host.runtime.scriptTags).toHaveLength(33);
    expect(host.unresolvedBindings).toEqual([]);
    expect(lines).toContain(
      "lua mission cosmo_portal1_activity_mission1 starting"
    );
    for (const mission of [2, 3, 4, 5, 6, 7, 8]) {
      expect(lines).toContain(
        `lua script cosmo_portal1_activity_mission${mission} loaded, phase queued`
      );
    }
  });

  it("goes active with the first objective once the players are ready", () => {
    const { host, lines, rows } = strikeHost(ROCKETYARD);
    // The root's startup sets pregame; mission 1 goes active (wire 3)
    // once the players are ready, which this host's players always are.
    host.notePlayerSpawned();
    for (let i = 0; i < 6; i++) {
      host.tick();
    }
    expect(lifetimeOf(rows).state).toBe(3);
    expect(lines).toContain(
      "lua obj_s1_phase00_m1 runs child script trigger_volume_objective (5F7C9F2A)"
    );
    // phase00.obj_s1_phase00_m1._player_objective, in the rocketyard's world.
    const start = worldRows(ROCKETYARD);
    const shown = rows
      .takeDirty((key) => start.has(key))
      .filter((row) => row.clientRef.bundle >>> 0 === ROOT)
      .map(({ clientRef: r }) => `t${r.typeId}#${r.typeIndex}`);
    expect(shown).toContain(`t${PLAYER_OBJECTIVE}#0`);
  });

  it("keeps the refinery's objects for the refinery's world", () => {
    const { host, rows } = strikeHost(ROCKETYARD);
    host.notePlayerSpawned();
    for (let i = 0; i < 6; i++) {
      host.tick();
    }
    // The laser webs and the hack console (enc_refinery_portal1's objects)
    // are created as that bundle comes up; their sensors are the refinery's.
    const start = worldRows(ROCKETYARD);
    const refinery = worldRows(REFINERY);
    expect(
      rows
        .takeDirty((key) => start.has(key) && !refinery.has(key))
        .filter((row) => row.clientRef.bundle >>> 0 === 0x4c_63_79_2c)
    ).toEqual([]);
    host.setActiveBundles(loadedBundles(STRIKE, REFINERY) ?? new Set());
    for (let i = 0; i < 3; i++) {
      host.tick();
    }
    expect(
      rows
        .takeDirty((key) => refinery.has(key))
        .filter((row) => row.clientRef.bundle >>> 0 === 0x4c_63_79_2c)
        .map(({ clientRef: r }) => `t${r.typeId}#${r.typeIndex}`)
    ).toEqual(expect.arrayContaining(["t4#0", "t4#1", "t4#2", "t4#66"]));
  });
});

// The Ghost's scan. The console is an interactable_placement: its object
// carries the mission-interactable component gated on
// sp_placement_array._object_filter from its creation, the filter one
// players-with-activity-flag predicate (1C450A3D, the console's import
// identifier) from the world entry, and the host writes that flag into every
// player row as the scan objective goes active and takes it out as the
// objective clears on the interaction, with the console's device going to
// 0.1 (2.3.1 capture).
describeWithPackages(
  "the refinery console (Devils' Lair console run 1)",
  () => {
    const ENC_REFINERY = 0x4c_63_79_2c;
    const CONSOLE = 66;
    const CONSOLE_FILTER = 67;
    const SCAN_FLAG = 0x1c_45_0a_3d;
    const OBJECT = 4;
    const OBJECT_FILTER = 33;
    const PLAYER = 12;

    type Sent = ReturnType<ItemSink["takeDirty"]>;
    const bodyOf = (sent: Sent, typeId: number, typeIndex: number) =>
      new BitReader(
        sent.find(
          ({ clientRef: r }) => r.typeId === typeId && r.typeIndex === typeIndex
        )?.authBody ?? Buffer.alloc(0)
      );
    const playerFlags = (sent: Sent) =>
      sent
        .filter(({ clientRef: r }) => r.typeId === PLAYER)
        .map(
          (entry) =>
            decode(liveAh().PlayerAuth, entry.authBody ?? Buffer.alloc(0))
              .identity.activityFlags.flags
        );

    // The scan phase from the refinery, ticked until the objective is active.
    function scanPhase() {
      const { host, lines, rows } = strikeHost(REFINERY, 2);
      rows.setOccupants(new Map([[0, 0x2_00_00_00_01n]]));
      host.notePlayerSpawned();
      host.runReadyThreads();
      const entry = rows.takeDirty();
      const sent: Sent = [];
      for (let i = 0; i < 6; i++) {
        host.tick();
        sent.push(...rows.takeDirty());
      }
      return { entry, host, lines, rows, sent };
    }

    it("creates the console gated on its filter, the filter on the scan flag", () => {
      const { entry, sent } = scanPhase();
      // The host holds a created object's components for one tick (the client
      // dies on a create carrying them), so the component rides on the first
      // tick's re-send of the row rather than the entry's body.
      const console_ = bodyOf(sent, OBJECT, CONSOLE);
      expect(console_.readNumber(32) >>> 0).toBe(0x80_00_00_01);
      expect(console_.readBit()).toBe(1);
      liveAh().SensorClientRef.decode(console_);
      expect(console_.readNumber(2)).toBe(1);
      console_.readBit();
      expect(console_.readNumber(32) >>> 0).toBe(
        liveAh().ObjectInteractableComponent.hash
      );
      expect(liveAh().ObjectInteractableComponent.decode(console_)).toEqual({
        mode: 1,
        filter: {
          bundle: ENC_REFINERY,
          typeId: OBJECT_FILTER,
          typeIndex: CONSOLE_FILTER,
        },
        usedStamp: 0,
        used: false,
      });
      const filter = bodyOf(entry, OBJECT_FILTER, CONSOLE_FILTER);
      expect(filter.readNumber(4)).toBe(1);
      filter.readBit();
      expect(filter.readNumber(32) >>> 0).toBe(
        liveAh().ObjectFilterActivityFlagPredicate.hash
      );
      expect(liveAh().ObjectFilterActivityFlagPredicate.decode(filter)).toEqual(
        {
          mode: 0,
          flag: SCAN_FLAG,
        }
      );
    });

    it("raises the scan flag on every player row as the objective goes active", () => {
      const { lines, sent } = scanPhase();
      expect(
        lines.some((line) =>
          /obj_s1_phase02_m1.*player objective active/.test(line)
        )
      ).toBe(true);
      const flags = playerFlags(sent);
      expect(flags).toHaveLength(16);
      for (const row of flags) {
        expect(row).toEqual([SCAN_FLAG]);
      }
      expect(
        lines.filter((line) => /is not a row - inert handle/.test(line))
      ).toEqual([]);
    });

    it("starts the hack on the interaction and takes the flag back", () => {
      const { host, lines, rows } = scanPhase();
      host.noteInteraction((name) => name === SCAN_FLAG);
      host.tick();
      host.tick();
      const sent = rows.takeDirty();
      const console_ = bodyOf(sent, OBJECT, CONSOLE);
      console_.readNumber(32);
      console_.readBit();
      liveAh().SensorClientRef.decode(console_);
      expect(console_.readNumber(2)).toBe(2);
      console_.readBit();
      console_.readNumber(32);
      liveAh().ObjectInteractableComponent.decode(console_);
      console_.readBit();
      expect(console_.readNumber(32) >>> 0).toBe(
        liveAh().ObjectDeviceComponent.hash
      );
      expect(
        liveAh().ObjectDeviceComponent.decode(console_).position
      ).toBeCloseTo(0.1);
      const flags = playerFlags(sent);
      expect(flags).toHaveLength(16);
      for (const row of flags) {
        expect(row).toEqual([]);
      }
      expect(
        lines.some((line) =>
          /po_repel_fallen01.*player objective active/.test(line)
        )
      ).toBe(true);
    });
  }
);

// The Walker (sq_tank, one named member): its squad's tally never moves, so
// its death is the member's own ActorSense edge ([10] flips as it dies, 2.3.1
// capture). Mission 5 waits on the squad being up and then dead.
describeWithPackages("the Walker's death ends the blast", () => {
  const BLAST = 0x63_48_63_c2;
  const BLAST_BUBBLE = 2;
  const BLAST_PHASE = 4;
  const PT_WALKER = 48;
  const SQ_TANK = 3;
  const TANK = 4;

  it("reads the squad alive from its placement and dead on the member's edge", () => {
    const { host, lines, rows } = strikeHost(BLAST_BUBBLE, BLAST_PHASE);
    host.notePlayerSpawned();
    const said = (pattern: RegExp) => lines.some((line) => pattern.test(line));
    const tick = (n: number) => {
      for (let i = 0; i < n; i++) {
        host.tick();
        rows.takeDirty();
      }
    };
    tick(4);
    host.noteTriggerFired(ROOT, PT_WALKER);
    // the Walker is placed once its skiff stands, a tick after the skiff
    tick(3);
    expect(said(/sq_tank t1#3 bodies=1/)).toBe(true);
    // The client's first sense of the squad and its member: no deaths, the
    // member bound.
    host.noteSquadTally(BLAST, SQ_TANK, [0]);
    host.noteActorBound(BLAST, TANK, false, true);
    tick(3);
    host.noteSquadAlive(BLAST, SQ_TANK, 1);
    tick(25);
    expect(said(/mission cosmo_portal1_activity_mission6 starting/)).toBe(
      false
    );
    // The Walker dies: its edge, and the squad's firing-area count to 0.
    host.noteActorBound(BLAST, TANK, true, true);
    host.noteSquadAlive(BLAST, SQ_TANK, 0);
    tick(6);
    expect(said(/o_cosmo_strike01_door01 t4#22 device position 1/)).toBe(true);
    expect(said(/mission cosmo_portal1_activity_mission6 starting/)).toBe(true);
  });
});
