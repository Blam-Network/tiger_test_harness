import {
  type ActivityBundleTag,
  type BsSchema,
  type CompiledBsFile,
  fnv1,
  missionNamespaces,
  resolveInstanceField,
  scriptStem,
} from "@blamnetwork/bullshcript/destiny1/common";
import { describe, expect, it } from "vitest";
import { e_build } from "../../../../builds";
import { describeBuild, hasPackages } from "../../../../test-support/build";

const BUILD = e_build.v40662_14_05_19_1414_pubalpha;

// The PS4 Alpha Trial's scripts (Fukugen Daihon's
// v40662_14_05_19_1414_pubalpha folder) on its own packages: the activities
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
  act_cosmo_m1_dome_a: {
    destination: "cosmo",
    bubble: 7,
    phases: [8, 8, 8],
  },
  city_tower_default1: { destination: "city_tower", bubble: 3 },
  cosmo_patrols_1: { destination: "cosmo", bubble: 0 },
  cosmo_portal_1: {
    destination: "cosmo",
    bubble: 20,
    phases: [20, 19, 19, 19, 2, 21, 21, 21],
    spawn: fnv1("cosmo_portal_1_phase00"),
  },
  pvp_factory: { destination: "pvp_factory", bubble: 0 },
  pvp_moonbase: { destination: "pvp_moonbase", bubble: 0 },
};

const ARRAY_OF = /^(?:static_array|dynamic_array)<(\w+)(?:,\s*\d+)?>$/;
// Types a member holds no row in: scalars, flags (on the players), handles
// to sibling encounters, and the hosts a script owns (listeners, command
// scripts, the encounter manager, a placement's interactable and device).
const NOT_ROWS =
  /^(?:bool|int|real|short|string|string_hash|common_reference|vector\w+|activity_flag|encounter_handle|encounter_manager|c_command_script|interactable|device|\w*incident_listener)$/;

// simple_encounter's respawn timer: the alpha's rows, as TU0's, carry none
// (the pre-alpha's did), so the host keeps it without one.
const ROWLESS = /\._respawn_timer$/;

interface LoadedScript {
  file: CompiledBsFile;
  namespaces: string[];
}

describe.skipIf(!hasPackages(BUILD))("PS4 Alpha Trial activity starts", () => {
  describeBuild(
    e_build.v40662_14_05_19_1414_pubalpha,
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
            if (row === undefined && !ROWLESS.test(path)) {
              unbound.add(`${where} ${path}`);
            } else if (row && archetype && !element) {
              bind(
                tags,
                set.schemaFor(archetype.path),
                field,
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
    }
  );
});
