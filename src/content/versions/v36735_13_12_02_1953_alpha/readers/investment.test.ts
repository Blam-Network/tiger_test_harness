import { fnv1 } from "@blamnetwork/bullshcript/destiny1/common";
import { describe, expect, it } from "vitest";
import { e_build } from "../../../../builds";
import { hasPackages } from "../../../../test-support/build";
import { contentBuildForTest } from "../../../../test-support/content-build";

const BUILD = e_build.v36735_13_12_02_1953_alpha;
const alphaBuild = () => contentBuildForTest(BUILD);

// Opening the package set takes seconds on a loaded machine.
describe.skipIf(!hasPackages(BUILD))(
  "alpha investment tables",
  { timeout: 60_000 },
  () => {
    const readers = () => alphaBuild().readers;

    it("lists the 295 activities, 28 of them playlists", () => {
      const activities = readers().activityDefinitions();
      expect(activities).toHaveLength(295);
      expect(activities[0]?.name).toBe("city_tower_default1");
      // The definition names only a fallback.
      expect(activities[15]?.name).toBe("action_mock");
      expect(activities[4]?.name).toBe("venus_portal_1");
      expect(activities.filter((a) => a.playlist.length > 0)).toHaveLength(28);
    });

    it("reads a playlist's picks and their weights", () => {
      const activities = readers().activityDefinitions();
      expect(activities[8]).toMatchObject({
        playlist: [5, 6, 7],
        playlistWeights: [1, 1, 1],
      });
      expect(activities[293]).toMatchObject({
        playlist: [291, 292],
        playlistWeights: [1, 0],
      });
      expect(activities[19]?.playlist).toEqual([25, 27, 21, 23, 28]);
    });

    it("reads 983 item definitions, 706 of them equipable", () => {
      const items = readers().itemDefinitions();
      expect(items).toHaveLength(983);
      expect(items.filter((item) => item.equipSlot !== null)).toHaveLength(706);
    });

    it("names an item's talent grid by the grid table row", () => {
      const items = readers().itemDefinitions();
      expect([964, 965, 966, 974].map((i) => items[i]?.gridIndex)).toEqual([
        387, 392, 395, 254,
      ]);
      expect(items[0]?.gridIndex).toBe(0);
      expect(items[4]?.gridIndex).toBe(1);
    });

    it("takes an item's tier from its display and keeps its scaling", () => {
      const items = readers().itemDefinitions();
      const tiers = new Set(items.map((item) => item.tier));
      expect([...tiers].sort()).toEqual([0, 1, 2, 3, 4]);
      expect(items[974]?.scaling).toBeDefined();
      expect(items[0]?.classFlag).toBeNull();
    });

    it("names items from the string lists, placeholders as they are", () => {
      expect(readers().itemName(0)).toMatch(/^str\d+$/);
      expect(readers().itemName(99_999)).toBe("");
    });

    it("lists 32 vendors and their 163 purchases", () => {
      const vendors = readers().vendors();
      expect(vendors).toHaveLength(32);
      expect(vendors.reduce((n, v) => n + v.purchases.length, 0)).toBe(163);
      expect(vendors[0]?.purchases[0]).toEqual({
        itemDef: 456,
        quantity: 100,
        explicitCost: true,
        costDef: 456,
        costQuantity: 0,
        level: 0,
        power: undefined,
      });
    });

    it("reads 401 talent grids", () => {
      const { talentGrid } = readers();
      expect(talentGrid(400)?.nodes).toHaveLength(2);
      expect(talentGrid(401)).toBeUndefined();
      expect(talentGrid(364)).toMatchObject({ progression: 48 });
      expect(talentGrid(364)?.nodes).toHaveLength(7);
      // No progression is 255 in the tag.
      expect(talentGrid(380)?.progression).toBe(-1);
    });

    it("reads the character level progression, 12, with its 101 steps", () => {
      const { progression, characterConstants, levelProgressionRole } =
        readers();
      const level = progression(12);
      expect(level?.steps).toHaveLength(101);
      expect(level?.clampAtMax).toBe(false);
      expect(level?.steps.reduce((sum, s) => sum + s.xpRequired, 0)).toBe(
        989_000
      );
      expect(level?.steps.slice(0, 6).map((s) => s.xpRequired)).toEqual([
        0, 5000, 8000, 8000, 9000, 9000,
      ]);
      const granted = (level?.steps ?? [])
        .map((s, i) => [i, s.grantedItem] as const)
        .filter(([, item]) => item !== 0xff_ff);
      expect(granted).toEqual([
        [1, 496],
        [2, 497],
        [4, 498],
        [9, 495],
      ]);
      expect(progression(0)?.steps).toEqual([
        { xpRequired: 75, grantedItem: 553 },
      ]);
      expect(progression(52)).toBeDefined();
      expect(progression(53)).toBeUndefined();
      const constants = characterConstants();
      expect(constants.progressions[levelProgressionRole()]).toBe(12);
      expect(constants.levelCap).toBe(101);
      expect(constants.stats.slice(0, 3)).toEqual([0, 1, 2]);
    });

    it("reads the 42 abilities", () => {
      const abilities = readers().abilities();
      expect(abilities).toHaveLength(42);
      expect(abilities.map((a) => a.nameHash)).toContain(
        fnv1("ability_fist_of_havoc")
      );
    });

    it("reads the 56 server messages, 101 and 401 among them", () => {
      const messages = readers().serverMessages();
      expect(messages).toHaveLength(56);
      const ids = new Set(messages.map((m) => m.networkId));
      expect(ids.has(101)).toBe(true);
      expect(ids.has(401)).toBe(true);
      expect(messages.find((m) => m.networkId === 101)?.nameHash).toBe(
        fnv1("director_get_activity_list")
      );
      expect(messages.find((m) => m.networkId === 401)?.nameHash).toBe(
        fnv1("inventory_destroy_item")
      );
    });

    it("reads the 434 incidents, the known ones among them", () => {
      const names = readers().incidentNames();
      expect(names).toHaveLength(434);
      for (const name of [
        "player_trigger",
        "sequence",
        "player_spawned",
        "player_resurrected",
        "gather_material",
        "interaction",
        "cinematic_finished",
        "any_kill",
        "kill",
        "kill_player_to_ai",
        "player_died",
      ]) {
        expect(names, name).toContain(fnv1(name));
      }
    });

    it("lays the bag out in one gapless run from each bucket's first slot", () => {
      const { rows, unequippable } = readers().inventoryTable();
      expect(unequippable).toEqual([0, 6, 1, 2, 17, 21, 18, 20]);
      let next = 0;
      for (const row of rows) {
        expect(row.firstSlot).toBe(next);
        next += row.slotCount;
      }
      expect(next).toBe(255);
      const start = Object.fromEntries(rows.map((r) => [r.id, r.firstSlot]));
      expect(
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(
          (id) => start[id]
        )
      ).toEqual([
        0, 30, 50, 115, 125, 135, 10, 60, 65, 75, 85, 95, 105, 145, 155, 165,
      ]);
    });

    it("names the equip slots' buckets in the ids", () => {
      const { ids, readers: r } = alphaBuild();
      const { rows, unequippable } = r.inventoryTable();
      // An item's equip slot is its bucket's ordinal among the equippable rows,
      // from 1.
      const slotBuckets = [
        undefined,
        ...rows.map((row) => row.id).filter((id) => !unequippable.includes(id)),
      ];
      expect(slotBuckets.slice(1)).toEqual([
        7, 8, 9, 10, 11, 12, 3, 4, 5, 13, 14, 15, 16, 22, 19,
      ]);
      const { equipSlot, bucket } = ids;
      for (const [slot, id] of [
        [equipSlot.subclass, bucket.subclass],
        [equipSlot.helmet, bucket.helmet],
        [equipSlot.gauntlets, bucket.gauntlets],
        [equipSlot.chest, bucket.chest],
        [equipSlot.legs, bucket.legs],
        [equipSlot.classItem, bucket.classItem],
        [equipSlot.primary, bucket.kinetic],
        [equipSlot.special, bucket.energy],
        [equipSlot.heavy, bucket.power],
      ] as const) {
        expect(slotBuckets[slot]).toBe(id);
      }
      // Every equipable item sits in its slot's bucket but one.
      const items = r.itemDefinitions();
      const equipable = items.filter((item) => item.equipSlot !== null);
      const stray = equipable.filter(
        (item) => slotBuckets[item.equipSlot as number] !== item.bucket
      );
      expect(stray).toHaveLength(1);
    });

    it("tiers: the alpha has five, exotic the top", () => {
      const { ids, readers: r } = alphaBuild();
      const tiers = r.itemDefinitions().map((item) => item.tier);
      expect(Math.max(...tiers)).toBe(ids.tier.exotic);
      expect(ids.tier.legendary).toBeLessThan(ids.tier.exotic);
    });

    it("hands each class its starting gear and each class and race its flags", () => {
      const table = readers().newCharacterTable();
      expect(table.startingGear).toEqual([
        { class: 0, items: [17, 19, 21, 23, 25, 964] },
        { class: 1, items: [130, 132, 134, 136, 138, 966] },
        { class: 2, items: [243, 245, 247, 249, 251, 965] },
      ]);
      expect(table.defaults).toHaveLength(9);
      expect(table.defaults[0]?.flags).toHaveLength(19);
      expect(table.defaults.every((row) => row.classFlags.length === 0)).toBe(
        true
      );
      expect(table.defaults[0]?.flags[0]?.value).toBe(
        alphaBuild().ids.unlockFlagSet
      );
    });

    it("reads the power and weapon power curves", () => {
      const curves = readers().statCurves();
      expect(curves).toHaveLength(29);
      expect(curves[0]?.points).toEqual([
        { x: 0, y: 50 },
        { x: 20, y: 1050 },
        { x: 200, y: 10_050 },
      ]);
      expect(curves[0]?.qualityPoints).toEqual([
        { x: -10, y: -10 },
        { x: 25, y: 25 },
      ]);
      expect(curves[0]?.damageWeights).toHaveLength(5);
      expect(curves[0]?.slotWeights).toEqual([]);
      expect(curves[5]?.points).toEqual([
        { x: 0, y: 10 },
        { x: 100, y: 1010 },
      ]);
      expect(curves[1]?.points).toEqual([]);
    });

    it("reads the unlock tables", () => {
      const tables = readers().unlockTables();
      expect(tables.flagOfSlot.account).toHaveLength(121);
      expect(tables.flagOfSlot.offer).toHaveLength(15);
      expect(tables.flagOfSlot.character).toHaveLength(357);
      expect(tables.sources).toHaveLength(627);
      expect(tables.times).toHaveLength(258);
      const set = alphaBuild().ids.unlockFlagSet;
      expect(new Set(tables.times.map((row) => row.value))).toEqual(
        new Set([1, set])
      );
    });

    it("reads the 51 achievement flags as its records, and no destination progressions", () => {
      const flags = readers().recordFlags();
      expect(flags).toHaveLength(51);
      expect(
        flags.every((flag) => flag < readers().unlockTables().sources.length)
      ).toBe(true);
      const destinations = readers().clientDestinations();
      expect(destinations).toHaveLength(8);
      expect(destinations.every((d) => d.progressions.length === 0)).toBe(true);
    });

    it("reads a package header and names its one language", () => {
      const { packageLanguage, packageHeaderSize } = readers();
      expect(packageHeaderSize()).toBe(312);
      expect(packageLanguage("english")).toBe(1);
      expect(packageLanguage("french")).toBeUndefined();
    });
  }
);
