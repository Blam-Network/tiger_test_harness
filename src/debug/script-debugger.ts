import { ScriptDebugger } from "@blamnetwork/bullshcript/destiny1/debug";

// The process's one script debugger: every live activity's script host is
// attached to it, and the debug server's /debug/dap clients talk to it.

// The sources of the build the activities run, by Fukugen Daihon path: what
// the debugger shows, even after the files on disk move on.
const sources = new Map<string, string>();

export function publishScriptSources(
  files: readonly { path: string; text: string }[]
): void {
  sources.clear();
  for (const file of files) {
    sources.set(file.path.replaceAll("\\", "/"), file.text);
  }
}

export const scriptDebugger = new ScriptDebugger({
  sourcePaths: () => [...sources.keys()],
  sourceText: (path) => sources.get(path),
});
