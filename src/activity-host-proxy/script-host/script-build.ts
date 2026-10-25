// The server's script build: Fukugen Daihon's folder for the build, compiled to the
// compiled_bs tree on disk at startup and on every edit, the loaded set
// swapped in, and the activities running stale scripts dropped so their
// clients relaunch into the new ones (BAP and Demonware stay up). A build
// with errors never publishes: the previous tree stays, and until a good
// build exists no scripted host starts (compiledScripts throws).
// The release executable has no sources: its compiled_bs trees were built
// with it and are read from its assets (the same reader, another source).

import { type FSWatcher, readdirSync, statSync, watch } from "node:fs";
import { join, resolve } from "node:path";
import {
  CompiledBsError,
  type CompiledScriptSet,
  compileScriptFiles,
  formatDiagnostic,
  loadScriptFolder,
  readCompiledBs,
  readCompiledBsFrom,
  type ScriptFile,
  writeCompiledBs,
} from "@blamnetwork/bullshcript/destiny1/common";
import {
  event_error,
  event_message,
  event_warning,
} from "@blamnetwork/datamine";
import { embedded, readAsset } from "../../assets";
import { activeBuild, buildFolder } from "../../builds";
import { publishScriptSources } from "../../debug/script-debugger";
import { resolveCompiledBsDir, workingDir } from "../../env";
import { liveAhSessions } from "../session";
import {
  scriptFolder,
  setCompiledScripts,
  setCompiledScriptsFailed,
} from "./compiled-scripts";

const COMPILED_BS_DIR = "compiled_bs";
// an editor's save is several events; they settle this long before a build
const DEBOUNCE_MS = 1000;
// fs.watch drops events on Windows now and then; a poll catches what it missed
const POLL_MS = 2000;
const SOURCE_EXTENSION = /\.(bs|es|esp|esu)$/;

// TIGER_COMPILED_BS_DIR, else compiled_bs under the working directory, then
// the build's folder.
export function compiledBsDir(): string {
  return join(
    resolveCompiledBsDir() ?? resolve(workingDir(), COMPILED_BS_DIR),
    buildFolder(activeBuild())
  );
}

interface ScriptBuildOptions {
  // after a rebuild is swapped in; the server drops the running activities
  readonly onRebuilt?: () => void;
  readonly outDir?: string;
  readonly sourceDir?: string;
}

export interface ScriptBuild {
  close(): void;
  // compile now if a source changed since the last build; the set when it
  // was swapped in, nothing when unchanged or failed
  rebuild(): CompiledScriptSet | undefined;
}

// The release executable's tree for the active build (scripts/release.mjs
// embeds them as compiled_bs/<build folder>/...).
function loadEmbeddedScripts(): CompiledScriptSet {
  const prefix = `compiled_bs/${buildFolder(activeBuild())}`;
  const set = readCompiledBsFrom(prefix, (path) =>
    readAsset(`${prefix}/${path}`)
  );
  setCompiledScripts(set);
  event_message(
    "bullshcript:build: script build: %d files from the executable",
    set.files.length
  );
  return set;
}

// One compile of the folder, published and swapped in. A failure marks
// the scripts unhosted, logs every diagnostic and throws.
export function buildScripts(
  sourceDir: string,
  outDir: string
): CompiledScriptSet {
  const started = Date.now();
  let set: CompiledScriptSet;
  let files: readonly ScriptFile[] = [];
  try {
    files = loadScriptFolder(sourceDir).files;
    const compiled = compileScriptFiles(files);
    for (const diagnostic of compiled.diagnostics) {
      event_message(
        "bullshcript:build: script %s",
        formatDiagnostic(diagnostic)
      );
    }
    writeCompiledBs(outDir, compiled);
    set = readCompiledBs(outDir);
  } catch (error) {
    const reason =
      error instanceof CompiledBsError
        ? `${sourceDir} has ${error.message}`
        : `${sourceDir} did not build: ${error instanceof Error ? error.message : String(error)}`;
    setCompiledScriptsFailed(reason);
    event_error(
      "bullshcript:build: script build FAILED: %s. No scripted activity starts until it builds.",
      reason
    );
    throw error;
  }
  setCompiledScripts(set);
  publishScriptSources(files);
  event_message(
    "bullshcript:build: script build: %d files to %s in %d ms",
    set.files.length,
    outDir,
    Date.now() - started
  );
  return set;
}

// Every source's path, size and mtime: what a rebuild compares to know
// whether anything changed, whichever way the change was noticed.
function sourceSignature(dir: string): string {
  const parts: string[] = [];
  const walk = (at: string) => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      const path = join(at, entry.name);
      if (entry.isDirectory()) {
        walk(path);
      } else if (SOURCE_EXTENSION.test(entry.name)) {
        const stat = statSync(path);
        parts.push(`${path}:${stat.size}:${stat.mtimeMs}`);
      }
    }
  };
  walk(dir);
  return parts.sort().join("\n");
}

// Close every socket of an activity whose host is running stale scripts.
// The client takes the AH loss, returns to orbit and relaunches into the
// new build; nothing else about its session is touched.
function restartScriptedActivities(): number {
  let dropped = 0;
  for (const session of liveAhSessions()) {
    const closed = session.closeForScriptReload();
    if (closed) {
      dropped += 1;
      event_message("bullshcript:build: script build: dropped %s", closed);
    }
  }
  return dropped;
}

// The first build, which throws when the sources do not compile (the
// server must not start on bad scripts), then the watcher. The release
// executable's trees never change, so nothing builds or watches there.
export function startScriptBuild(
  options: ScriptBuildOptions = {}
): ScriptBuild {
  if (embedded()) {
    loadEmbeddedScripts();
    return { close: () => undefined, rebuild: () => undefined };
  }
  const sourceDir = options.sourceDir ?? scriptFolder();
  const outDir = options.outDir ?? compiledBsDir();
  const onRebuilt = options.onRebuilt ?? restartScriptedActivities;
  buildScripts(sourceDir, outDir);
  let signature = sourceSignature(sourceDir);
  const rebuild = (): CompiledScriptSet | undefined => {
    const next = sourceSignature(sourceDir);
    if (next === signature) {
      return;
    }
    // a failed build waits for the next edit, not the next poll
    signature = next;
    let set: CompiledScriptSet;
    try {
      set = buildScripts(sourceDir, outDir);
    } catch {
      return;
    }
    onRebuilt();
    return set;
  };
  let timer: NodeJS.Timeout | undefined;
  const rebuildSoon = () => {
    clearTimeout(timer);
    timer = setTimeout(rebuild, DEBOUNCE_MS);
    timer.unref();
  };
  let watcher: FSWatcher | undefined;
  try {
    watcher = watch(sourceDir, { recursive: true }, (_event, file) => {
      if (file && SOURCE_EXTENSION.test(file)) {
        rebuildSoon();
      }
    });
    watcher.unref();
  } catch (error) {
    event_warning(
      "bullshcript:build: script build: not watching %s (%s); polling only",
      sourceDir,
      error instanceof Error ? error.message : String(error)
    );
  }
  const poll = setInterval(() => {
    if (sourceSignature(sourceDir) !== signature) {
      rebuildSoon();
    }
  }, POLL_MS);
  poll.unref();
  event_message("bullshcript:build: script build: watching %s", sourceDir);
  return {
    close: () => {
      clearTimeout(timer);
      clearInterval(poll);
      watcher?.close();
    },
    rebuild,
  };
}
