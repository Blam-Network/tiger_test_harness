import { expect, it } from "vitest";
import { e_build } from "../builds";
import { describeEachPackages } from "../test-support/build";

// Per build: the neutral modules over its readers. The ids against its own
// inventory table, and the starting kit they assemble.
interface NewCharacterExpectation {
  // character scope bag slots
  bagSlots: number;
  // [first flag, last flag, wire class] per class
  classFlags: [number, number, number][];
  // the first class's defaults; the other classes' subclasses
  defaults: { items: Record<number, number>; subclass: number };
  equipSlots: number;
  otherSubclasses: [number, number];
  // equipable items outside their slot's bucket: the 38464's bounties
  // (bucket 16) name the helmet's slot (1)
  strays: number;
}

const BUILDS: Partial<Record<e_build, NewCharacterExpectation>> = {
  [e_build.v38464_14_02_28_1027_betath]: {
    bagSlots: 231,
    classFlags: [
      [1207, 1213, 0],
      [1214, 1220, 1],
      [1232, 1238, 2],
    ],
    // Fist of Mjolnir, Edgewalker, Heart of Fusion.
    defaults: {
      subclass: 635,
      items: { 1: 13, 2: 7, 3: 9, 4: 15, 5: 11, 6: 1605 },
    },
    equipSlots: 13,
    otherSubclasses: [638, 641],
    strays: 38,
  },
  [e_build.v39573_14_04_03_1336_ff]: {
    bagSlots: 231,
    classFlags: [
      [1393, 1399, 0],
      [1375, 1381, 1],
      [1400, 1406, 2],
    ],
    // Striker Codex with the armour and the Titan Starter Emblem; Edgewalker
    // and Order of the Sun.
    defaults: {
      subclass: 582,
      items: { 1: 161, 2: 155, 3: 157, 4: 163, 5: 159, 12: 628 },
    },
    equipSlots: 14,
    otherSubclasses: [579, 585],
    strays: 0,
  },
  [e_build.v40662_14_05_19_1414_pubalpha]: {
    bagSlots: 226,
    classFlags: [
      [1492, 1498, 0],
      [1470, 1476, 1],
      [1499, 1505, 2],
    ],
    // Striker, Gunslinger, Voidwalker.
    defaults: {
      subclass: 650,
      items: { 1: 161, 2: 155, 3: 157, 4: 163, 5: 159, 12: 730 },
    },
    equipSlots: 14,
    otherSubclasses: [649, 653],
    strays: 0,
  },
};

describeEachPackages(
  "inventory and new characters",
  (build) => {
    const expected = BUILDS[build] as NewCharacterExpectation;

    it("lays the character scope out in one gapless run of bag slots", async () => {
      const { inventoryBuckets } = await import("./inventory");
      let next = 0;
      for (const bucket of inventoryBuckets()) {
        expect(bucket.firstSlot).toBe(next);
        next += bucket.slotCount;
      }
      expect(next).toBe(expected.bagSlots);
    });

    it("agrees with the named equip slots and buckets", async () => {
      const { bucketIds, equipSlotIds, equipSlotToBucket } = await import(
        "./inventory"
      );
      const { itemDefs } = await import("./items");
      const slots = equipSlotIds();
      const buckets = bucketIds();
      expect(equipSlotToBucket()).toHaveLength(expected.equipSlots);
      for (const [slot, bucket] of [
        [slots.subclass, buckets.subclass],
        [slots.helmet, buckets.helmet],
        [slots.gauntlets, buckets.gauntlets],
        [slots.chest, buckets.chest],
        [slots.legs, buckets.legs],
        [slots.classItem, buckets.classItem],
        [slots.primary, buckets.kinetic],
        [slots.special, buckets.energy],
        [slots.heavy, buckets.power],
        [slots.emblem, buckets.emblem],
      ] as const) {
        expect(equipSlotToBucket()[slot]).toBe(bucket);
      }
      // Every equipable item sits in its slot's bucket, but for the strays.
      const stray = itemDefs().filter(
        (def) =>
          def.equipSlot !== null &&
          equipSlotToBucket()[def.equipSlot] !== def.bucket
      );
      expect(stray).toHaveLength(expected.strays);
      expect(
        stray.every((def) => def.bucket === 16 && def.equipSlot === 1)
      ).toBe(true);
    });

    it("tiers: exotic the top", async () => {
      const { itemDefs, tierIds } = await import("./items");
      const tiers = itemDefs().map((def) => def.tier);
      expect(Math.max(...tiers)).toBe(tierIds().exotic);
    });

    it("fills each starter pick's slot with an item of that slot", async () => {
      const { equipSlotIds } = await import("./inventory");
      const { itemDef } = await import("./items");
      const { contentBuild } = await import("./versions");
      const slots = equipSlotIds();
      for (const [slot, def] of Object.entries(
        contentBuild().ids.starterPicks
      )) {
        expect(itemDef(def as number)?.equipSlot, slot).toBe(
          slots[slot as keyof typeof slots]
        );
      }
    });

    it("names each class's flags and starting subclass", async () => {
      const { classFlagRanges } = await import("./class-flags");
      const { newCharacterDefaults } = await import("./new-character");
      expect(classFlagRanges()).toEqual(expected.classFlags);
      expect(newCharacterDefaults(0)).toEqual(expected.defaults);
      expect(newCharacterDefaults(1)?.subclass).toBe(
        expected.otherSubclasses[0]
      );
      expect(newCharacterDefaults(2)?.subclass).toBe(
        expected.otherSubclasses[1]
      );
      expect(newCharacterDefaults(3)).toBeUndefined();
    });
  },
  Object.keys(BUILDS) as e_build[]
);
