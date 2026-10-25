import { closeSync, openSync, readdirSync, readSync } from "node:fs";
import { join } from "node:path";
import { fnv1 } from "@blamnetwork/bullshcript/destiny1/common";
import { describe, expect, it } from "vitest";
import { e_build } from "../../../../builds";
import { buildPackagesDir, hasPackages } from "../../../../test-support/build";
import { contentBuildForTest } from "../../../../test-support/content-build";

const BUILD = e_build.v40662_14_05_19_1414_pubalpha;
const pubalphaBuild = () => contentBuildForTest(BUILD);

// Opening the package set takes seconds on a loaded machine.
describe.skipIf(!hasPackages(BUILD))(
  "PS4 Alpha Trial investment tables",
  () => {
    const readers = () => pubalphaBuild().readers;

    it("lists the 202 activities and their playlists", () => {
      const activities = readers().activityDefinitions();
      expect(activities).toHaveLength(202);
      expect(activities[0]?.name).toBe("city_tower_default1");
      expect(activities[3]?.name).toBe("cosmo_portal_1");
      expect(activities[83]?.name).toBe("act_cosmo_m0_highway");
      expect(activities[185]?.name).toBe("action_mock");
      expect(activities[1]?.name).toBe("");
      expect(activities[5]?.playlist).toEqual([48, 63]);
      expect(activities[200]?.playlist).toEqual([198]);
    });

    it("reads 1786 item definitions, 1083 of them equipable", () => {
      const items = readers().itemDefinitions();
      expect(items).toHaveLength(1786);
      expect(items.filter((item) => item.equipSlot !== null)).toHaveLength(
        1083
      );
      // Khvostov 7G-02.
      expect(items[1764]).toMatchObject({
        bucket: 2,
        equipSlot: 6,
        tier: 1,
        instanced: true,
      });
    });

    it("names items from UTF-16 string banks", () => {
      const { itemName } = readers();
      expect(itemName(1764)).toBe("Khvostov 7G-02");
      expect(itemName(1550)).toBe("Phaeton Class v1");
      expect(itemName(5)).toBe("Prototype 0.9b");
      // No display name.
      expect(itemName(0)).toBe("");
      expect(itemName(99_999)).toBe("");
    });

    it("lists 27 vendors and their 1565 purchases", () => {
      const vendors = readers().vendors();
      expect(vendors).toHaveLength(27);
      expect(vendors.reduce((n, v) => n + v.purchases.length, 0)).toBe(1565);
      expect(vendors[0]?.currencyDef).toBe(773);
    });

    it("reads 227 talent grids and the subclasses' ability grants", () => {
      const { talentGrid, talentGridBuildSource } = readers();
      expect(talentGrid(226)).toBeDefined();
      expect(talentGrid(227)).toBeUndefined();
      const slots = new Set<number>();
      for (let i = 0; i < 227; i++) {
        for (const grant of talentGridBuildSource(i).grants) {
          slots.add(grant.slot);
        }
      }
      // Grenade, super, melee, jump, movement.
      expect([...slots].sort()).toEqual([0, 1, 2, 3, 4]);
    });

    it("caps the level at the level progression's 20 steps", () => {
      const { progression, characterConstants, levelProgressionRole } =
        readers();
      const constants = characterConstants();
      expect(constants.progressions).toEqual([104, 105, 107, 106, 184, 185]);
      expect(constants.progressions[levelProgressionRole()]).toBe(105);
      const level = progression(105);
      expect(level?.clampAtMax).toBe(false);
      expect(level?.steps.slice(0, 4).map((s) => s.xpRequired)).toEqual([
        0, 2600, 4000, 7000,
      ]);
      expect(constants.levelCap).toBe(level?.steps.length);
      expect(constants.levelCap).toBe(20);
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
      expect(names).toHaveLength(1330);
      for (const name of ["player_spawned", "kill", "player_died"]) {
        expect(names, name).toContain(fnv1(name));
      }
    });

    it("reads the curves' counted rows", () => {
      const curves = readers().statCurves();
      expect(curves).toHaveLength(31);
      expect(curves[0]?.points).toEqual([
        { x: 1, y: 0 },
        { x: 20, y: 1 },
        { x: 20, y: 8 },
        { x: 21, y: 20 },
        { x: 30, y: 120 },
        { x: 40, y: 240 },
        { x: 50, y: 400 },
      ]);
      expect(curves[1]?.qualityPoints).toEqual([
        { x: -100, y: -10 },
        { x: 250, y: 25 },
      ]);
      expect(
        curves[1]?.slotWeights.map((w) => [w.equipSlot, w.weight])
      ).toEqual([
        [1, 33],
        [2, 27],
        [3, 36],
        [4, 24],
      ]);
    });

    it("reads the unlock tables and destinations", () => {
      const { unlockTables, recordFlags, clientDestinations } = readers();
      const tables = unlockTables();
      expect(tables.flagOfSlot.account).toHaveLength(867);
      expect(tables.flagOfSlot.offer).toHaveLength(132);
      expect(tables.flagOfSlot.character).toHaveLength(482);
      expect(tables.sources).toHaveLength(1784);
      expect(tables.sources.every((source) => source !== undefined)).toBe(true);
      expect(recordFlags()).toHaveLength(562);
      expect(clientDestinations()[14]?.progressions).toEqual([113, 116]);
    });

    it("hands each class its armour and emblem", () => {
      const table = readers().newCharacterTable();
      expect(table.startingGear).toEqual([
        { class: 0, items: [155, 157, 159, 161, 163, 730] },
        { class: 1, items: [5, 7, 9, 11, 13, 727] },
        { class: 2, items: [305, 307, 309, 311, 313, 733] },
      ]);
      expect(table.defaults).toHaveLength(9);
      expect(table.defaults[0]?.classFlags).toHaveLength(16);
      expect(
        table.defaults.every((row) =>
          row.flags.every(
            (flag) => flag.value === pubalphaBuild().ids.unlockFlagSet
          )
        )
      ).toBe(true);
    });

    it("reads little-endian package headers, English as language 1", () => {
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
        expect(fields.language, file).toBe(file.includes("_en_") ? 1 : 0);
        expect(fields.patch, file).toBe(0);
        // ps4_<name>_<id in hex>[_en]_<patch>.pkg, but for the unpatchables.
        const id = /_([0-9a-f]{4})(?:_en)?_0\.pkg$/.exec(file)?.[1];
        if (id) {
          expect(fields.packageId, file).toBe(Number.parseInt(id, 16));
        }
      }
    });
  }
);
