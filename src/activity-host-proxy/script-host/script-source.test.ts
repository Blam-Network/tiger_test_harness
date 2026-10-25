// The script-set seam: the server's loaded set, its failure, and the
// in-memory default the tests run on.
import {
  compiledScriptSetOf,
  compileScriptFiles,
  fnv1,
  formatScriptTag,
  loadScriptFolder,
} from "@blamnetwork/bullshcript/destiny1/common";
import { afterEach, describe, expect, it } from "vitest";
import {
  compiledScripts,
  resetCompiledScriptsForTest,
  ScriptBuildError,
  scriptFolder,
  setCompiledScripts,
  setCompiledScriptsFailed,
} from "./compiled-scripts";
import { scriptSource } from "./script-source";

const TOWER_BUNDLE = fnv1("enc_plaza_amb1");
const TOWER_TAG = 0x80_80_00_01;

describe("the compiled script set", () => {
  afterEach(() => resetCompiledScriptsForTest());

  it("defaults to the build's folder compiled in memory, once", () => {
    const set = compiledScripts();
    expect(set.files.length).toBeGreaterThan(0);
    expect(compiledScripts()).toBe(set);
    expect(set.index.diagnostics).toEqual([]);
  });

  it("serves whatever set the server swapped in", () => {
    const folder = loadScriptFolder(scriptFolder());
    const smaller = compiledScriptSetOf(
      compileScriptFiles(
        folder.files.filter((file) => file.path.startsWith("es/city_tower/"))
      )
    );
    setCompiledScripts(smaller);
    expect(compiledScripts()).toBe(smaller);
    const { scriptFor, scripts } = scriptSource(
      [{ bundle: TOWER_BUNDLE, tag: TOWER_TAG }],
      "city_tower"
    );
    expect(scriptFor(TOWER_TAG)).toBe(TOWER_TAG);
    expect(scripts.tags()).toEqual([formatScriptTag(TOWER_TAG)]);
    expect(scripts.read(formatScriptTag(TOWER_TAG))).toEqual(
      smaller.chunkFor("es/city_tower/enc_plaza_amb1.es")
    );
    expect(scripts.schema?.(formatScriptTag(TOWER_TAG))).toEqual(
      smaller.schemaFor("es/city_tower/enc_plaza_amb1.es")
    );
  });

  it("refuses to source scripts after a failed build, until the next good one", () => {
    setCompiledScriptsFailed("es/x.es has 1 error");
    expect(() => compiledScripts()).toThrow(ScriptBuildError);
    expect(() =>
      scriptSource([{ bundle: TOWER_BUNDLE, tag: TOWER_TAG }], "city_tower")
    ).toThrow("scripts not hosted: es/x.es has 1 error");
    setCompiledScripts(compiledScriptSetOf(compileScriptFiles([])));
    expect(compiledScripts().files).toEqual([]);
  });
});
