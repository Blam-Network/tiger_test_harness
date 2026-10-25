import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  describeDebugToggles,
  parseDebugToggles,
  readDebugToggles,
  setDebugTogglesForTest,
} from "./debug-toggles";

describe("debug toggles file", () => {
  afterEach(() => {
    setDebugTogglesForTest(undefined);
  });

  it("is no toggles when the file is missing", () => {
    const read = readDebugToggles(join(tmpdir(), "no-such-debug-toggles.json"));
    expect(read).toEqual({ problems: [], source: "none", toggles: {} });
    expect(describeDebugToggles(read)).toBe("none (no debug-toggles.json)");
  });

  it("reads the toggles it knows and names what it does not", () => {
    const dir = mkdtempSync(join(tmpdir(), "web-tiger-toggles-"));
    const path = join(dir, "debug-toggles.json");
    writeFileSync(
      path,
      JSON.stringify({
        actorPlaceBody: "retail",
        allowGrantedEquip: true,
        grantLevelQuality: "zero",
        omitScriptRowTypes: [1, 2],
        startPhase: { act_cosmo_m0_highway: 2 },
        stripNavPoints: "yes",
        unknownThing: 1,
      })
    );
    const read = readDebugToggles(path);
    expect(read.toggles).toEqual({
      actorPlaceBody: "retail",
      allowGrantedEquip: true,
      grantLevelQuality: "zero",
      omitScriptRowTypes: [1, 2],
      startPhase: { act_cosmo_m0_highway: 2 },
    });
    expect(read.problems).toEqual([
      "stripNavPoints: expected true or false",
      "unknownThing: unknown toggle",
    ]);
    expect(parseDebugToggles({ grantLevelQuality: "max" }).problems).toEqual([
      'grantLevelQuality: expected "def" or "zero"',
    ]);
    expect(describeDebugToggles(read)).toContain("problems:");
    // The same mtime reads from the cache.
    expect(readDebugToggles(path)).toBe(read);
  });

  it("leaves the rowless sense rows off unless senseRows says so", () => {
    expect(parseDebugToggles({}).toggles.senseRows).toBeUndefined();
    expect(parseDebugToggles({ senseRows: true }).toggles.senseRows).toBe(true);
    expect(parseDebugToggles({ senseRows: 1 }).problems).toEqual([
      "senseRows: expected true or false",
    ]);
  });
});
