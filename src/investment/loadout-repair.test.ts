import { expect, it } from "vitest";
import { equipSlotIds } from "../content/inventory";
import { itemDef } from "../content/items";
import { describeWithPackages } from "../test-support/build";
import { starterItems } from "./loadout";
import { planLoadoutRepair, type StoredItemRow } from "./loadout-repair";
import { starterCurrencyDef } from "./stubs/starting-currency";

type Row = StoredItemRow & { quantity: number };

// Applies passes the way PrismaCharacterStore.loadoutFor does.
function repair(rows: Row[], classIndex: number): Row[] {
  let next = rows.map((row) => ({ ...row }));
  for (let pass = 0; pass < 3; pass++) {
    const { creates, updates } = planLoadoutRepair(next, classIndex);
    for (const { id, data } of updates) {
      Object.assign(next.find((row) => row.id === id)!, data);
    }
    next = [
      ...next,
      ...creates.map((seed, i) => ({
        id: 1000 * (pass + 1) + i,
        def_index: seed.defIndex,
        bucket: seed.bucket,
        equip_slot: seed.equipSlot,
        sandbox_pattern: seed.sandboxPattern,
        art_arrangement: seed.artArrangement,
        instanced: seed.instanced,
        quantity: seed.quantity,
      })),
    ];
  }
  return next;
}

// The class kit as stored rows.
function kitRows(classIndex: number): Row[] {
  return starterItems(classIndex).map((seed, id) => ({
    id,
    def_index: seed.defIndex,
    bucket: seed.bucket,
    equip_slot: seed.equipSlot,
    sandbox_pattern: seed.sandboxPattern,
    art_arrangement: seed.artArrangement,
    instanced: seed.instanced,
    quantity: seed.quantity,
  }));
}

describeWithPackages("loadout repair", () => {
  it.each([0, 1, 2])("fixes a misplaced kit (class %i)", (classIndex) => {
    const before = kitRows(classIndex);
    // The helmet sits in the primary weapon slot, the weapon is in the bag,
    // and every instanced row has the wrong bucket.
    const helmet = before.find((r) => r.equip_slot === equipSlotIds().helmet)!;
    const primary = before.find(
      (r) => r.equip_slot === equipSlotIds().primary
    )!;
    helmet.equip_slot = equipSlotIds().primary;
    primary.equip_slot = null;
    for (const row of before.filter((r) => r.instanced)) {
      row.bucket = 99;
    }
    before.push({
      id: 99,
      def_index: starterCurrencyDef() as number,
      bucket: 0,
      equip_slot: null,
      sandbox_pattern: 0,
      art_arrangement: 0,
      instanced: false,
      quantity: 500,
    });
    const after = repair(before, classIndex);
    // Nothing is deleted.
    for (const row of before) {
      expect(after.some((r) => r.id === row.id)).toBe(true);
    }
    for (const seed of starterItems(classIndex)) {
      if (seed.equipSlot === null) {
        continue;
      }
      const equipped = after.filter((r) => r.equip_slot === seed.equipSlot);
      expect(
        equipped.map((r) => r.def_index),
        `slot ${seed.equipSlot}`
      ).toEqual([seed.defIndex]);
    }
    expect(after.some((r) => r.equip_slot === equipSlotIds().shader)).toBe(
      false
    );
    // Every instanced row now sits in its def's own bucket.
    for (const row of after.filter((r) => r.instanced)) {
      expect(row.bucket).toBe(itemDef(row.def_index)?.bucket);
    }
    expect(after.find((r) => r.id === 99)).toMatchObject({
      bucket: 0,
      quantity: 500,
    });
    // A second read has nothing left to do.
    expect(planLoadoutRepair(after, classIndex)).toEqual({
      creates: [],
      updates: [],
    });
  });

  it("leaves a fresh kit alone", () => {
    expect(planLoadoutRepair(kitRows(0), 0)).toEqual({
      creates: [],
      updates: [],
    });
  });

  // A non-kit weapon the player equipped: Trax Callum II, a tier 1 scout
  // rifle, in place of the kit's Khvostov.
  function withEquippedScoutRifle(): Row[] {
    const rows = kitRows(0);
    const kinetic = rows.find((r) => r.equip_slot === equipSlotIds().primary)!;
    kinetic.equip_slot = null;
    rows.push({
      id: 500,
      def_index: 3165,
      bucket: 2,
      equip_slot: equipSlotIds().primary,
      sandbox_pattern: 14,
      art_arrangement: 2710,
      instanced: true,
      quantity: 1,
    });
    return rows;
  }

  it("keeps a valid weapon the player equipped when granted equips are allowed", () => {
    expect(
      planLoadoutRepair(withEquippedScoutRifle(), 0, {
        allowGrantedEquip: true,
      })
    ).toEqual({ creates: [], updates: [] });
  });

  it("sends non-kit gear back to the bag and refills the slot by default", () => {
    const rows = withEquippedScoutRifle();
    const khvostov = rows.find((r) => r.def_index === 3159)!;
    expect(planLoadoutRepair(rows, 0).updates).toEqual([
      { id: 500, data: { equip_slot: null } },
      { id: khvostov.id, data: { equip_slot: equipSlotIds().primary } },
    ]);
    // The same for armour: the granted VoG helmet that crashed the console.
    const armour = kitRows(2);
    const kitHelmet = armour.find(
      (r) => r.equip_slot === equipSlotIds().helmet
    )!;
    kitHelmet.equip_slot = null;
    armour.push({
      id: 501,
      def_index: 1356,
      bucket: 7,
      equip_slot: equipSlotIds().helmet,
      sandbox_pattern: -1,
      art_arrangement: 1115,
      instanced: true,
      quantity: 1,
    });
    expect(planLoadoutRepair(armour, 2).updates).toEqual([
      { id: 501, data: { equip_slot: null } },
      { id: kitHelmet.id, data: { equip_slot: equipSlotIds().helmet } },
    ]);
    // ... and stays equipped when granted equips are allowed.
    expect(planLoadoutRepair(armour, 2, { allowGrantedEquip: true })).toEqual({
      creates: [],
      updates: [],
    });
    // Emblems and the like are not gear the character build renders.
    const emblem = kitRows(2);
    const kitEmblem = emblem.find(
      (r) => r.equip_slot === equipSlotIds().emblem
    )!;
    kitEmblem.equip_slot = null;
    emblem.push({
      id: 502,
      def_index: 859,
      bucket: 25,
      equip_slot: equipSlotIds().emblem,
      sandbox_pattern: -1,
      art_arrangement: -1,
      instanced: true,
      quantity: 1,
    });
    expect(planLoadoutRepair(emblem, 2)).toEqual({ creates: [], updates: [] });
  });

  it("refills a kit slot the player left empty", () => {
    const rows = kitRows(2);
    const kinetic = rows.find((r) => r.equip_slot === equipSlotIds().primary)!;
    kinetic.equip_slot = null;
    expect(planLoadoutRepair(rows, 2).updates).toEqual([
      { id: kinetic.id, data: { equip_slot: equipSlotIds().primary } },
    ]);
  });
});
