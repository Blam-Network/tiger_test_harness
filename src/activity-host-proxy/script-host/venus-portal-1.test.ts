// venus_portal_1's authored strike scripts (tiger scripts) on the disc tables,
// through the package host: the root reaches its five missions and the
// archetypes its rows run, the first mission's objective and trigger go out
// from the start, and its squads once a player is in the engineering bubble.
import { expect, it } from "vitest";
import { bubbleSensors, loadedBundles, worldTags } from "../../content";
import { describeWithPackages } from "../../test-support/build";
import { SensorRowState } from "../mission/row-state";
import { scriptHostFor } from "./runtime";

const STRIKE = 0x0a_30_24_29;
const PLAZA = 15;
const ENGINEERING = 7;
// engineering_phase.engineering_bubble_objective._player_trigger
const ENGINEERING_BUBBLE_TRIGGER = 66;

const SQUAD = 1;

// The sensor rows the private world builds in a bubble.
function worldRows(bubble: number): Set<string> {
  return new Set(
    bubbleSensors(worldTags("venus_portal_1", bubble, "private"), bubble).map(
      (s) => `${s.bundle >>> 0}:${s.typeId}:${s.typeIndex}`
    )
  );
}

function strikeHost(bubble: number) {
  const lines: string[] = [];
  const host = scriptHostFor({
    activityName: "venus_portal_1",
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
  host.setActiveBundles(loadedBundles("venus_portal_1", bubble) ?? new Set());
  host.notePlayerSpawned();
  for (let i = 0; i < 10; i++) {
    host.tick();
  }
  return { host, lines, rows: host.itemSink };
}

describeWithPackages("venus_portal_1 scripts on the disc tables", () => {
  it("runs each bundle's script once, with its missions and archetypes", () => {
    const { host, lines } = strikeHost(PLAZA);
    // portal_common, strike_1_audio, strike_1_activity and the engineering,
    // dig site and ruins encounters; five missions; five archetypes.
    expect(host.runtime.scriptTags).toHaveLength(16);
    expect(host.unresolvedBindings).toEqual([]);
    expect(lines).toContain("lua mission venus_strike_1_mission1 starting");
    for (const mission of [2, 3, 4, 5]) {
      expect(lines).toContain(
        `lua script venus_strike_1_mission${mission} loaded, phase queued`
      );
    }
    expect(lines).toContain(
      "lua engineering_bubble_objective runs child script trigger_bubble_objective (6C4C740A)"
    );
  });

  it("holds the engineering floor's squads until engineering is loaded", () => {
    const { host, rows } = strikeHost(PLAZA);
    // Entering engineering completes mission 1's first objective, and its
    // kill objective places floor 1's first squads. Their sensors are in
    // engineering's copy of the strike bundle (slice set 7), which the start
    // bubble does not build.
    host.noteTriggerFired(STRIKE, ENGINEERING_BUBBLE_TRIGGER);
    for (let i = 0; i < 20; i++) {
      host.tick();
    }
    const start = worldRows(PLAZA);
    expect(
      rows
        .takeDirty((key) => start.has(key))
        .filter((row) => row.clientRef.typeId === SQUAD)
    ).toEqual([]);
    const engineering = worldRows(ENGINEERING);
    expect(
      rows
        .takeDirty((key) => engineering.has(key))
        .filter((row) => row.clientRef.bundle >>> 0 === STRIKE)
        .map((row) => row.clientRef.typeIndex)
    ).toEqual(expect.arrayContaining([2, 3]));
  });

  it("shows the engineering objective at once and arms its trigger in engineering", () => {
    const { rows } = strikeHost(PLAZA);
    const start = worldRows(PLAZA);
    const shown = rows
      .takeDirty((key) => start.has(key))
      .map(({ clientRef: r }) => `t${r.typeId}#${r.typeIndex}`);
    // engineering_bubble_objective's _player_objective. Its _player_trigger
    // has a sensor only in engineering's copy of the strike bundle, so the
    // armed trigger waits for that bubble.
    expect(shown).toContain("t32#21");
    expect(shown).not.toContain("t29#66");
    const engineering = worldRows(ENGINEERING);
    expect(
      rows
        .takeDirty((key) => engineering.has(key))
        .map(({ clientRef: r }) => `t${r.typeId}#${r.typeIndex}`)
    ).toContain("t29#66");
  });
});
