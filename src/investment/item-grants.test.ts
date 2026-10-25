import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { bucketIds, equipSlotIds } from "../content/inventory";
import { itemDef, itemName, tierIds } from "../content/items";
import {
  type ItemGrant,
  type ItemGrants,
  itemGrantsFile,
  readItemGrants,
} from "../dev-config/item-grants";
import { describeWithPackages } from "../test-support/build";
import { bucketSlotCounts } from "./inventory-layout";
import { planItemGrants } from "./item-grants";
import { starterItems } from "./loadout";
import type { StoredItemRow } from "./loadout-repair";

const TITAN = 0;
const WARLOCK = 2;
const SOID = 0x200000001n;
const GJALLARHORN = 2075;
const THORN = 2069;
const VOIDFANG_VESTMENTS = 1253;
const HELM_OF_SAINT_14 = 1092;
const HEAVIES = [2075, 2076, 2071, 2072, 2205, 2207, 2309, 2312, 2111, 2095];
const gearBuckets = () => [
  bucketIds().kinetic,
  bucketIds().energy,
  bucketIds().power,
  bucketIds().helmet,
  bucketIds().gauntlets,
  bucketIds().chest,
  bucketIds().legs,
  bucketIds().classItem,
];

// A character's rows as the store reads them: the starter kit.
function kitRows(classIndex: number): StoredItemRow[] {
  return starterItems(classIndex).map((seed, i) => ({
    id: i + 1,
    def_index: seed.defIndex,
    bucket: seed.bucket,
    equip_slot: seed.equipSlot,
    instanced: seed.instanced,
    sandbox_pattern: seed.sandboxPattern,
    art_arrangement: seed.artArrangement,
  }));
}

function grants(
  list: (Partial<ItemGrant> & { defIndex: number })[],
  defaults: ItemGrants["defaults"] = { level: 20, quality: 62 }
): ItemGrants {
  return { defaults, grants: list.map((g) => ({ equip: false, ...g })) };
}

