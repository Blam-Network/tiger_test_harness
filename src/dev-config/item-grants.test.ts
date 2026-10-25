import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { itemGrantsFile, parseItemGrants, readItemGrants } from "./item-grants";

const SOID = 0x200000001n;
const GJALLARHORN = 2075;
const THORN = 2069;

describe("item grants file", () => {
  it("parses what it knows and names what it does not", () => {
    const read = parseItemGrants({
      defaults: { level: 20, quality: "high" },
      grants: [
        { defIndex: GJALLARHORN, label: "Gjallarhorn" },
        { nope: 1 },
        { defIndex: THORN, equip: true, characters: ["0x200000001", "x"] },
        "Thorn",
      ],
    });
    expect(read.source).toBe("file");
    expect(read.grants.defaults).toEqual({ level: 20, quality: undefined });
    expect(read.grants.grants).toEqual([
      {
        characters: undefined,
        defIndex: GJALLARHORN,
        equip: false,
        label: "Gjallarhorn",
        level: undefined,
        quality: undefined,
      },
      {
        characters: [SOID],
        defIndex: THORN,
        equip: true,
        label: undefined,
        level: undefined,
        quality: undefined,
      },
    ]);
    expect(read.problems).toEqual([
      "defaults.quality: not an integer",
      "grants[1]: no defIndex",
      "grants[2].characters: x is not a soid",
      "grants[3]: not an object",
    ]);
  });

  it("names the file after the build folder", () => {
    expect(itemGrantsFile()).toBe("item-grants.v41375_14_07_03_1501_live.json");
  });

  it("is no grants when the file is missing", () => {
    const read = readItemGrants(() =>
      readFileSync(join(tmpdir(), "no-such-item-grants.json"))
    );
    expect(read).toEqual({
      grants: { defaults: {}, grants: [] },
      problems: [],
      source: "none",
    });
  });

  it("reads the file on every call", () => {
    const path = join(
      mkdtempSync(join(tmpdir(), "web-tiger-grants-")),
      itemGrantsFile()
    );
    writeFileSync(path, JSON.stringify({ grants: [{ defIndex: THORN }] }));
    expect(
      readItemGrants(() => readFileSync(path)).grants.grants.map(
        (g) => g.defIndex
      )
    ).toEqual([THORN]);
    writeFileSync(path, "{ not json");
    const broken = readItemGrants(() => readFileSync(path));
    expect(broken.grants.grants).toEqual([]);
    expect(broken.problems).toHaveLength(1);
  });
});
