import { expect, it } from "vitest";
import { equipSlotIds } from "../content/inventory";
import { describeWithPackages } from "../test-support/build";
import {
  armourDefense,
  displayedPrimaryStat,
  itemPrimaryStat,
  weaponAttack,
} from "./primary-stat";

const GJALLARHORN = 2075;
const FATEBRINGER = 2204;
const VOIDFANG_VESTMENTS = 1253;

describeWithPackages("primary stat", () => {
  it("weapon attack follows the weapon_power curve of level + quality / 10", () => {
    // Year 1 numbers: a fully upgraded vanilla exotic, and the House of
    // Wolves cap.
    expect(weaponAttack(20, 43)).toBe(300);
    expect(weaponAttack(20, 62)).toBe(365);
    // The curve floors at x <= 1 and clamps at x = 50.
    expect(weaponAttack(0, 5)).toBe(20);
    expect(weaponAttack(50, 0)).toBe(1240);
    expect(weaponAttack(25, 250)).toBe(1240);
  });

  it("armour defense weights the stat_defense curve per slot", () => {
    expect(armourDefense(equipSlotIds().helmet, 50, 0)).toBe(976);
    expect(armourDefense(equipSlotIds().gauntlets, 50, 0)).toBe(798);
    expect(armourDefense(equipSlotIds().chest, 50, 0)).toBe(1065);
    expect(armourDefense(equipSlotIds().legs, 50, 0)).toBe(710);
    expect(armourDefense(equipSlotIds().chest, 20, 62)).toBe(312);
    expect(armourDefense(equipSlotIds().classItem, 20, 62)).toBeNull();
  });

  it("an item without its own level / quality replicates the def's level block", () => {
    expect(itemPrimaryStat({ defIndex: GJALLARHORN })).toEqual({
      level: 20,
      requiredLevel: 20,
      quality: 70,
    });
    expect(
      itemPrimaryStat({ defIndex: FATEBRINGER, level: 0, quality: 0 })
    ).toEqual({
      level: 0,
      requiredLevel: 0,
      quality: 60,
    });
  });

  it("a granted item's level and quality win; the required level stays the def's", () => {
    expect(
      itemPrimaryStat({ defIndex: GJALLARHORN, level: 20, quality: 62 })
    ).toEqual({ level: 20, requiredLevel: 20, quality: 62 });
    expect(displayedPrimaryStat(GJALLARHORN, { level: 20, quality: 62 })).toBe(
      365
    );
    expect(
      displayedPrimaryStat(VOIDFANG_VESTMENTS, { level: 20, quality: 62 })
    ).toBe(312);
    expect(displayedPrimaryStat(99_999, { level: 20, quality: 62 })).toBeNull();
  });
});
