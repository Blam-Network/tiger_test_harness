import { fnv1 } from "@blamnetwork/bullshcript/destiny1/common";
import { expect, it } from "vitest";
import { e_build } from "../../../builds";
import { buildPackagesDir, describeBuild } from "../../../test-support/build";

const packages = buildPackagesDir(e_build.v36735_13_12_02_1953_alpha);

// venus_chapter_2's first mission on the alpha's disc tables, through the
// package host. The alpha's rows carry name hashes only, so the scripts find
// them, their archetypes and the cells of their named actors by hash.
const STORY = 0x51_76_41_f1;
const SOUTHERN_TIDES = 0x0a_6d_90_03;
const PLAZA = 0x8c_c3_14_36;
const ARCHIVE = 0x92_97_a4_42;
// phase02.ch2m3_enter_bubble._player_trigger, and pv_fallen_drop under the
// Fallen dropship.
const ENTER_SOUTHERN_TIDES = 147;
const FALLEN_DROP = 26;
const SOUTHERN_TIDES_BUBBLE = 23;
const MISSION_THREE = 2;
describeBuild(
  e_build.v36735_13_12_02_1953_alpha,
  "alpha venus_chapter_2 scripts on the disc tables",
  () => {
    async function chapterHost() {
      const { loadedBundles } = await import("../../../content");
      const { SensorRowState } = await import("../../mission/row-state");
      const { scriptHostFor } = await import("../../script-host/runtime");
      const lines: string[] = [];
      const host = scriptHostFor({
        activityName: "venus_chapter_2",
        clock: { activityTicks: () => 0 },
        log: (line: string) => lines.push(line),
        namedHandles: {},
        phaseProgress: { read: () => 0, write: () => undefined },
        players: () => [{ characterKey: "c0", powerLevel: 1, ready: true }],
        state: new SensorRowState(),
        tickSeconds: 1,
      });
      if (!host?.itemSink) {
        throw new Error("no host");
      }
      host.start();
      host.setActiveBundles(loadedBundles("venus_chapter_2", 16) ?? new Set());
      host.notePlayerSpawned();
      for (let i = 0; i < 40; i++) {
        host.tick();
      }
      return { host, lines };
    }

    // The host as venus_chapter_2's third mission finds it, with the player
    // in the southern tides.
    async function missionThreeHost() {
      const { loadedBundles } = await import("../../../content");
      const { SensorRowState } = await import("../../mission/row-state");
      const { scriptHostFor } = await import("../../script-host/runtime");
      const lines: string[] = [];
      const host = scriptHostFor({
        activityName: "venus_chapter_2",
        clock: { activityTicks: () => 0 },
        log: (line: string) => lines.push(line),
        namedHandles: {},
        phaseProgress: { read: () => MISSION_THREE, write: () => undefined },
        players: () => [{ characterKey: "c0", powerLevel: 1, ready: true }],
        state: new SensorRowState(),
        tickSeconds: 1,
      });
      if (!host?.itemSink) {
        throw new Error("no host");
      }
      host.start();
      host.setActiveBundles(
        loadedBundles("venus_chapter_2", SOUTHERN_TIDES_BUBBLE) ?? new Set()
      );
      host.notePlayerSpawned();
      const tick = (count: number) => {
        for (let i = 0; i < count; i++) {
          host.tick();
        }
      };
      tick(20);
      return { host, lines, tick };
    }

    it.skipIf(!packages)(
      "runs the archetype of each Encounter row it names by hash",
      async () => {
        const { lines } = await chapterHost();
        expect(lines).toContain(
          "lua ch2m1_collect_loot runs child script collect_loot_objective (2E5CC0F4)"
        );
        expect(lines).toContain(
          "lua ch2m3_kill_warpgates runs child script kill_squad_objective (8CA30AE4)"
        );
      }
    );

    // The alpha's squad and Objective hosts held the Objective each ambient
    // squad is against and the squad each task admits; the scripts'
    // @objective and @task write them down.
    it.skipIf(!packages)(
      "has the scripts' squads against their Objectives and steers them by their tasks",
      async () => {
        const { host, lines } = await chapterHost();
        const against = (bundle: number, typeIndex: number) => {
          const objective = host.squadObjective(bundle, typeIndex);
          return objective && [objective.bundle >>> 0, objective.typeIndex];
        };
        // enc_plaza_amb1's fallen_simple_encounter squads (an archetype
        // instance's _squad) and enc_archive_amb1's squads (plain members)
        expect(against(PLAZA, 11)).toEqual([PLAZA, 0]);
        expect(against(ARCHIVE, 1)).toEqual([ARCHIVE, 0]);
        // the archive's tasks admit the shanks and the melee squads apart
        expect(lines).toContain("lua sq_downstairs_shanks influencer -> 2");
        expect(lines).toContain("lua sq_downstairs_melee influencer -> 4");
      }
    );

    it.skipIf(!packages)(
      "shows the first mission's objective and places the plaza squads",
      async () => {
        const { lines } = await chapterHost();
        expect(lines).toContain(
          "lua mission venus_chapter_2_mission1 starting"
        );
        expect(lines).toContain(
          "lua phase00.ch2m1_collect_loot._player_objective t32#7 player objective incoming"
        );
        expect(lines).toContain(
          "lua phase00.ch2m1_collect_loot._player_objective t32#7 player objective active"
        );
        expect(lines).toContain(
          "lua vex_simple_encounter01._squad[0] t1#2 bodies=3"
        );
      }
    );

    // A hard wipe resets the running mission: the plaza squads it placed go
    // back to what they were and the mission places them again.
    it.skipIf(!packages)(
      "puts the first mission's plaza squads back on a hard wipe and places them again",
      async () => {
        const { host, lines } = await chapterHost();
        const placed = "lua vex_simple_encounter01._squad[0] t1#2 bodies=3";
        expect(lines.filter((line) => line === placed)).toHaveLength(1);
        expect(host.runtime.itemState.bodiesFor(PLAZA, 2)).toBe(3);
        host.itemSink.takeDirty();
        host.resetCurrentPhase();
        expect(host.runtime.itemState.bodiesFor(PLAZA, 2)).toBe(0);
        expect(host.itemSink.hasDirty()).toBe(true);
        for (let i = 0; i < 40; i++) {
          host.tick();
        }
        // the same line is not noted twice running
        expect(lines.filter((line) => line === placed)).toHaveLength(1);
        expect(host.runtime.itemState.bodiesFor(PLAZA, 2)).toBe(3);
        expect(lines).toContain(
          "lua mission venus_chapter_2_mission1 starting (hard wipe)"
        );
      }
    );

    it.skipIf(!packages)(
      "places the captain's squad with his named member in cell 0",
      async () => {
        const { lines } = await chapterHost();
        expect(lines).toContain("lua sq_fallen_captain t1#1 bodies=1");
        expect(lines).toContain(
          "lua sq_fallen_captain__ch2m1_captain t2#2 placed with sq_fallen_captain"
        );
      }
    );

    // The warp gates are the one squad their scripts never place: the host's
    // table stood them (the vex_warp_gate script marks its squad
    // @placed), every phase's, from the start.
    it.skipIf(!packages)(
      "stands the warp gates and drops squads through them once the objective begins",
      async () => {
        const { host, lines, tick } = await missionThreeHost();
        for (const [phase, gate, row] of [
          ["phase02", "00", 70],
          ["phase02", "01", 72],
          ["phase02", "02", 74],
          ["phase02", "03", 76],
          ["phase03", "00", 129],
          ["phase03", "01", 131],
        ]) {
          expect(lines).toContain(
            `lua ${phase}.vex_warp_gate${gate}._squad__gate t2#${row} placed with ${phase}.vex_warp_gate${gate}._squad (table)`
          );
        }
        host.noteTriggerFired(STORY, ENTER_SOUTHERN_TIDES);
        tick(20);
        const console = fnv1("ch2m3_interactable");
        host.noteInteraction((name) => name >>> 0 === console >>> 0);
        tick(120);
        expect(lines).toContain(
          'lua ch2m3_kill_warpgates._squad:import_only_bind_object("ch2m3_kill_warpgates") -> phase02.ch2m3_kill_warpgates t58#172'
        );
        expect(lines).toContain(
          "lua phase02.vex_warp_gate00._squad__gate t2#70 set_channel_scalar(power_state, 0.20000000298023224)"
        );
        expect(lines).toContain(
          "lua phase02.vex_warp_gate00._squad__gate t2#70 drop #1 queue 1"
        );
      }
    );

    // The warpgates filter keeps every combatant of the gates' type, and a
    // gate leaves it as its turn comes, so no gate can be killed before it.
    it.skipIf(!packages)(
      "keeps the gates unkillable until each one's turn",
      async () => {
        const { host, tick } = await missionThreeHost();
        host.noteTriggerFired(STORY, ENTER_SOUTHERN_TIDES);
        tick(20);
        const console = fnv1("ch2m3_interactable");
        host.noteInteraction((name) => name >>> 0 === console >>> 0);
        tick(120);
        const filter = host.itemSink
          ?.entries()
          .find(({ clientRef: r }) => r.typeId === 33 && r.typeIndex === 150);
        expect(filter?.authBits).toBeGreaterThan(4);
      }
    );

    // The four gates share one identifier, so a kill incident finds its squad
    // by where the victim died: at the spawn point of the squad's template.
    it.skipIf(!packages)(
      "credits a gate's kill to the gate it died at",
      async () => {
        const { host, lines, tick } = await missionThreeHost();
        host.noteTriggerFired(STORY, ENTER_SOUTHERN_TIDES);
        tick(20);
        const console = fnv1("ch2m3_interactable");
        host.noteInteraction((name) => name >>> 0 === console >>> 0);
        tick(20);
        // phase02.vex_warp_gate02._squad's spawn point.
        host.noteSquadKill(fnv1("ch2m3_kill_warpgates"), {
          x: 624.694_152_832_031_2,
          y: -322.504_516_601_562_5,
          z: 11.804_798_126_220_703,
        });
        expect(lines.join(" ")).toMatch(
          /kill credited to 517641f1:73 \(position\)/
        );
      }
    );

    // A command script is the atoms of a ControlPoint row, which the ship's
    // actor carries: without them it never moves and its script never ends.
    it.skipIf(!packages)(
      "flies the Fallen dropship in, over the drop and away",
      async () => {
        const { host, lines, tick } = await missionThreeHost();
        host.noteTriggerFired(STORY, ENTER_SOUTHERN_TIDES);
        tick(20);
        host.noteTriggerFired(SOUTHERN_TIDES, FALLEN_DROP);
        tick(400);
        const flown = (path: string, cookie: number, atoms: number) =>
          `lua sq_fallen_dropship__pilot:execute(${path}) - command script cookie #${cookie}, ${atoms} atoms`;
        expect(lines).toContain(flown("fallen_dropship01_enter", 1, 4));
        expect(lines).toContain(flown("fallen_dropship01_next", 2, 7));
        expect(lines).toContain(flown("fallen_dropship01_exit", 5, 5));
        expect(lines).toContain("lua sq_fallen_dropship t1#1 bodies=0");
      }
    );

    // The console is its Object row's component, shown by the objective's
    // activity flag.
    it.skipIf(!packages)(
      "makes the interactable present and usable once the player is in",
      async () => {
        const { host, lines, tick } = await missionThreeHost();
        host.noteTriggerFired(STORY, ENTER_SOUTHERN_TIDES);
        tick(20);
        const console = fnv1("ch2m3_interactable");
        host.noteInteraction((name) => name >>> 0 === console >>> 0);
        tick(5);
        expect(lines).toContain(
          "lua ch2m3_interactable._object t4#8 object present gen 1"
        );
        expect(lines).toContain(
          "lua ch2m3_interactable._interactable:is_active() -> true (interaction)"
        );
      }
    );
  }
);
