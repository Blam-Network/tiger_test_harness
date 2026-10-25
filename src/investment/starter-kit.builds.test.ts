import { expect, it } from "vitest";
import { e_build } from "../builds";
import { describeEachPackages } from "../test-support/build";

// Per build: how its starter emblems are named, and the def the repair
// recreates when a stored kit has none.
const KITS: Partial<
  Record<
    e_build,
    { emblemName: (className: string) => string; emblemDef: number }
  >
> = {
  // the emblem says the class (the titan's says Guardian)
  [e_build.v38464_14_02_28_1027_betath]: {
    emblemName: (name) =>
      `${name === "Titan" ? "Guardian" : name} Class Emblem`,
    emblemDef: 1295,
  },
  // each class's own starter emblem, from the new-character defaults
  [e_build.v39573_14_04_03_1336_ff]: {
    emblemName: (name) => `${name} Starter Emblem`,
    emblemDef: 628,
  },
};

const CLASS_NAMES = ["Titan", "Hunter", "Warlock"];

describeEachPackages(
  "starter kit",
  (build) => {
    const kit = KITS[build];

    it("fills every equip slot with a def of that slot and class", async () => {
      const { equipSlotIds, equipSlotToBucket } = await import(
        "../content/inventory"
      );
      const { itemDef, itemName } = await import("../content/items");
      const { starterKit } = await import("./loadout");
      const slots = equipSlotIds();
      // Neither build has a shader slot filled: the 38464 has none (-1), the
      // 39573 has one (13) that no list fills.
      const filled = equipSlotToBucket()
        .map((_, slot) => slot)
        .filter((slot) => slot !== slots.shader);
      for (const classIndex of [0, 1, 2]) {
        const equipped = starterKit(classIndex).filter(
          (item) => item.slot !== null
        );
        expect(equipped.map((item) => item.slot)).toEqual(filled);
        for (const item of equipped) {
          const def = itemDef(item.defIndex);
          expect(def?.equipSlot, item.label).toBe(item.slot);
          expect(def?.bucket, item.label).toBe(
            equipSlotToBucket()[item.slot as number]
          );
          expect([-1, classIndex], item.label).toContain(def?.classIndex);
        }
        const emblem = equipped.find((item) => item.slot === slots.emblem);
        expect(itemName(emblem?.defIndex ?? -1)).toBe(
          kit?.emblemName(CLASS_NAMES[classIndex])
        );
      }
    }, 60_000);

    it("gives the stored kit an emblem on the next read", async () => {
      const { equipSlotIds } = await import("../content/inventory");
      const { planLoadoutRepair } = await import("./loadout-repair");
      const { starterItems } = await import("./loadout");
      // A titan stored before the kit had an emblem: everything else equipped.
      const rows = starterItems(0)
        .filter((seed) => seed.equipSlot !== equipSlotIds().emblem)
        .map((seed, id) => ({
          id,
          def_index: seed.defIndex,
          bucket: seed.bucket,
          equip_slot: seed.equipSlot,
          instanced: seed.instanced,
          sandbox_pattern: seed.sandboxPattern,
          art_arrangement: seed.artArrangement,
        }));
      const { creates } = planLoadoutRepair(rows, 0);
      expect(creates.map((seed) => seed.defIndex)).toEqual([kit?.emblemDef]);
    }, 60_000);
  },
  Object.keys(KITS) as e_build[]
);
