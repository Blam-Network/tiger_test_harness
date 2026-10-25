// The Tower's authored scripts on the disc tables, through the
// package host: the vendors the plaza script places come out as squad and
// actor rows the client can place.
import { fnv1 } from "@blamnetwork/bullshcript/destiny1/common";
import { BitReader } from "@blamnetwork/rsat";
import { expect, it } from "vitest";
import { loadedBundles } from "../../content";
import { describeWithPackages } from "../../test-support/build";
import { SensorRowState } from "../mission/row-state";
import { liveAh } from "../versions/v41375_14_07_03_1501_live/live-ah";
import { scriptHostFor } from "./runtime";

const TOWER = 0x8c_c3_14_36;
const SQUAD = 1;
const ACTOR = 2;
// sq_plaza_vendor_postmaster and its __vendor1 on the disc's bundle table.
const POSTMASTER = 36;
// The underwatch and plaza vendors enc_plaza_amb1 places.
const VENDOR_SQUADS = [2, 4, 6, 27, 30, 34, 36, 38, 40, 42];

function towerHost() {
  const lines: string[] = [];
  const host = scriptHostFor({
    activityName: "city_tower_default1",
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
  host.setActiveBundles(loadedBundles("city_tower_default1", 3) ?? new Set());
  host.notePlayerSpawned();
  for (let i = 0; i < 4; i++) {
    host.tick();
  }
  return { host, lines, rows: host.itemSink.takeDirty() };
}

// The tests only read the host and its first rows, so one host serves them.
let shared: ReturnType<typeof towerHost> | undefined;
const sharedTower = () => {
  shared ??= towerHost();
  return shared;
};

describeWithPackages("Tower scripts on the disc tables", () => {
  it("loads the root, the binder and bubble 3's plaza bundle", () => {
    expect(loadedBundles("city_tower_default1", 3)).toEqual(
      new Set([0xf2_d8_8b_d0, 0xa0_ec_b5_47, 0x40_ae_bf_90, TOWER])
    );
    const { host } = sharedTower();
    expect(host.runtime.scriptTags).toHaveLength(3);
    expect(host.unresolvedBindings).toEqual([]);
  });

  it("places every vendor: its squad first, then its named actor", () => {
    const { rows, lines } = sharedTower();
    expect(lines).toContain("lua print CITY TOWER DEFAULT ACTIVITY");
    const squads = rows
      .filter((row) => row.clientRef.typeId === SQUAD)
      .map((row) => row.clientRef.typeIndex);
    expect([...squads].sort((a, b) => a - b)).toEqual(VENDOR_SQUADS);
    const firstActor = rows.findIndex((row) => row.clientRef.typeId === ACTOR);
    expect(firstActor).toBe(squads.length);
    for (const row of rows) {
      expect(row.clientRef.bundle >>> 0).toBe(TOWER);
    }
  });

  it("sends the postmaster as roster [0], its temperament, and a placed actor", () => {
    const { rows } = sharedTower();
    const body = (typeId: number, typeIndex: number) => {
      const row = rows.find(
        ({ clientRef: ref }) =>
          ref.typeId === typeId && ref.typeIndex === typeIndex
      );
      if (!row?.authBody) {
        throw new Error(`no row t${typeId}#${typeIndex}`);
      }
      return new BitReader(row.authBody);
    };
    const auth = liveAh().SquadAuth.decode(body(SQUAD, POSTMASTER));
    expect(auth.roster?.slots).toEqual([0]);
    expect(auth.temperaments?.tags.map((hash) => hash >>> 0)).toEqual([
      fnv1("temper_tower_vendor"),
    ]);
    expect(auth.unknown4).toBe(0);
    expect(auth.bindingGeneration).toBe(1);
    expect(auth.task).toBe(-1);
    expect([auth.killPolicy, auth.carrierCargo]).toEqual([0, 0]);
    const actor = liveAh().ActorAuth.decode(body(ACTOR, POSTMASTER + 1));
    expect(actor.place).toBe(true);
    expect(actor.killEpoch).toBeUndefined();
  });
});
