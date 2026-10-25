// The server's script build: one build of a copy of the build's script folder
// publishes and swaps in, an edit rebuilds and drops the activities, a
// syntax error fails loudly and keeps the published tree.
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { events_dispose } from "@blamnetwork/datamine";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { activeBuild, buildFolder } from "../../builds";
import { captureEvents } from "../../test-support/capture-events";
import {
  compiledScripts,
  resetCompiledScriptsForTest,
  ScriptBuildError,
  scriptFolder,
} from "./compiled-scripts";
import {
  buildScripts,
  compiledBsDir,
  type ScriptBuild,
  startScriptBuild,
} from "./script-build";

const TOWER = "es/city_tower/enc_plaza_amb1.es";
// A script that compiles alone, so the watch and swap cases build a folder of
// one rather than the whole build's (about a second each).
const SMALL = "es/pvp_anomaly/pvp_anomaly.es";

// the real folder compiles and writes in a couple of seconds next to the
// rest of the suite
describe("the script build", () => {
  const root = mkdtempSync(join(tmpdir(), "script-build-"));
  const fullDir = join(root, "scripts");
  const sourceDir = join(root, "small");
  const outDir = join(root, "compiled_bs");
  mkdirSync(join(sourceDir, "es", "pvp_anomaly"), { recursive: true });
  cpSync(join(scriptFolder(), SMALL), join(sourceDir, SMALL));
  const tower = join(sourceDir, SMALL);
  const original = readFileSync(tower, "utf8");
  let build: ScriptBuild | undefined;
  afterEach(() => {
    events_dispose();
    build?.close();
    build = undefined;
    writeFileSync(tower, original);
    resetCompiledScriptsForTest();
  });

  it("resolves the output dir from the env, else the working directory, under the build folder", () => {
    const before = process.env.TIGER_COMPILED_BS_DIR;
    try {
      delete process.env.TIGER_COMPILED_BS_DIR;
      expect(compiledBsDir()).toBe(
        join(process.cwd(), "compiled_bs", buildFolder(activeBuild()))
      );
      process.env.TIGER_COMPILED_BS_DIR = outDir;
      expect(compiledBsDir()).toBe(join(outDir, buildFolder(activeBuild())));
    } finally {
      if (before === undefined) {
        delete process.env.TIGER_COMPILED_BS_DIR;
      } else {
        process.env.TIGER_COMPILED_BS_DIR = before;
      }
    }
  });

  // the one build of the real folder
  it("publishes the tree and swaps the set in", () => {
    cpSync(scriptFolder(), fullDir, { recursive: true });
    const { texts } = captureEvents();
    const set = buildScripts(fullDir, outDir);
    expect(existsSync(join(outDir, "index.json"))).toBe(true);
    expect(compiledScripts()).toBe(set);
    expect(set.scriptByPath(TOWER)?.kind).toBe("es");
    rmSync(fullDir, { force: true, recursive: true });
    expect(texts()).toEqual([
      expect.stringMatching(
        /^bullshcript:build: script build: \d+ files to .* in \d+ ms$/
      ),
    ]);
  });

  it("rebuilds on an edit and drops the running activities", () => {
    const { texts } = captureEvents();
    let dropped = 0;
    build = startScriptBuild({
      onRebuilt: () => {
        dropped += 1;
      },
      outDir,
      sourceDir,
    });
    const first = compiledScripts();
    expect(build.rebuild()).toBeUndefined();
    expect(dropped).toBe(0);
    writeFileSync(tower, `${original}\n# edited\n`);
    const second = build.rebuild();
    expect(second).toBeDefined();
    expect(second).not.toBe(first);
    expect(compiledScripts()).toBe(second);
    expect(dropped).toBe(1);
    expect(second?.index.stamp).not.toBe(first.index.stamp);
    expect(texts().filter((line) => line.includes("watching"))).toHaveLength(1);
  });

  it("fails loudly on a syntax error and keeps the published tree", () => {
    const { texts } = captureEvents();
    build = startScriptBuild({
      onRebuilt: () => undefined,
      outDir,
      sourceDir,
    });
    const good = compiledScripts();
    const published = readFileSync(join(outDir, "index.json"), "utf8");
    writeFileSync(tower, `${original}\ndef broken(:\n`);
    expect(build.rebuild()).toBeUndefined();
    expect(() => compiledScripts()).toThrow(ScriptBuildError);
    expect(readFileSync(join(outDir, "index.json"), "utf8")).toBe(published);
    expect(readdirSync(root)).toEqual(["compiled_bs", "small"]);
    expect(texts()).toContainEqual(
      expect.stringMatching(
        /^bullshcript:build: script error: es\/pvp_anomaly\/pvp_anomaly\.es:\d+: /
      )
    );
    expect(texts()).toContainEqual(
      expect.stringMatching(
        /^bullshcript:build: script build FAILED: .* has 1 error: .* No scripted activity starts until it builds\.$/
      )
    );
    // the same broken sources are not rebuilt until they change again
    expect(build.rebuild()).toBeUndefined();
    writeFileSync(tower, original);
    const back = build.rebuild();
    expect(back).toBeDefined();
    expect(compiledScripts()).toBe(back);
    expect(back?.index.files).toEqual(good.index.files);
  });

  it("refuses to start on sources that do not compile", () => {
    writeFileSync(tower, "def broken(:\n");
    expect(() => startScriptBuild({ outDir, sourceDir })).toThrow();
    expect(() => compiledScripts()).toThrow(ScriptBuildError);
  });

  afterAll(() => rmSync(root, { force: true, recursive: true }));
});
