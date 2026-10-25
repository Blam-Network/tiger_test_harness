import { fnv1 } from "@blamnetwork/bullshcript/destiny1/common";
import { describe, expect, it } from "vitest";
import { compiledScripts } from "../activity-host-proxy/script-host/compiled-scripts";
import { withChildScripts } from "./child-scripts";

const ENCOUNTER = 59;
const OTHER = 3;

interface Row {
  childScript?: string;
  name?: string;
  nameHash: number;
  typeId: number;
}

const row = (name: string, typeId = ENCOUNTER): Row => ({
  name,
  nameHash: fnv1(name),
  typeId,
});
const archetypeOf = (
  bundle: string,
  destination: string,
  names: readonly string[]
) =>
  withChildScripts(
    [
      {
        bundle: bundle.startsWith("unknown_")
          ? Number.parseInt(bundle.slice(8), 16)
          : fnv1(bundle),
        rows: names.map((name) => row(name)),
      },
    ],
    destination,
    compiledScripts()
  )[0].rows.map((entry) => entry.childScript);

// The Encounter rows' archetypes are the scripts' declarations, matched to
// the rows of the script's bundle by name.
describe("withChildScripts", () => {
  it("takes a mission's phase rows from the mission that declares them", () => {
    expect(
      archetypeOf("act_cosmo_m0_highway", "cosmo", [
        "cosmo_m0_phase01_breach.obj_investigate_wall",
        "cosmo_m0_phase03_hangar.obj_m0_goto_hangar",
        "cosmo_m0_phase02_graveyard.obj_m0_m04",
      ])
    ).toEqual(["trigger_volume_objective", undefined, "generic_objective"]);
  });

  it("takes a row two missions declare from its own phase's mission", () => {
    expect(
      archetypeOf("act_mars_m07_lowergarden", "mars", [
        "phase_valley.sp_objective_goto",
        "phase_catacombs.sp_objective_goto",
      ])
    ).toEqual(["trigger_volume_objective", "trigger_bubble_objective"]);
  });

  // An array's elements are the ones with rows from index 0 on, as the
  // script host instances them.
  it("takes a prefab instance's children from its archetype", () => {
    expect(
      archetypeOf("unknown_d2c22dcf", "cosmo", [
        "pf_event_countdown_dropship[0]",
        "pf_event_countdown_dropship[1]",
        "pf_event_countdown_dropship[1].pf_preset",
        "pf_event_countdown_dropship[1].pf_impact",
        "pf_event_skirmish[0].event_globals",
      ])
    ).toEqual([
      "u_event_countdown",
      "u_event_countdown",
      "u_event_countdown_preset",
      "u_event_countdown_impact",
      undefined,
    ]);
  });

  it("takes a row that carries its name hash alone the same", () => {
    const names = [
      "cosmo_m0_phase01_breach.obj_investigate_wall",
      "cosmo_m0_phase02_graveyard.obj_m0_m04",
    ];
    const [tag] = withChildScripts(
      [
        {
          bundle: fnv1("act_cosmo_m0_highway"),
          rows: names.map(
            (name): Row => ({ nameHash: fnv1(name), typeId: ENCOUNTER })
          ),
        },
      ],
      "cosmo",
      compiledScripts()
    );
    expect(tag.rows.map((entry) => entry.childScript)).toEqual([
      "trigger_volume_objective",
      "generic_objective",
    ]);
  });

  // The script declares every row of its bundle as a member, so a row that
  // carries its hash alone has the name of the declared path that hashes to
  // it: the instance, its hosts and its arrays' elements.
  it("names a row that carries its hash alone from the member declaring it", () => {
    const declared = [
      "pf_event_countdown_dropship[0]",
      "pf_event_countdown_dropship[1]",
      "pf_event_countdown_dropship[1].pf_preset",
      "pf_event_countdown_dropship[1].pf_preset.po_event_countdown",
      "pf_event_countdown_dropship[1].o_event_countdown_beacon",
      "pf_event_countdown_dropship[1].sq_event_countdown_wave[0]",
    ];
    const rows: Row[] = [
      ...declared.map((name): Row => ({ nameHash: fnv1(name), typeId: OTHER })),
      { nameHash: fnv1("no_member_declares_this"), typeId: OTHER },
      {
        name: "kept",
        nameHash: fnv1("pf_event_countdown_dropship[0]"),
        typeId: OTHER,
      },
    ];
    const [tag] = withChildScripts(
      [{ bundle: 0xd2_c2_2d_cf, rows }],
      "cosmo",
      compiledScripts()
    );
    expect(tag.rows.map((entry) => entry.name)).toEqual([
      ...declared,
      undefined,
      "kept",
    ]);
  });

  it("gives a bundle with no script, and rows of other types, none", () => {
    expect(archetypeOf("no_such_bundle", "cosmo", ["obj_x"])).toEqual([
      undefined,
    ]);
    const [tag] = withChildScripts(
      [
        {
          bundle: fnv1("act_cosmo_m0_highway"),
          rows: [row("cosmo_m0_phase01_breach.obj_investigate_wall", OTHER)],
        },
      ],
      "cosmo",
      compiledScripts()
    );
    expect(tag.rows[0].childScript).toBeUndefined();
  });

  it("leaves the tags it was given alone", () => {
    const tags = [
      {
        bundle: fnv1("act_cosmo_m0_highway"),
        rows: [row("cosmo_m0_phase01_breach.obj_investigate_wall")],
      },
    ];
    withChildScripts(tags, "cosmo", compiledScripts());
    expect(tags[0].rows[0]).toEqual(
      row("cosmo_m0_phase01_breach.obj_investigate_wall")
    );
  });
});