describeWithPackages("item grants plan", () => {
  it("grants a missing def to the bag with the file's level and quality", () => {
    const plan = planItemGrants(
      kitRows(WARLOCK),
      WARLOCK,
      SOID,
      grants([{ defIndex: GJALLARHORN, label: "Gjallarhorn" }])
    );
    const def = itemDef(GJALLARHORN)!;
    expect(plan.creates).toEqual([
      {
        defIndex: GJALLARHORN,
        bucket: bucketIds().power,
        sandboxPattern: def.sandboxPattern,
        artArrangement: def.artArrangement,
        equipSlot: null,
        instanced: true,
        quantity: 1,
        power: 0,
        level: 20,
        quality: 62,
      },
    ]);
    expect(plan.updates).toEqual([]);
    expect(plan.skipped).toEqual([]);
  });

  it("a grant's own level and quality win over the defaults", () => {
    const plan = planItemGrants(
      kitRows(WARLOCK),
      WARLOCK,
      SOID,
      grants([{ defIndex: THORN, quality: 43 }])
    );
    expect(plan.creates[0]).toMatchObject({ level: 20, quality: 43 });
  });

  it("is idempotent: a def the character holds is not granted again", () => {
    const rows = kitRows(WARLOCK);
    rows.push({
      ...rows[0]!,
      id: 99,
      def_index: GJALLARHORN,
      bucket: bucketIds().power,
      equip_slot: null,
    });
    const plan = planItemGrants(
      rows,
      WARLOCK,
      SOID,
      grants([{ defIndex: GJALLARHORN }])
    );
    expect(plan.creates).toEqual([]);
    expect(plan.skipped.map((s) => s.reason)).toEqual(["already owned"]);
  });

  it("only grants class armour to that class", () => {
    const list = grants([
      { defIndex: VOIDFANG_VESTMENTS },
      { defIndex: HELM_OF_SAINT_14 },
    ]);
    const warlock = planItemGrants(kitRows(WARLOCK), WARLOCK, SOID, list);
    expect(warlock.creates.map((c) => c.defIndex)).toEqual([
      VOIDFANG_VESTMENTS,
    ]);
    expect(warlock.skipped).toEqual([
      { grant: list.grants[1], reason: "class" },
    ]);
    const titan = planItemGrants(kitRows(TITAN), TITAN, SOID, list);
    expect(titan.creates.map((c) => c.defIndex)).toEqual([HELM_OF_SAINT_14]);
  });

  it("skips a label that does not name the def, an unknown def and a non-equipable one", () => {
    const plan = planItemGrants(
      kitRows(WARLOCK),
      WARLOCK,
      SOID,
      grants([
        { defIndex: GJALLARHORN, label: "Thorn" },
        { defIndex: 99_999 },
        // An engram: no equip slot.
        { defIndex: 1733, label: "Exotic Engram" },
      ])
    );
    expect(plan.creates).toEqual([]);
    expect(plan.skipped.map((s) => s.reason)).toEqual([
      "label mismatch",
      "unknown def",
      "not equipable",
    ]);
  });

  it("fills a bucket no further than its slot count", () => {
    const plan = planItemGrants(
      kitRows(WARLOCK),
      WARLOCK,
      SOID,
      grants(HEAVIES.map((defIndex) => ({ defIndex })))
    );
    // The kit's Baron RS/2 holds one of the ten slots.
    expect(plan.creates).toHaveLength(
      bucketSlotCounts()[bucketIds().power]! - 1
    );
    expect(plan.skipped).toEqual([
      {
        grant: expect.objectContaining({ defIndex: HEAVIES.at(-1) }),
        reason: "bucket full",
      },
    ]);
  });

  it("equips on grant and sends the kit weapon back to the bag", () => {
    const rows = kitRows(WARLOCK);
    const kitPrimary = rows.find(
      (r) => r.equip_slot === equipSlotIds().primary
    )!;
    const plan = planItemGrants(
      rows,
      WARLOCK,
      SOID,
      grants([{ defIndex: THORN, equip: true }])
    );
    expect(plan.creates[0]?.equipSlot).toBe(equipSlotIds().primary);
    expect(plan.updates).toEqual([
      { id: kitPrimary.id, data: { equip_slot: null } },
    ]);
  });

  it("honours a grant's character list", () => {
    const plan = planItemGrants(
      kitRows(WARLOCK),
      WARLOCK,
      SOID,
      grants([
        { defIndex: THORN, characters: [0x200000002n] },
        { defIndex: GJALLARHORN, characters: [SOID] },
      ])
    );
    expect(plan.creates.map((c) => c.defIndex)).toEqual([GJALLARHORN]);
    expect(plan.skipped.map((s) => s.reason)).toEqual(["other character"]);
  });
});

describeWithPackages("item grants shipped list", () => {
  // The list shipped in the repo root: real legendary / exotic gear that
  // fits a fresh character of its class.
  const shipped = join(__dirname, "../..", itemGrantsFile());

  // The file is optional dev config, so a checkout without it skips.
  it.skipIf(!existsSync(shipped))(
    "the shipped list grants only real gear, named right, that fits each class",
    () => {
      const read = readItemGrants(() => readFileSync(shipped));
      expect(read.problems).toEqual([]);
      expect(read.grants.grants.length).toBeGreaterThan(0);
      for (const grant of read.grants.grants) {
        const def = itemDef(grant.defIndex);
        expect(def, `def ${grant.defIndex}`).toBeDefined();
        expect(grant.label).toBe(itemName(grant.defIndex));
        expect(def?.tier).toBeGreaterThanOrEqual(tierIds().legendary);
        expect(def?.equipSlot).not.toBeNull();
        expect(gearBuckets()).toContain(def?.bucket);
        expect(grant.equip).toBe(false);
      }
      for (const classIndex of [0, 1, 2]) {
        const plan = planItemGrants(
          kitRows(classIndex),
          classIndex,
          SOID,
          read.grants
        );
        expect(plan.skipped.map((s) => s.reason)).toEqual(
          plan.skipped.map(() => "class")
        );
        for (const bucket of gearBuckets()) {
          expect(
            plan.creates.filter((c) => c.bucket === bucket).length
          ).toBeLessThan(bucketSlotCounts()[bucket]! - 1);
        }
      }
    }
  );
});
