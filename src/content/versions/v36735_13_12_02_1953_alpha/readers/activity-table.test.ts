import { fnv1 } from "@blamnetwork/bullshcript/destiny1/common";
import { describe, expect, it, vi } from "vitest";
import { e_build } from "../../../../builds";
import { hasPackages } from "../../../../test-support/build";
import { contentBuildForTest } from "../../../../test-support/content-build";

const BUILD = e_build.v36735_13_12_02_1953_alpha;
const alphaBuild = () => contentBuildForTest(BUILD);

// The neutral table assembly asks the active build, which the alpha is not
// yet: hand it this one.
vi.mock("../../index", async () => {
  const actual = await vi.importActual<object>("../../index");
  const { e_build } = await import("../../../../builds");
  const { contentBuildForTest } = await import(
    "../../../../test-support/content-build"
  );
  return {
    ...actual,
    contentBuild: () => contentBuildForTest(e_build.v36735_13_12_02_1953_alpha),
  };
});

describe.skipIf(!hasPackages(BUILD))("alpha activity tables", () => {
  const table = async (name: string) => {
    const { readActivityTable } = await import("../../../activity-table");
    const { activityStart } = await import("../../../start-config");
    const start = activityStart(name);
    return start && readActivityTable(name, start);
  };

  // Where each scripted activity starts, as the hand-written config and the
  // scenario_fah gave it before the scripts carried it.
  it.each([
    ["city_tower_default1", "city_tower", 3],
    ["venus_chapter_2", "venus", 16],
    ["venus_portal_1", "venus", 16],
    ["venus_bounty_1", "venus", 21],
    ["pvp_factory", "pvp_factory", 0],
    ["pvp_greenhouse", "pvp_greenhouse", 0],
    ["pvp_marsbattle", "pvp_marsbattle", 0],
    ["action_mock", "action_mock", 0],
  ])("starts %s in %s's bubble %i", async (name, destination, bubble) => {
    const started = await table(name);
    expect(started?.destination).toBe(destination);
    expect(started?.scenario.initialBubble).toBe(bubble);
    expect(started?.scenario.initialState).toBeUndefined();
    expect(started?.scenario.spawnTransition).toBeUndefined();
  });

  it("starts venus_portal_1's phases in the plaza, dig site and vex ruins", async () => {
    const portal = await table("venus_portal_1");
    expect(portal?.phases?.map(({ bubble, name }) => [name, bubble])).toEqual([
      ["engineering_phase", 16],
      ["dig_site_phase", 5],
      ["ruins_phase", 28],
      ["end_phase", 28],
    ]);
    expect(portal?.phases?.map((phase) => phase.hash)).toEqual(
      portal?.phases?.map((phase) => fnv1(phase.name))
    );
  });

  it("builds no table for an activity no script starts", async () => {
    expect(await table("orbit")).toBeUndefined();
  });

  it("reads each scenario_client by name", () => {
    const { activityScenario } = alphaBuild().readers;
    const portal = activityScenario("venus_portal_1");
    expect(portal?.bubbles).toHaveLength(30);
    expect(portal?.familyChecksum).toBe(fnv1("venus_portal_1"));
    expect(activityScenario("city_tower_default1")?.bubbles).toHaveLength(5);
    expect(activityScenario("action_mock")?.bubbles).toHaveLength(1);
    expect(activityScenario("not_an_activity")).toBeUndefined();
  });

  it("builds the Tower's table", async () => {
    const tower = await table("city_tower_default1");
    expect(tower?.destination).toBe("city_tower");
    expect(tower?.scenario.initialBubble).toBe(3);
    expect(tower?.tags).toHaveLength(6);
    expect(tower?.bubbles).toHaveLength(5);
    const rows = tower?.tags.flatMap((tag) => tag.rows) ?? [];
    expect(rows.length).toBeGreaterThan(200);
    const sensors = tower?.tags.flatMap((tag) => tag.sensors) ?? [];
    expect(sensors.length).toBeGreaterThan(150);
    // A squad's members come from its template, one cell each; this
    // vendor's are all named actors, whose bodies are their own.
    const squad = tower?.tags
      .find((tag) => tag.bundle === 0x8d_3f_11_66)
      ?.rows.at(0);
    expect(squad?.memberNames).toEqual([
      0xdd_3e_ab_af, 0xdd_3e_ab_ac, 0xf9_e2_fe_9e,
    ]);
    expect(squad?.cells).toEqual([0, 0, 0]);
  });

  it("builds action_mock's table", async () => {
    const mock = await table("action_mock");
    expect(mock?.destination).toBe("action_mock");
    expect(mock?.tags).toHaveLength(2);
    expect(mock?.tags.flatMap((tag) => tag.rows).length).toBeGreaterThan(100);
    expect(mock?.tags.flatMap((tag) => tag.sensors).length).toBeGreaterThan(50);
    expect(mock?.tags.flatMap((tag) => tag.navPoints ?? [])).toHaveLength(13);
  });

  it("builds venus_portal_1's table with its four phases", async () => {
    const portal = await table("venus_portal_1");
    expect(portal?.scenario.initialBubble).toBe(16);
    expect(portal?.scenario.spawnTransition).toBeUndefined();
    expect(portal?.phases?.map((phase) => phase.name)).toEqual([
      "engineering_phase",
      "dig_site_phase",
      "ruins_phase",
      "end_phase",
    ]);
    expect(portal?.tags.length).toBeGreaterThan(15);
    expect(portal?.tags.flatMap((tag) => tag.rows).length).toBeGreaterThan(
      2000
    );
    expect(portal?.tags.flatMap((tag) => tag.sensors).length).toBeGreaterThan(
      1000
    );
    // Each phase is a Phase row of the strike bundle, by its name's hash.
    const phaseRows = (portal?.tags ?? []).flatMap((tag) =>
      tag.rows.filter((row) => row.nameHash === fnv1("ruins_phase"))
    );
    expect(phaseRows.length).toBeGreaterThan(0);
  });

  // The Actor rows' hosts name their squad but not their cell: the cell is
  // the squad member the row's import identifier names.
  it("seats venus_chapter_2's captain in cell 0 of his squad", async () => {
    const chapter = await table("venus_chapter_2");
    const captain = fnv1("ch2m1_captain");
    const squads = (chapter?.tags ?? []).flatMap((tag) =>
      tag.rows.filter((row) => row.memberNames?.includes(captain))
    );
    expect(squads).toHaveLength(1);
    expect(squads[0].memberNames).toEqual([captain]);
    expect(squads[0].cells).toEqual([0]);
  });

  it("links every Actor row to a cell", () => {
    const { activityBundle, activityScenario } = alphaBuild().readers;
    const bundles = new Set(
      (activityScenario("venus_chapter_2")?.bubbles ?? []).flatMap((states) =>
        states.flatMap(({ blueprints: b }) => [
          ...b.global,
          ...b.authoritative,
          ...b.private,
        ])
      )
    );
    const actors = [...bundles]
      .flatMap((tag) => activityBundle(tag).hosts)
      .filter(
        (host) =>
          host.typeId === alphaBuild().bullshcript.ActivityBundleItemType.Actor
      );
    expect(actors.length).toBeGreaterThan(0);
    expect(actors.every((host) => host.actor !== undefined)).toBe(true);
  });

  it("resolves the Encounter rows' archetypes by name hash", async () => {
    const chapter = await table("venus_chapter_2");
    const { withChildScripts } = await import("../../../child-scripts");
    const { compiledScripts } = await import(
      "../../../../activity-host-proxy/script-host/compiled-scripts"
    );
    const rows = withChildScripts(
      chapter?.tags ?? [],
      chapter?.destination ?? "",
      compiledScripts()
    ).flatMap((tag) => tag.rows);
    const archetype = (name: string) =>
      rows.find((row) => row.nameHash === fnv1(name))?.childScript;
    expect(archetype("phase00.ch2m1_collect_loot")).toBe(
      "collect_loot_objective"
    );
    expect(archetype("phase01.ch2m2_enter_bubble")).toBe(
      "trigger_bubble_objective"
    );
    expect(archetype("phase02.ch2m3_kill_warpgates")).toBe(
      "kill_squad_objective"
    );
  });

  // A script declares every row of its bundle, so the names the packages
  // leave out are the declared paths whose hashes the rows carry.
  it("names the rows its scripts declare, hosts and actors included", async () => {
    const chapter = await table("venus_chapter_2");
    const { withChildScripts } = await import("../../../child-scripts");
    const { compiledScripts } = await import(
      "../../../../activity-host-proxy/script-host/compiled-scripts"
    );
    const rows = withChildScripts(
      chapter?.tags ?? [],
      chapter?.destination ?? "",
      compiledScripts()
    ).flatMap((tag) => tag.rows);
    const named = (name: string) =>
      rows.find((row) => row.nameHash === fnv1(name))?.name;
    expect(named("phase02.ch2m3_kill_warpgates")).toBe(
      "phase02.ch2m3_kill_warpgates"
    );
    expect(named("phase02.vex_warp_gate00._squad")).toBe(
      "phase02.vex_warp_gate00._squad"
    );
    expect(named("phase02.vex_warp_gate00._squad__gate")).toBe(
      "phase02.vex_warp_gate00._squad__gate"
    );
    expect(named("phase02.sq_vex_reinf00")).toBe("phase02.sq_vex_reinf00");
  });

  // A ControlPoint row is a compiled command script: the Fallen dropship
  // flies in, along four atoms, on fallen_dropship01_enter.
  it("reads the command script of each ControlPoint row", async () => {
    const chapter = await table("venus_chapter_2");
    const tides = chapter?.tags.find((tag) => tag.bundle === 0x0a_6d_90_03);
    const enter = tides?.rows.find(
      (row) => row.nameHash === fnv1("fallen_dropship01_enter")
    );
    expect(enter).toBeDefined();
    const scripts = alphaBuild().readers.commandScripts(tides?.tag ?? 0);
    const script = scripts.find(
      (candidate) => candidate.typeIndex === enter?.typeIndex
    );
    expect(script?.bundle).toBe(0x0a_6d_90_03);
    expect(script?.atoms.map((atom) => atom.kind)).toEqual([3, 9, 3, 8]);
    expect(script?.atoms[0]).toMatchObject({
      point: { bundle: 0x0a_6d_90_03, typeIndex: enter?.typeIndex },
      stop: false,
    });
  });

  // A kill incident carries where the victim died, which finds its squad by
  // its template's spawn point: the four warp gates share one identifier.
  it("puts each squad's spawn points and each object's position on its row", async () => {
    const chapter = await table("venus_chapter_2");
    const rows = (bundle: number) =>
      chapter?.tags
        .filter((tag) => tag.bundle === bundle)
        .flatMap((tag) => tag.rows) ?? [];
    const gate = rows(0x51_76_41_f1).find(
      (row) => row.nameHash === fnv1("phase02.vex_warp_gate00._squad")
    );
    expect(gate?.spawnPoints).toEqual([
      {
        x: 458.699_371_337_890_6,
        y: -411.603_729_248_046_9,
        z: -6.399_333_477_020_264,
      },
    ]);
    const console = rows(0x0a_6d_90_03).find(
      (row) => row.nameHash === fnv1("ch2m3_interactable._object")
    );
    expect(console?.objectPosition).toEqual({
      x: 458.75,
      y: -414.75,
      z: -5.5,
    });
  });

  it("names no row: the packages hold hashes only", async () => {
    const mock = await table("action_mock");
    expect(
      mock?.tags
        .flatMap((tag) => tag.rows)
        .every((row) => row.name === undefined)
    ).toBe(true);
  });
});
