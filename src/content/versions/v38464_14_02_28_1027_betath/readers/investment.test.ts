import { closeSync, openSync, readdirSync, readSync } from "node:fs";
import { join } from "node:path";
import { fnv1 } from "@blamnetwork/bullshcript/destiny1/common";
import { describe, expect, it } from "vitest";
import { e_build } from "../../../../builds";
import { buildPackagesDir, hasPackages } from "../../../../test-support/build";
import { contentBuildForTest } from "../../../../test-support/content-build";

const BUILD = e_build.v38464_14_02_28_1027_betath;
const betathBuild = () => contentBuildForTest(BUILD);

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
describe.skipIf(!hasPackages(BUILD))("PS4 pre-alpha investment tables", () => {
  const readers = () => betathBuild().readers;

  it("lists the 244 activities and their playlists", () => {
    const activities = readers().activityDefinitions();
    expect(activities).toHaveLength(244);
    expect(activities[0]?.name).toBe("city_tower_default1");
    expect(activities[4]?.name).toBe("cosmo_patrols_1");
    expect(activities[183]?.name).toBe("cosmo_portal_1");
    expect(activities[3]?.name).toBe("");
    expect(activities[180]?.playlist).toEqual([184, 188, 192, 196, 200, 204]);
    expect(activities[243]?.playlist).toEqual([241, 242]);
  });

  it("reads 2286 item definitions, 1786 of them equipable", () => {
    const items = readers().itemDefinitions();
    expect(items).toHaveLength(2286);
    expect(items.filter((item) => item.equipSlot !== null)).toHaveLength(1786);
    // Sargon X1S: its level and stats are counted arrays.
    expect(items[1605]).toMatchObject({
      bucket: 3,
      equipSlot: 6,
      tier: 1,
      instanced: true,
      level: 0,
      stats: [
        [12, 0],
        [13, 0],
        [14, 0],
        [24, 0],
        [19, 0],
        [18, 0],
      ],
    });
    // An item whose level block names a level.
    expect(items[739]).toMatchObject({ level: 10, quality: -9 });
  });

  it("names items from UTF-16 string banks", () => {
    const { itemName } = readers();
    expect(itemName(1605)).toBe("Sargon X1S");
    expect(itemName(2030)).toBe("Phaeton Class-A");
    expect(itemName(635)).toBe("Fist of Mjolnir");
    // No display name.
    expect(itemName(739)).toBe("");
    expect(itemName(99_999)).toBe("");
  });

  it("lists 26 vendors and their 1883 purchases", () => {
    const vendors = readers().vendors();
    expect(vendors).toHaveLength(26);
    expect(vendors.reduce((n, v) => n + v.purchases.length, 0)).toBe(1883);
    expect(vendors[0]?.currencyDef).toBe(695);
    // A sale's level override is its counted key 0.
    expect(vendors[0]?.purchases[1]).toMatchObject({
      itemDef: 729,
      level: 5,
    });
  });

  it("reads 510 talent grids and the subclasses' ability grants", () => {
    const { talentGrid, talentGridBuildSource } = readers();
    expect(talentGrid(509)).toBeDefined();
    expect(talentGrid(510)).toBeUndefined();
    const slots = new Set<number>();
    for (let i = 0; i < 510; i++) {
      for (const grant of talentGridBuildSource(i).grants) {
        slots.add(grant.slot);
      }
    }
    // Grenade, super, melee, jump, movement.
    expect([...slots].sort()).toEqual([0, 1, 2, 3, 4]);
    // Fist of Mjolnir's grid: the melee and movement come with it, the
    // grenade is one of three at level 2.
    const grants = talentGridBuildSource(61).grants;
    expect(grants.filter((grant) => grant.auto)).toEqual([
      { node: 14, level: 0, auto: true, ability: 5, slot: 2 },
      { node: 17, level: 0, auto: true, ability: 12, slot: 4 },
    ]);
    expect(
      grants.filter((grant) => grant.slot === 0).map((grant) => grant.ability)
    ).toEqual([31, 25, 28]);
  });

  it("caps the level at the level progression's 101 steps", () => {
    const { progression, characterConstants, levelProgressionRole } = readers();
    const constants = characterConstants();
    // Role 0 names none.
    expect(constants.progressions).toEqual([11, 14, 37, 38, 0]);
    expect(constants.progressions[levelProgressionRole()]).toBe(11);
    const level = progression(11);
    expect(level?.clampAtMax).toBe(false);
    expect(level?.steps.slice(0, 4).map((s) => s.xpRequired)).toEqual([
      0, 5000, 6500, 8000,
    ]);
    expect(constants.levelCap).toBe(101);
    expect(constants.stats[0]).toBe(0);
  });

  it("reads the abilities, server messages and incidents", () => {
    const { abilities, serverMessages, incidentNames } = readers();
    expect(abilities()).toHaveLength(34);
    const messages = serverMessages();
    expect(messages).toHaveLength(64);
    expect(messages.find((m) => m.networkId === 101)?.nameHash).toBe(
      fnv1("director_get_activity_list")
    );
    const names = incidentNames();
    expect(names).toHaveLength(661);
    for (const name of ["player_spawned", "kill", "player_died"]) {
      expect(names, name).toContain(fnv1(name));
    }
  });

  it("reads the curves' counted rows", () => {
    const curves = readers().statCurves();
    expect(curves).toHaveLength(43);
    expect(curves[0]?.points).toEqual([
      { x: 0, y: 50 },
      { x: 20, y: 1050 },
      { x: 200, y: 10_050 },
    ]);
    expect(curves[0]?.qualityPoints).toEqual([
      { x: -100, y: -10 },
      { x: 250, y: 25 },
    ]);
    // A stat with no curve struct.
    expect(curves[1]?.points).toEqual([]);
  });

  it("reads the unlock tables and destinations", () => {
    const { unlockTables, recordFlags, clientDestinations } = readers();
    const tables = unlockTables();
    expect(tables.flagOfSlot.account).toHaveLength(767);
    expect(tables.flagOfSlot.offer).toHaveLength(15);
    expect(tables.flagOfSlot.character).toHaveLength(263);
    expect(tables.sources).toHaveLength(1551);
    expect(tables.sources.every((source) => source !== undefined)).toBe(true);
    expect(tables.times).toHaveLength(18);
    expect(recordFlags()).toHaveLength(252);
    // The rows have no progression blocks.
    const destinations = clientDestinations();
    expect(destinations).toHaveLength(18);
    expect(destinations.every((row) => row.progressions.length === 0)).toBe(
      true
    );
  });

  it("hands each class its armour and a primary", () => {
    const table = readers().newCharacterTable();
    expect(table.startingGear).toEqual([
      { class: 0, items: [7, 9, 11, 13, 15, 1605] },
      { class: 1, items: [190, 192, 194, 196, 198, 1605] },
      { class: 2, items: [373, 375, 377, 379, 381, 1605] },
    ]);
    expect(table.defaults).toHaveLength(9);
    expect(table.defaults[0]?.classFlags).toHaveLength(16);
    expect(
      table.defaults.every((row) =>
        row.flags.every(
          (flag) => flag.value === betathBuild().ids.unlockFlagSet
        )
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
});
