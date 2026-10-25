import { fnv1 } from "@blamnetwork/bullshcript/destiny1/common";
import { describe, expect, it } from "vitest";
import {
  describeWithPackages,
  hasPackages,
} from "../../../../test-support/build";
import { k_empty_name_hash } from "../../../../utils/name-hash";
import { activityBinder, activityBundles, bundleWorlds } from "../../..";
import { activityStart } from "../../../start-config";

// Opening the package set takes seconds on a loaded machine.
describeWithPackages("package reader", () => {
  it("reads a table with the authored start", () => {
    const table = activityBundles("act_cosmo_m4_dome_c");
    expect(table?.scenario.initialBubble).toBe(6);
    expect(table?.phases).toHaveLength(4);
    expect(table?.scenario.familyChecksum).toBeDefined();
    expect(table?.tags.length).toBeGreaterThan(0);
    expect(table?.tags.every((tag) => tag.sensors !== undefined)).toBe(true);
  });

  it("holds no script-derived data", () => {
    const rows = (activityBundles("act_cosmo_m4_dome_c")?.tags ?? []).flatMap(
      (tag) => tag.rows
    );
    expect(rows.some((row) => row.childScript !== undefined)).toBe(false);
  });

  it("builds no table for an activity whose scripts write no start", () => {
    expect(activityStart("pvp_oasis")).toBeUndefined();
    expect(activityBundles("pvp_oasis")).toBeUndefined();
  });

  it("has no table for a name the packages don't know", () => {
    expect(activityBundles("not_an_activity")).toBeUndefined();
  });
});

// Where each scripted activity starts and the phases it runs (each with its
// bubble), as the hand-written start config gave them before the scripts
// carried them.
const STARTS: Record<
  string,
  {
    bubble: number;
    destination: string;
    phases?: readonly number[];
    spawn?: number;
    state?: number;
  }
> = {
  city_tower_default1: { destination: "city_tower", bubble: 3 },
  city_tower_iron_banner: { destination: "city_tower", bubble: 3 },
  city_tower_queen: { destination: "city_tower", bubble: 3 },
  venus_portal_1: {
    destination: "venus",
    bubble: 15,
    spawn: fnv1("venus_strike_1_phase01"),
  },
  act_cosmo_m0_highway: {
    destination: "cosmo",
    bubble: 14,
    state: 1,
    phases: [14, 14, 3, 12, 12, 13, 13],
    spawn: 0xea_ec_23_35,
  },
  cosmo_portal_1: {
    destination: "cosmo",
    bubble: 20,
    phases: [20, 19, 19, 19, 2, 21, 21, 21],
    spawn: fnv1("cosmo_portal_1_phase00"),
  },
  act_cosmo_m0_5_hangar: {
    destination: "cosmo",
    bubble: 7,
    phases: [7, 13, 13],
  },
  act_cosmo_m1_dome_a: { destination: "cosmo", bubble: 7, phases: [8, 8, 8] },
  act_cosmo_m2_dome_c: {
    destination: "cosmo",
    bubble: 7,
    phases: [6, 11, 9, 9, 9],
  },
  act_cosmo_m4_dome_c: {
    destination: "cosmo",
    bubble: 6,
    phases: [0, 9, 9, 9],
  },
  cine_reveal: { destination: "cosmo", bubble: 3, state: 1, phases: [3, 3] },
  act_venus_m01_engineering: {
    destination: "venus",
    bubble: 20,
    state: 1,
    phases: [20, 20, 8, 8, 8, 8],
  },
  act_venus_m07_northern_tides: {
    destination: "venus",
    bubble: 3,
    phases: [4, 21, 13, 13, 13],
    spawn: 0xff_ba_6f_9c,
  },
  act_mars_m01_valley: {
    destination: "mars",
    bubble: 18,
    state: 1,
    phases: [18, 18, 18, 3, 3, 26],
  },
  act_mars_m05_warbase: {
    destination: "mars",
    bubble: 18,
    phases: [20, 14, 14, 9, 9, 28, 28, 28, 28],
    spawn: fnv1("landing_zone"),
  },
  act_mars_m06_subway: {
    destination: "mars",
    bubble: 18,
    phases: [1, 1, 12, 12, 12, 22, 22, 22],
    spawn: fnv1("landing_zone"),
  },
  act_mars_m07_lowergarden: {
    destination: "mars",
    bubble: 18,
    phases: [18, 26, 4, 25, 13, 13, 13, 13, 13, 13],
    spawn: fnv1("landing_zone"),
  },
  act_moon_m1_launchtubes: {
    destination: "moon",
    bubble: 1,
    state: 1,
    phases: [1, 1, 6, 3, 3, 3, 3, 3, 3],
    spawn: 0x87_87_51_58,
  },
  act_moon_m3_lowercitadel: {
    destination: "moon",
    bubble: 1,
    phases: [5, 5, 11, 11, 11],
    spawn: 0x87_87_51_58,
  },
  act_moon_m5_strength: {
    destination: "moon",
    bubble: 2,
    phases: [2, 3, 3, 3, 11, 11, 11, 11],
    spawn: fnv1("default"),
  },
  moon_portal_2: {
    destination: "moon",
    bubble: 2,
    phases: [12, 12, 12, 5, 14, 14],
  },
};

