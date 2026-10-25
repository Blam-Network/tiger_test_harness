import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it, vi } from "vitest";
import { activeBuild, buildFolder } from "../builds";
import { describeWithPackages } from "../test-support/build";

// A fresh tables module reading and writing its own cache directory.
async function freshTables() {
  const root = mkdtempSync(path.join(tmpdir(), "tables-"));
  // os.tmpdir() reads these on each call
  for (const name of ["TMPDIR", "TMP", "TEMP"]) {
    vi.stubEnv(name, root);
  }
  vi.resetModules();
  const dir = path.join(
    root,
    "tiger_test_harness",
    buildFolder(activeBuild()),
    "tables"
  );
  mkdirSync(dir, { recursive: true });
  return { dir, ...(await import("./tables")) };
}

describeWithPackages("table cache", { timeout: 30_000 }, () => {
  it("writes a table under a key and reuses it", async () => {
    const { bundleTable, dir } = await freshTables();
    const table = bundleTable("cine_reveal");
    const file = path.join(dir, "cine_reveal.json");
    const written = JSON.parse(readFileSync(file, "utf8"));
    expect(written.key).toMatch(/^\d+:[0-9a-f]+:[0-9a-f]+$/);
    expect(written.table).toEqual(JSON.parse(JSON.stringify(table)));
  });

  it("reads a table back from a file with the current key", async () => {
    const first = await freshTables();
    first.bundleTable("cine_reveal");
    const file = path.join(first.dir, "cine_reveal.json");
    const written = JSON.parse(readFileSync(file, "utf8"));
    writeFileSync(file, JSON.stringify({ ...written, table: { sentinel: 1 } }));
    vi.resetModules();
    const again = await import("./tables");
    expect(again.bundleTable("cine_reveal")).toEqual({ sentinel: 1 });
  });

  it("ignores and overwrites a cache file of another key", async () => {
    const { bundleTable, dir } = await freshTables();
    const file = path.join(dir, "cine_reveal.json");
    writeFileSync(file, JSON.stringify({ key: "0:stale", table: {} }));
    expect(bundleTable("cine_reveal")?.activityName).toBe("cine_reveal");
    expect(JSON.parse(readFileSync(file, "utf8")).key).not.toBe("0:stale");
  });

  it("ignores a cache file from before keys", async () => {
    const { bundleTable, dir } = await freshTables();
    const file = path.join(dir, "cine_reveal.json");
    writeFileSync(file, JSON.stringify({ activityName: "cine_reveal" }));
    expect(bundleTable("cine_reveal")?.tags.length).toBeGreaterThan(0);
    expect(JSON.parse(readFileSync(file, "utf8")).key).toBeDefined();
  });

  it("rereads a table when the script start it was read with changes", async () => {
    const first = await freshTables();
    first.bundleTable("cine_reveal");
    const file = path.join(first.dir, "cine_reveal.json");
    const before = JSON.parse(readFileSync(file, "utf8")).key;
    vi.resetModules();
    vi.doMock("./start-config", async (original) => {
      const real = await original<typeof import("./start-config")>();
      return {
        ...real,
        activityStart: (name: string) => ({
          ...real.activityStart(name),
          spawnTransition: 7,
        }),
      };
    });
    try {
      const again = await import("./tables");
      again.bundleTable("cine_reveal");
    } finally {
      vi.doUnmock("./start-config");
    }
    expect(JSON.parse(readFileSync(file, "utf8")).key).not.toBe(before);
  });
});
