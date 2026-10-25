import { expect, it } from "vitest";
import {
  bucketIds,
  equipSlotIds,
  equipSlotToBucket,
} from "../content/inventory";
import { itemDef, itemName, tierIds } from "../content/items";
import { describeWithPackages } from "../test-support/build";
import {
  bagIndexForBucket,
  bucketSlotCounts,
  inventoryBucketRanges,
} from "./inventory-layout";
import { CharacterLoadout, weaponStatsFor } from "./loadout";
import { serverPicks } from "./stubs/starter-kit";
import { starterCurrencyDef } from "./stubs/starting-currency";

describeWithPackages("inventory layout", () => {
  it("packs the buckets into one gapless run of bag slots", () => {
    let next = 0;
    for (const bucket of inventoryBucketRanges()) {
      expect(bucket.firstSlot).toBe(next);
      next += bucket.slotCount;
    }
    // Under the 256 slots of the self bag table.
    expect(next).toBe(227);
  });

  it("leaves the 47 slots v4nguard calls missing before the emblems", () => {
    const emblems = inventoryBucketRanges().find(
      (b) => b.id === bucketIds().emblem
    );
    const ghostShells = inventoryBucketRanges().find(
      (b) => b.name === "ghost_shell"
    );
    expect(emblems?.firstSlot).toBe(200);
    const gap =
      (emblems?.firstSlot ?? 0) -
      ((ghostShells?.firstSlot ?? 0) + (ghostShells?.slotCount ?? 0));
    expect(gap).toBe(47);
    expect(bagIndexForBucket(bucketIds().emblem)).toBe(200);
    expect(bucketSlotCounts()[bucketIds().emblem]).toBe(10);
  });
});

describeWithPackages("starter emblem", () => {
  it("is equipped in the emblem slot from the emblem bucket", () => {
    const emblem = CharacterLoadout.stub().equipped(equipSlotIds().emblem);
    expect(emblem?.defIndex).toBe(serverPicks()[equipSlotIds().emblem]);
    expect(emblem?.bucket).toBe(bucketIds().emblem);
  });
});

describeWithPackages("starter kits", () => {
  // Wire class index: 0 titan, 1 hunter, 2 warlock.
  const classes = [0, 1, 2];
  // Every slot but the shader (13): no new-character list grants one.
  const kitSlots = () => [
    equipSlotIds().subclass,
    equipSlotIds().helmet,
    equipSlotIds().gauntlets,
    equipSlotIds().chest,
    equipSlotIds().legs,
    equipSlotIds().classItem,
    equipSlotIds().primary,
    equipSlotIds().special,
    equipSlotIds().heavy,
    equipSlotIds().ship,
    equipSlotIds().vehicle,
    equipSlotIds().ghost,
    equipSlotIds().emblem,
  ];

  it.each(classes)("fills every equip slot with a def (class %i)", (c) => {
    const loadout = CharacterLoadout.stub(c);
    for (const slot of kitSlots()) {
      const item = loadout.equipped(slot);
      const def = item && itemDef(item.defIndex);
      expect(def?.equipSlot, `slot ${slot}`).toBe(slot);
      expect(item?.bucket).toBe(def?.bucket);
      expect(item?.bucket).toBe(equipSlotToBucket()[slot]);
      expect(item?.sandboxPattern).toBe(def?.sandboxPattern);
      expect(item?.artArrangement).toBe(def?.artArrangement);
      expect(item?.instanced).toBe(true);
    }
    expect(loadout.equipped(equipSlotIds().shader)).toBeUndefined();
    expect(loadout.equipped(equipSlotIds().emblem)?.defIndex).toBe(
      serverPicks()[equipSlotIds().emblem]
    );
  });

  it.each(classes)("arms the weapons with their def stats (class %i)", (c) => {
    const loadout = CharacterLoadout.stub(c);
    for (const slot of [
      equipSlotIds().primary,
      equipSlotIds().special,
      equipSlotIds().heavy,
    ]) {
      const weapon = loadout.equipped(slot);
      expect(weapon?.stats.length).toBeGreaterThan(0);
      expect(weapon?.stats).toEqual(weaponStatsFor(weapon?.defIndex ?? -1));
      // Weapons have a real sandbox pattern.
      expect(weapon?.sandboxPattern).toBeGreaterThanOrEqual(0);
    }
  });

  it("gives each class its own subclass and armour", () => {
    const armour = (c: number) =>
      [
        equipSlotIds().subclass,
        equipSlotIds().helmet,
        equipSlotIds().classItem,
      ].map((slot) => CharacterLoadout.stub(c).equipped(slot)?.defIndex);
    // Striker, Gunslinger, Voidwalker; Mark of the Risen, Makeshift Scarf,
    // Potential Bond.
    expect(armour(0)).toEqual([776, 199, 197]);
    expect(armour(1)).toEqual([775, 11, 9]);
    expect(armour(2)).toEqual([779, 387, 385]);
  });

  it("keeps the class emblem and starting currency in the bag", () => {
    const bag = CharacterLoadout.stub(0).items.filter(
      (i) => i.equipSlot === null
    );
    expect(bag.map((i) => i.defIndex)).toEqual([856, starterCurrencyDef()]);
    const soids = CharacterLoadout.stub(0).items.map((i) => i.soid);
    expect(new Set(soids).size).toBe(soids.length);
  });

  it("equips a bag item into its def's slot", () => {
    const loadout = CharacterLoadout.stub(0);
    const emblem = loadout.items.find((i) => i.defIndex === 856)!;
    const change = loadout.equip(emblem.soid);
    expect(change?.equipped.equipSlot).toBe(equipSlotIds().emblem);
    expect(change?.displaced?.defIndex).toBe(
      serverPicks()[equipSlotIds().emblem]
    );
  });
});

describeWithPackages("item defs", () => {
  it("carry the def's name, tier, class and level block", () => {
    // Gjallarhorn: exotic heavy any class may equip, level 20 / quality 70.
    expect(itemName(2075)).toBe("Gjallarhorn");
    expect(itemDef(2075)).toMatchObject({
      bucket: bucketIds().power,
      equipSlot: equipSlotIds().heavy,
      classIndex: -1,
      tier: tierIds().exotic,
      level: 20,
      quality: 70,
    });
    // Class armour names its class through the equip unlock flag.
    expect(itemDef(199)?.classIndex).toBe(0);
    expect(itemDef(11)?.classIndex).toBe(1);
    expect(itemDef(1253)?.classIndex).toBe(2);
    expect(itemName(1253)).toBe("Voidfang Vestments");
    // Names are trimmed; a def without one reads as "".
    expect(itemName(2069)).toBe("Thorn");
    expect(itemName(99_999)).toBe("");
  });
});
