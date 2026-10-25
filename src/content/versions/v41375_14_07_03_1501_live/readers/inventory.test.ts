import { expect, it } from "vitest";
import { describeWithPackages } from "../../../../test-support/build";
import {
  bucketIds,
  equipSlotIds,
  equipSlotToBucket,
  inventoryBuckets,
  weaponBuckets,
} from "../../../inventory";

describeWithPackages("inventory buckets", () => {
  it("lays the character scope out in one gapless run of bag slots", () => {
    let next = 0;
    for (const bucket of inventoryBuckets()) {
      expect(bucket.firstSlot).toBe(next);
      next += bucket.slotCount;
    }
    expect(next).toBe(227);
  });

  it("puts one bucket on each of the 14 equip slots", () => {
    expect(equipSlotToBucket()).toHaveLength(14);
  });

  it("agrees with the named equip slots and buckets", () => {
    const named = [
      [equipSlotIds().subclass, bucketIds().subclass],
      [equipSlotIds().helmet, bucketIds().helmet],
      [equipSlotIds().gauntlets, bucketIds().gauntlets],
      [equipSlotIds().chest, bucketIds().chest],
      [equipSlotIds().legs, bucketIds().legs],
      [equipSlotIds().classItem, bucketIds().classItem],
      [equipSlotIds().primary, bucketIds().kinetic],
      [equipSlotIds().special, bucketIds().energy],
      [equipSlotIds().heavy, bucketIds().power],
      [equipSlotIds().emblem, bucketIds().emblem],
    ] as const;
    for (const [slot, bucket] of named) {
      expect(equipSlotToBucket()[slot]).toBe(bucket);
    }
    expect([...weaponBuckets()]).toEqual([
      equipSlotToBucket()[equipSlotIds().primary],
      equipSlotToBucket()[equipSlotIds().special],
      equipSlotToBucket()[equipSlotIds().heavy],
    ]);
  });
});
