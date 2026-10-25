// This build ships no script tags at all: its scripts are the build's folder
// in Fukugen Daihon (BungieScript), which bullshcript compiles to the chunk and the
// schema the host reads. The server hands the loaded set in here
// (script-build.ts: compiled from the folder in a checkout, prebuilt in the
// release executable); tests, which never do, get the folder compiled in
// memory on first use.
import {
  type CompiledScriptSet,
  compiledScriptSetOf,
  compileScriptFiles,
  fukugenDaihonDir,
  loadScriptFolder,
} from "@blamnetwork/bullshcript/destiny1/common";

import { activeBuild, buildFolder } from "../../builds";
import { contentBuild } from "../../content/versions";

// The active build's folder in Fukugen Daihon: FUKUGEN_DAIHON_DIR, else the
// one beside bullshcript's own package in the tiger checkout. The release
// executable has no sources, only the compiled trees.
export function scriptFolder(): string {
  return fukugenDaihonDir(
    contentBuild().bullshcript.entryModule,
    buildFolder(activeBuild())
  );
}

// The scripts no host can start without: the server's last build failed.
export class ScriptBuildError extends Error {
  constructor(reason: string) {
    super(`scripts not hosted: ${reason}`);
    this.name = "ScriptBuildError";
  }
}

// Where the hosts' scripts come from. The server sets a loaded set on every
// good build, or the failure that stops scripted hosts starting until the
// next one; nothing set means an in-memory compile of the folder.
type ScriptSetState =
  | { kind: "default"; set?: CompiledScriptSet }
  | { kind: "failed"; reason: string }
  | { kind: "ready"; set: CompiledScriptSet };

let state: ScriptSetState = { kind: "default" };

export function setCompiledScripts(set: CompiledScriptSet): void {
  state = { kind: "ready", set };
}

export function setCompiledScriptsFailed(reason: string): void {
  state = { kind: "failed", reason };
}

// Test seam: back to the in-memory compile.
export function resetCompiledScriptsForTest(): void {
  state = { kind: "default" };
}

export function compiledScripts(): CompiledScriptSet {
  switch (state.kind) {
    case "ready":
      return state.set;
    case "failed":
      throw new ScriptBuildError(state.reason);
    default:
      state.set ??= compiledScriptSetOf(
        compileScriptFiles(loadScriptFolder(scriptFolder()).files)
      );
      return state.set;
  }
}
