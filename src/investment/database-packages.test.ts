import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, expect, it } from "vitest";
import { e_build } from "../builds";
import { describeEachPackages } from "../test-support/build";
import type { CharacterStore } from "./character-store";
import { STUB_APPEARANCE } from "./stubs/stub-account";

interface Stores {
  PrismaCharacterStore: {
    connect(url: string): CharacterStore & { disconnect(): Promise<void> };
  };
}

// Imported after describeBuild has reset the modules, so each is the build's own.
const storeOf: Record<e_build, () => Promise<Stores>> = {
  [e_build.v36735_13_12_02_1953_alpha]: () =>
    import("./versions/v36735_13_12_02_1953_alpha/prisma-store"),
  [e_build.v38464_14_02_28_1027_betath]: () =>
    import("./versions/v38464_14_02_28_1027_betath/prisma-store"),
  [e_build.v39573_14_04_03_1336_ff]: () =>
    import("./versions/v39573_14_04_03_1336_ff/prisma-store"),
  [e_build.v40662_14_05_19_1414_pubalpha]: () =>
    import("./versions/v40662_14_05_19_1414_pubalpha/prisma-store"),
  [e_build.v41375_14_07_03_1501_live]: () =>
    import("./versions/v41375_14_07_03_1501_live/prisma-store"),
};

const dataDir = mkdtempSync(join(tmpdir(), "tiger-db-packages-"));

afterAll(() => {
  rmSync(dataDir, { recursive: true, force: true });
});

// A new character in a build's database gets the starter kit its packages
// name (database.test.ts covers the store and migration plumbing on a
// hand-made kit).
describeEachPackages("starter kit in the build database", (build) => {
  it("is stored with the character and read back", async () => {
    const { prepareBuildDatabase } = await import("./database");
    const { PrismaCharacterStore } = await storeOf[build]();
    const store = PrismaCharacterStore.connect(
      prepareBuildDatabase(dataDir, build)
    );
    try {
      const account = await store.accountForPlatformId(1n, "guardian");
      const created = await store.createCharacter(
        account.soid,
        "warlock",
        STUB_APPEARANCE
      );
      const reread = await store.character(created.soid);
      expect(created.loadout.items.length).toBeGreaterThan(0);
      expect(reread?.loadout.items.map((i) => i.defIndex)).toEqual(
        created.loadout.items.map((i) => i.defIndex)
      );
    } finally {
      await store.disconnect();
    }
  }, 120_000);
});
