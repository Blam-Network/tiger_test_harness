import {
  type ActivityBundleTag,
  type BsSchema,
  type CompiledBsFile,
  missionNamespaces,
  resolveInstanceField,
  scriptStem,
} from "@blamnetwork/bullshcript/destiny1/common";
import { describe, expect, it } from "vitest";
import { e_build } from "../../../../builds";
import { describeBuild, hasPackages } from "../../../../test-support/build";

const BUILD = e_build.v38464_14_02_28_1027_betath;

// The PS4 pre-alpha's scripts (Fukugen Daihon's
// v38464_14_02_28_1027_betath folder) on its own packages: the activities
// whose scenario_client the packages hold are the ones the scripts start,
// each start reads into a table, and every row the scripts declare binds.

// Where each activity starts and the bubble each phase runs in.
const STARTS: Record<
  string,
  {
    bubble: number;
    destination: string;
    phases?: readonly number[];
    spawn?: number;
  }
> = {
  city_tower_default1: { destination: "city_tower", bubble: 3 },
  cosmo_patrols_1: { destination: "cosmo", bubble: 5 },
  cosmo_portal_1: {
    destination: "cosmo",
    bubble: 17,
    phases: [17, 16, 16, 16, 1, 18, 18, 18],
  },
  pvp_factory: { destination: "pvp_factory", bubble: 0 },
  pvp_marsbattle: { destination: "pvp_marsbattle", bubble: 0 },
};

// The strike's bubbles (rocketyard, refinery, blast, ship), its root
// bundle, the refinery's and the blast's, and the relay console's import
// name. Rows by type index: the root's player triggers 49-56 and guard and
// boss squads 23, 24 and 30, the refinery's playfight (45-48) and last trash
// (42-44) squads, the blast's Walker (4).
const STRIKE_BUBBLES = [17, 16, 1, 18];
const STRIKE_ROOT = 0x3c_3e_c7_28;
const REFINERY = 0x4c_63_79_2c;
const BLAST = 0x63_48_63_c2;
const RELAY_CONSOLE = 0x1c_45_0a_3d;

const ARRAY_OF = /^(?:static_array|dynamic_array)<(\w+)(?:,\s*\d+)?>$/;
// Types a member holds no row in: scalars, flags (on the players), handles
// to sibling encounters, and the hosts a script owns (listeners, command
// scripts, the encounter manager, a placement's interactable and device).
const NOT_ROWS =
  /^(?:bool|int|real|short|string|string_hash|common_reference|vector\w+|activity_flag|encounter_handle|encounter_manager|c_command_script|interactable|device|\w*incident_listener)$/;

interface LoadedScript {
  file: CompiledBsFile;
  namespaces: string[];
}

