import { closeSync, openSync, readdirSync, readSync } from "node:fs";
import { join } from "node:path";
import { fnv1 } from "@blamnetwork/bullshcript/destiny1/common";
import { describe, expect, it } from "vitest";
import { e_build } from "../../../../builds";
import { buildPackagesDir, hasPackages } from "../../../../test-support/build";
import { contentBuildForTest } from "../../../../test-support/content-build";

const BUILD = e_build.v39573_14_04_03_1336_ff;
const ffBuild = () => contentBuildForTest(BUILD);

// A localized package's language, by its file name's suffix.
const LANGUAGE_OF_SUFFIX: Record<string, number> = {
  en: 1,
  fr: 2,
  it: 3,
  de: 4,
  sp: 5,
};

const PACKAGE_FILE = /_(?:([0-9a-f]{4})_)?(?:(en|fr|it|de|sp)_)?0\.pkg$/;

// Opening the package set takes seconds on a loaded machine.
describe.skipIf(!hasPackages(BUILD))(
  "PS4 ff investment tables",
  { timeout: 60_000 },
  () => {
    const readers = () => ffBuild().readers;

    it("lists the 309 activities and their playlists", () => {
      const activities = readers().activityDefinitions();
      expect(activities).toHaveLength(309);
      expect(activities[0]?.name).toBe("city_tower_default1");
      expect(activities[10]?.name).toBe("cosmo_patrols_1");
      expect(activities[240]?.name).toBe("cosmo_portal_1");
      expect(activities[288]?.name).toBe("dlc_test_activity");
      expect(activities[3]?.name).toBe("");
      expect(activities[236]?.playlist).toEqual([258, 261, 262, 263, 259, 260]);
      expect(activities[308]?.playlist).toEqual([306, 307]);
    });

    it("reads 1662 item definitions, 1093 of them equipable", () => {
      const items = readers().itemDefinitions();
      expect(items).toHaveLength(1662);
      expect(items.filter((item) => item.equipSlot !== null)).toHaveLength(
        1093
      );
      // Falcon A2: its stats are a block, as the Alpha Trial's.
      expect(items[1123]).toMatchObject({
        bucket: 2,
        equipSlot: 6,
        tier: 1,
        instanced: true,
        level: 0,
        gridIndex: 143,
        stats: [
          [0, 0],
          [10, 0],
          [25, 15],
        ],
      });
      // An item whose level block (counted arrays) names a level.
      expect(items[716]).toMatchObject({ level: 10, quality: -9 });
    });

    it("names items from UTF-16 string banks", () => {
      const { itemName } = readers();
      expect(itemName(1123)).toBe("Falcon A2");
      expect(itemName(1429)).toBe("Phaeton Class-A");
      expect(itemName(582)).toBe("Striker Codex");
      // No display name.
      expect(itemName(716)).toBe("");
      expect(itemName(99_999)).toBe("");
    });

    it("lists 27 vendors and their 1782 purchases", () => {
      const vendors = readers().vendors();
      expect(vendors).toHaveLength(27);
      expect(vendors.reduce((n, v) => n + v.purchases.length, 0)).toBe(1782);
      expect(vendors[0]?.currencyDef).toBe(670);
      // A sale's level override is its counted key 0.
      expect(vendors[0]?.purchases[1]).toMatchObject({
        itemDef: 706,
        level: 5,
      });
    });

    it("reads 486 talent grids and the subclasses' ability grants", () => {
      const { talentGrid, talentGridBuildSource } = readers();
      expect(talentGrid(485)).toBeDefined();
      expect(talentGrid(486)).toBeUndefined();
      const slots = new Set<number>();
      for (let i = 0; i < 486; i++) {
        for (const grant of talentGridBuildSource(i).grants) {
          slots.add(grant.slot);
        }
      }
      // Grenade, super, melee, jump, movement.
      expect([...slots].sort()).toEqual([0, 1, 2, 3, 4]);
    });

    it("caps the level at the level progression's 21 steps", () => {
      const { progression, characterConstants, levelProgressionRole } =
        readers();
      const constants = characterConstants();
      // Role 0 names none.
      expect(constants.progressions).toEqual([57, 58, 79, 80, 0]);
      expect(constants.progressions[levelProgressionRole()]).toBe(57);
      const level = progression(57);
      expect(level?.clampAtMax).toBe(false);
      expect(level?.steps.slice(0, 4).map((s) => s.xpRequired)).toEqual([
        0, 2600, 4000, 7000,
      ]);
      expect(constants.levelCap).toBe(21);
      expect(constants.stats[0]).toBe(0);
    });

    it("reads the abilities, server messages and incidents", () => {
      const { abilities, serverMessages, incidentNames } = readers();
      expect(abilities()).toHaveLength(33);
      const messages = serverMessages();
      expect(messages).toHaveLength(67);
      expect(messages.find((m) => m.networkId === 101)?.nameHash).toBe(
        fnv1("director_get_activity_list")
      );
      const names = incidentNames();
      expect(names).toHaveLength(997);
      for (const name of ["player_spawned", "kill", "player_died"]) {
        expect(names, name).toContain(fnv1(name));
      }
    });

    it("reads the curves' counted rows", () => {
      const curves = readers().statCurves();
      expect(curves).toHaveLength(29);
      expect(curves[0]?.points).toEqual([
        { x: 1, y: 100 },
        { x: 5, y: 180 },
        { x: 10, y: 320 },
        { x: 15, y: 500 },
        { x: 20, y: 720 },
        { x: 25, y: 960 },
        { x: 30, y: 1240 },
        { x: 35, y: 1560 },
        { x: 40, y: 1880 },
        { x: 100, y: 6000 },
      ]);
      expect(curves[0]?.qualityPoints).toEqual([
        { x: -100, y: -10 },
        { x: 250, y: 25 },
      ]);
      expect(curves[1]?.points).toEqual([
        { x: 1, y: 0 },
        { x: 201, y: 20_000 },
      ]);
    });

    it("reads the unlock tables and destinations", () => {
      const { unlockTables, recordFlags, clientDestinations } = readers();
      const tables = unlockTables();
      expect(tables.flagOfSlot.account).toHaveLength(766);
      expect(tables.flagOfSlot.offer).toHaveLength(66);
      expect(tables.flagOfSlot.character).toHaveLength(355);
      expect(tables.sources).toHaveLength(1721);
      expect(tables.sources.every((source) => source !== undefined)).toBe(true);
      expect(tables.times).toHaveLength(2370);
      expect(recordFlags()).toHaveLength(326);
      // The rows have no progression blocks.
      const destinations = clientDestinations();
      expect(destinations).toHaveLength(19);
      expect(destinations.every((row) => row.progressions.length === 0)).toBe(
        true
      );
    });

    it("hands each class its armour and its starter emblem", () => {
      const table = readers().newCharacterTable();
      expect(table.startingGear).toEqual([
        { class: 0, items: [155, 157, 159, 161, 163, 628] },
        { class: 1, items: [5, 7, 9, 11, 13, 625] },
        { class: 2, items: [305, 307, 309, 311, 313, 631] },
      ]);
      expect(table.defaults).toHaveLength(9);
      expect(table.defaults[0]?.classFlags).toHaveLength(16);
      expect(
        table.defaults.every((row) =>
          row.flags.every((flag) => flag.value === ffBuild().ids.unlockFlagSet)
        )
      ).toBe(true);
    });

    it("reads little-endian package headers, a language per suffix", () => {
      const { packageHeader, packageHeaderSize, packageLanguage } = readers();
      expect(packageLanguage("english")).toBe(1);
      expect(packageLanguage("klingon")).toBeUndefined();
      const dir = buildPackagesDir(BUILD) as string;
      const header = Buffer.alloc(packageHeaderSize());
      const files = readdirSync(dir).filter((file) => file.endsWith(".pkg"));
      for (const file of files) {
        const fd = openSync(join(dir, file), "r");
        try {
          readSync(fd, header, 0, header.length, 0);
        } finally {
          closeSync(fd);
        }
        const fields = packageHeader(header);
        // ps4_<name>_<id in hex>[_<language>]_0.pkg, but for the unpatchables.
        const [, id, language] = PACKAGE_FILE.exec(file) ?? [];
        expect(fields.language, file).toBe(
          language ? LANGUAGE_OF_SUFFIX[language] : 0
        );
        expect(fields.patch, file).toBe(0);
        if (id) {
          expect(fields.packageId, file).toBe(Number.parseInt(id, 16));
        }
      }
    });
  }
);
