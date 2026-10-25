import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import { e_build } from "../builds";
import { prepareBuildDatabase } from "./database";
import type { LoadoutSeed } from "./loadout";
import { STUB_APPEARANCE } from "./stubs/stub-account";
import { PrismaCharacterStore as alpha } from "./versions/v36735_13_12_02_1953_alpha/prisma-store";
import { PrismaCharacterStore as betath } from "./versions/v38464_14_02_28_1027_betath/prisma-store";
import { PrismaCharacterStore as ff } from "./versions/v39573_14_04_03_1336_ff/prisma-store";
import { PrismaCharacterStore as pubalpha } from "./versions/v40662_14_05_19_1414_pubalpha/prisma-store";
import { PrismaCharacterStore as live } from "./versions/v41375_14_07_03_1501_live/prisma-store";

// The starter kit is item defs read from the packages; the plumbing under test
// is the stores' and the migrations', so a hand-made kit stands in: a weapon in
// the first equip slot, a bag armor piece and a currency stack.
vi.mock("./loadout", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./loadout")>()),
  starterItems: (): LoadoutSeed[] => [
    {
      artArrangement: 0,
      bucket: 1,
      defIndex: 100,
      equipSlot: 0,
      instanced: true,
      power: 0,
      quantity: 1,
      sandboxPattern: 0,
    },
    {
      artArrangement: 0,
      bucket: 2,
      defIndex: 101,
      equipSlot: null,
      instanced: true,
      power: 0,
      quantity: 1,
      sandboxPattern: 0,
    },
    {
      artArrangement: 0,
      bucket: 0,
      defIndex: 102,
      equipSlot: null,
      instanced: false,
      power: 0,
      quantity: 10,
      sandboxPattern: 0,
    },
  ],
}));

// The level curve is the packages' progression table too: a flat one.
vi.mock("./character-level", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./character-level")>()),
  levelForXp: () => 1,
  xpForLevel: () => 0,
}));

// Nothing to repair in a kit that is already whole.
vi.mock("./loadout-repair", () => ({
  planLoadoutRepair: () => ({ creates: [], updates: [] }),
}));

// and no grants to apply.
vi.mock("./item-grants", () => ({
  planItemGrants: () => ({ creates: [], skipped: [], updates: [] }),
}));

// Item defs are the packages' too: none, so a stat block is empty.
vi.mock("../content/items", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../content/items")>()),
  itemDef: () => undefined,
}));

const stores = {
  [e_build.v36735_13_12_02_1953_alpha]: alpha,
  [e_build.v38464_14_02_28_1027_betath]: betath,
  [e_build.v39573_14_04_03_1336_ff]: ff,
  [e_build.v40662_14_05_19_1414_pubalpha]: pubalpha,
  [e_build.v41375_14_07_03_1501_live]: live,
};

const dataDir = mkdtempSync(join(tmpdir(), "tiger-db-"));

// An online XUID, above 2^63.
const XUID = 0xe000_1234_5678_9abcn;

afterAll(() => {
  rmSync(dataDir, { recursive: true, force: true });
});

describe("build database", () => {
  for (const [build, Store] of Object.entries(stores)) {
    it(`${build}: a fresh data dir gets a migrated file that holds accounts, characters and items`, async () => {
      const url = prepareBuildDatabase(dataDir, build as e_build);
      expect(
        existsSync(
          join(dataDir, `tiger_test_harness-${build.split(".")[0]}.db`)
        )
      ).toBe(true);
      // Migrating again is a no-op.
      expect(prepareBuildDatabase(dataDir, build as e_build)).toBe(url);

      const store = Store.connect(url);
      try {
        const account = await store.accountForPlatformId(XUID, "guardian");
        expect((await store.accountForPlatformId(XUID, "again")).soid).toBe(
          account.soid
        );
        expect((await store.account(account.soid))?.platformId).toBe(XUID);

        const created = await store.createCharacter(
          account.soid,
          "warlock",
          STUB_APPEARANCE
        );
        expect(
          (await store.listCharacters(account.soid)).map((c) => c.soid)
        ).toEqual([created.soid]);
        expect((await store.character(created.soid))?.name).toBe("warlock");

        const item = await store.addItem(created.soid, {
          ...created.loadout.items[0],
          instanced: false,
          quantity: 5,
        });
        await store.setItemQuantity(item.soid, 9);
        const reread = await store.character(created.soid);
        expect(
          reread?.loadout.items.find((i) => i.soid === item.soid)?.quantity
        ).toBe(9);
        await store.removeItem(item.soid);

        expect(await store.deleteCharacter(created.soid)).toBe(true);
        expect(await store.listCharacters(account.soid)).toHaveLength(0);
      } finally {
        await store.disconnect();
      }
    }, 120_000);
  }
});
