import { beforeEach, describe, expect, it, vi } from "vitest";
import { activityBinder } from ".";
import { activityBundleItemType } from "./row-types";

const tables = vi.hoisted(() => ({ tags: [] as unknown[] }));

vi.mock("./tables", () => ({
  bundleTable: () => ({ tags: tables.tags }),
}));

const row = (typeId: number, typeIndex: number) => ({ typeId, typeIndex });

// The binder is the bundle with the lifetime and the players, not the first
// with a Lifetime row: cosmo_patrols_1's patrol bundle has one of its own and
// no players.
describe("activityBinder", () => {
  const lifetime = activityBundleItemType().Lifetime;
  const player = activityBundleItemType().Player;

  beforeEach(() => {
    tables.tags = [];
  });

  it("is the bundle with both the lifetime and players", () => {
    tables.tags = [
      { bundle: 1, rows: [row(lifetime, 0)] },
      { bundle: 2, rows: [row(lifetime, 3), row(player, 0), row(player, 1)] },
    ];
    expect(activityBinder("x")).toEqual({
      bundle: 2,
      lifetime: 3,
      players: [0, 1],
    });
  });

  it("falls back to a lifetime with no players when no bundle has both", () => {
    tables.tags = [{ bundle: 1, rows: [row(lifetime, 0)] }];
    expect(activityBinder("x")).toEqual({
      bundle: 1,
      lifetime: 0,
      players: [],
    });
  });
});