describe.skipIf(!hasPackages(BUILD))("PS4 pre-alpha activity starts", () => {
  describeBuild(
    e_build.v38464_14_02_28_1027_betath,
    "the scripts on the packages",
    () => {
      it("starts each activity the packages hold a scenario for", async () => {
        const { contentBuild } = await import("../..");
        const { activityStart } = await import("../../../start-config");
        const { readers } = contentBuild();
        const names = new Set(
          readers.activityDefinitions().map(({ name }) => name)
        );
        const playable = [...names].filter(
          (name) => name && readers.activityScenario(name)
        );
        expect(playable.sort()).toEqual(Object.keys(STARTS).sort());
        const startable = [...names].filter(
          (name) => name && activityStart(name)
        );
        expect(startable.sort()).toEqual(Object.keys(STARTS).sort());
      });

      it("reads each start into a table", { timeout: 300_000 }, async () => {
        const { activityBundles } = await import("../../..");
        for (const [name, expected] of Object.entries(STARTS)) {
          const table = activityBundles(name);
          expect(table?.destination, name).toBe(expected.destination);
          expect(table?.scenario.initialBubble, name).toBe(expected.bubble);
          expect(table?.scenario.initialState, name).toBeUndefined();
          expect(table?.scenario.spawnTransition, name).toBe(expected.spawn);
          expect(
            table?.phases?.map((phase) => phase.bubble),
            name
          ).toEqual(expected.phases);
        }
      });

      it("binds every row the loaded scripts declare", {
        timeout: 300_000,
      }, async () => {
        const { activityBundles, bundleTags } = await import("../../..");
        const { compiledScripts } = await import(
          "../../../../activity-host-proxy/script-host/compiled-scripts"
        );
        const set = compiledScripts();
        const unbound = new Set<string>();
        const scripted = new Set<string>();

        // A member's row, and its archetype's own rows under it.
        const bind = (
          tags: readonly ActivityBundleTag[],
          schema: BsSchema,
          prefix: string,
          namespaces: readonly string[],
          where: string
        ) => {
          for (const member of schema.members) {
            const element = ARRAY_OF.exec(member.type)?.[1];
            const type = element ?? member.type;
            const archetype = set.archetypeScript(type);
            const holdsRow =
              member.kind === "object" ||
              member.kind === "static_array" ||
              (member.kind === "class_instance" && archetype);
            if (!holdsRow || NOT_ROWS.test(type)) {
              continue;
            }
            const field = element ? `${member.name}[0]` : member.name;
            const row = resolveInstanceField(tags, prefix, field, namespaces);
            const path = `${prefix ? `${prefix}.` : ""}${field}`;
            if (row === undefined) {
              unbound.add(`${where} ${path}`);
            } else if (row && archetype && !element) {
              bind(
                tags,
                set.schemaFor(archetype.path),
                path,
                namespaces,
                where
              );
            }
          }
        };

        for (const name of Object.keys(STARTS)) {
          const table = activityBundles(name);
          if (!table) {
            throw new Error(`${name}: no table`);
          }
          const tags = bundleTags(name);
          const loaded: LoadedScript[] = [];
          for (const bundle of new Set(tags.map((tag) => tag.bundle))) {
            const root = set.scriptByBundle(bundle, table.destination);
            if (!root) {
              continue;
            }
            loaded.push({ file: root, namespaces: [] });
            const rootMembers = set.schemaFor(root.path).members;
            for (const mission of set.missionScripts(root)) {
              loaded.push({
                file: mission,
                namespaces: missionNamespaces(
                  scriptStem(mission.path),
                  rootMembers
                ),
              });
            }
          }
          for (const { file, namespaces } of loaded) {
            scripted.add(file.path);
            bind(tags, set.schemaFor(file.path), "", namespaces, file.path);
          }
        }
        expect([...unbound].sort()).toEqual([]);
        // every bundle script in the folder runs in some activity
        const bundleScripts = set.files
          .filter((file) => file.activityBundle !== undefined)
          .map((file) => file.path);
        expect(bundleScripts.filter((path) => !scripted.has(path))).toEqual([]);
      });

      // The Devils' Lair on the host, the client's part played by hand:
      // each trigger, wipe and use moves the strike on, through all eight
      // missions to the end.
      it("runs the Devils' Lair through its eight missions", {
        timeout: 300_000,
      }, async () => {
        const { loadedBundles } = await import("../../..");
        const { SensorRowState } = await import(
          "../../../../activity-host-proxy/mission/row-state"
        );
        const { scriptHostFor } = await import(
          "../../../../activity-host-proxy/script-host/runtime"
        );
        const lines: string[] = [];
        let phase = 0;
        let complete = false;
        const host = scriptHostFor({
          activityName: "cosmo_portal_1",
          clock: { activityTicks: () => 0 },
          log: (line) => lines.push(line),
          namedHandles: {},
          onActivityComplete: () => {
            complete = true;
          },
          phaseProgress: {
            read: () => phase,
            write: (index) => {
              phase = index;
            },
          },
          players: () => [{ characterKey: "c0", powerLevel: 6, ready: true }],
          state: new SensorRowState(),
          tickSeconds: 1,
        });
        if (!host) {
          throw new Error("no host");
        }
        host.start();
        const bundles = new Set<number>();
        for (const bubble of STRIKE_BUBBLES) {
          for (const bundle of loadedBundles("cosmo_portal_1", bubble) ?? []) {
            bundles.add(bundle);
          }
        }
        host.setActiveBundles(bundles);
        host.notePlayerSpawned();
        expect(host.unresolvedBindings).toEqual([]);
        const run = (ticks: number) => {
          for (let i = 0; i < ticks; i++) {
            host.tick();
          }
        };
        const wiped = (bundle: number, squads: readonly number[]) => {
          for (const squad of squads) {
            host.noteSquadAlive(bundle, squad, 0);
          }
        };
        run(30);
        host.noteTriggerFired(STRIKE_ROOT, 49);
        run(30);
        host.noteTriggerFired(STRIKE_ROOT, 50);
        run(30);
        wiped(REFINERY, [45, 46, 47, 48]);
        run(30);
        host.noteInteraction((name) => name === RELAY_CONSOLE);
        run(400);
        wiped(REFINERY, [42, 43, 44]);
        run(30);
        host.noteTriggerFired(STRIKE_ROOT, 51);
        run(30);
        host.noteTriggerFired(STRIKE_ROOT, 53);
        run(30);
        wiped(BLAST, [4]);
        run(30);
        host.noteTriggerFired(STRIKE_ROOT, 52);
        run(30);
        host.noteTriggerFired(STRIKE_ROOT, 54);
        run(30);
        wiped(STRIKE_ROOT, [23, 24]);
        run(90);
        wiped(STRIKE_ROOT, [30]);
        run(120);
        for (let mission = 1; mission <= 8; mission++) {
          expect(lines).toContain(
            `lua mission cosmo_portal1_activity_mission${mission} main finished, completing`
          );
        }
        expect(phase).toBe(7);
        expect(complete).toBe(true);
      });
    }
  );
});
