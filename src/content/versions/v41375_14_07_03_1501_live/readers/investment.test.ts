import { fnv1 } from "@blamnetwork/bullshcript/destiny1/common";
import { expect, it } from "vitest";
import { describeWithPackages } from "../../../../test-support/build";
import { itemDef, itemDefs, itemName } from "../../../items";
import { progressionDef } from "../../../progressions";
import { subclassBuilds, talentGrid } from "../../../talent-grids";
import { vendorDefs } from "../../../vendors";

describeWithPackages("item definitions", () => {
  it("reads the whole item table in row order", () => {
    expect(itemDefs()).toHaveLength(3181);
    expect(itemDef(3181)).toBeUndefined();
  });

  it("decodes the equipable block", () => {
    // Gjallarhorn: a heavy weapon (bucket 4, equip slot 8), exotic.
    expect(itemDef(2075)).toMatchObject({
      bucket: 4,
      equipSlot: 8,
      instanced: true,
      tier: 5,
    });
    // Class items name their class through the equip unlock.
    expect(itemDef(199)?.classIndex).toBe(0);
    expect(itemDef(11)?.classIndex).toBe(1);
    expect(itemDef(1253)?.classIndex).toBe(2);
  });

  it("carries a weapon's stat block and a subclass's talent grid", () => {
    expect(itemDef(3159)?.weaponStats.length).toBeGreaterThan(0);
    expect(itemDef(321)?.weaponStats).toEqual([]);
    expect(itemDef(774)?.gridIndex).toBe(130);
    expect(itemDef(0)?.gridIndex).toBeNull();
  });

  it("names items through the localized strings", () => {
    expect(itemName(2075)).toBe("Gjallarhorn");
    expect(itemName(99_999)).toBe("");
  });
});

describeWithPackages("vendors", () => {
  it("lists the vendor table, the currency vendor first", () => {
    const vendors = vendorDefs();
    expect(vendors).toHaveLength(31);
    expect(vendors[0]?.nameHash).toBe(fnv1("currency_vendor"));
    expect(vendors[0]?.currencyDef).toBe(899);
  });

  it("reads a purchase's cost and level", () => {
    expect(vendorDefs()[3]?.purchases[0]).toEqual({
      itemDef: 321,
      quantity: 1,
      explicitCost: true,
      costDef: 899,
      costQuantity: 150,
      level: 3,
    });
  });
});

describeWithPackages("talent grids", () => {
  it("reads a subclass grid", () => {
    const grid = talentGrid(130);
    expect(grid?.nodes).toHaveLength(31);
    expect(grid?.progression).toBe(102);
    expect(
      grid?.nodes.filter((n) => n.autoGranted).map((n) => n.index)
    ).toEqual([12, 20, 26]);
    expect(talentGrid(9999)).toBeUndefined();
  });

  it("reads a progression's steps", () => {
    const progression = progressionDef(102);
    expect(progression?.steps.slice(0, 4).map((s) => s.xpRequired)).toEqual([
      0, 900, 4000, 7000,
    ]);
    expect(progressionDef(9999)).toBeUndefined();
  });

  it("builds the six starting subclasses", () => {
    expect([...subclassBuilds().keys()]).toEqual([
      774, 775, 776, 777, 778, 779,
    ]);
    expect(subclassBuilds().get(774)).toEqual({
      grid: 130,
      abilities: [24, 10, 6, 1, 11],
      perks: [187, 165, 45, 46, 47, 48],
      nodes: [0, 1, 12, 19, 20, 26],
    });
  });
});