describeWithPackages("activity start from the scripts", () => {
  it.each(Object.entries(STARTS))("starts %s", (name, expected) => {
    const table = activityBundles(name);
    expect(table?.destination).toBe(expected.destination);
    expect(table?.scenario.initialBubble).toBe(expected.bubble);
    expect(table?.scenario.initialState).toBe(expected.state);
    expect(table?.scenario.spawnTransition).toBe(expected.spawn);
    expect(table?.phases?.map((phase) => phase.bubble)).toEqual(
      expected.phases
    );
  });

  it("names each phase by the row its hash is", () => {
    const phases = activityBundles("act_cosmo_m0_highway")?.phases ?? [];
    expect(phases[0]?.name).toBe("cosmo_m0_phase00_highway_intro");
    expect(phases.map((phase) => phase.hash)).toEqual(
      phases.map((phase) => fnv1(phase.name))
    );
  });

  it("carries the region spawn transitions and time of day", () => {
    expect(
      activityStart("act_cosmo_m0_highway")?.regionSpawnTransitions
    ).toEqual({
      24: 0x68_93_54_72,
      96: 0x10_ff_4a_98,
      104: 0x57_36_5a_42,
      105: k_empty_name_hash,
      112: 0xea_ec_23_35,
      113: 0xea_ec_23_35,
    });
    expect(activityStart("act_cosmo_m0_highway")?.timeOfDay).toBe(0.77);
    expect(activityStart("cine_reveal")?.timeOfDay).toBeUndefined();
    expect(activityStart("cine_reveal")?.regionSpawnTransitions).toEqual({});
  });
});

// The binder is the bundle with the lifetime and the players, not the first
// with a Lifetime row: cosmo_patrols_1's patrol bundle has one of its own and
// no players.
describe("activityBinder", () => {
  it.skipIf(!hasPackages())(
    "is story_common for an activity with an authored start",
    () => {
      expect(activityBinder("act_cosmo_m4_dome_c")).toMatchObject({
        bundle: 0x4786_c0e0,
      });
    }
  );
});

// Which host's world builds each bundle of the Last Array: its own scripts
// the private one, the public bubbles' ambient tables the public one.
describeWithPackages("bundleWorlds", () => {
  it("splits the Last Array between its own world and the public one", () => {
    const worlds = bundleWorlds("act_cosmo_m4_dome_c");
    expect(worlds.size).toBeGreaterThan(0);
    // act_cosmo_m4_dome_c's own bundle and its dome_c encounter
    expect(worlds.get(0xead5_51eb)?.world).toBe("private");
    expect(worlds.get(0x8563_9457)?.world).toBe("private");
    const kinds = new Set([...worlds.values()].map((entry) => entry.world));
    expect(kinds).toEqual(new Set(["private", "public"]));
  });
});
