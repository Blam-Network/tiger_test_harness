// Restarts `nest start --watch` when the tiger packages (vendor/tiger)
// rebuild: once their dist-cjs output settles, rewrite a gitignored file under
// src/, which nest's watcher treats like any other source change. Fukugen
// Daihon's scripts are not watched here: the server recompiles them itself
// (src/activity-host-proxy/script-host/script-build.ts) without a restart.
import { readdirSync, statSync, watch, writeFileSync } from "node:fs";
import { join } from "node:path";

const packages = ["poodle", "rsat", "gibbon", "bullshcript", "datamine"];
const stamp = join("src", "tiger-stamp.ts");
const QUIET_MS = 1500;

const write = () =>
  writeFileSync(
    stamp,
    `// Written by scripts/tiger-stamp.mjs; gitignored.\nexport const TIGER_BUILD = "${new Date().toISOString()}";\n`
  );

const mtimeOf = (path) => {
  try {
    return statSync(path).mtimeMs;
  } catch {
    return;
  }
};

write();

// Windows reports a plain read of a watched file (another package's build or
// test importing it) as a change too, so only a new mtime counts as a rebuild.
const seen = new Map();
const rebuilt = new Set();
let timer;
const restartSoon = (name) => {
  rebuilt.add(name);
  clearTimeout(timer);
  timer = setTimeout(() => {
    write();
    console.log(
      `tiger ${[...rebuilt].join(", ")} rebuilt, restarting the server`
    );
    rebuilt.clear();
  }, QUIET_MS);
};

for (const name of packages) {
  const dir = join("vendor", "tiger", "packages", name, "dist-cjs");
  try {
    for (const file of readdirSync(dir, { recursive: true })) {
      if (file.endsWith(".js")) {
        seen.set(join(dir, file), mtimeOf(join(dir, file)));
      }
    }
    watch(dir, { recursive: true }, (_, file) => {
      if (!file?.endsWith(".js")) {
        return;
      }
      const path = join(dir, file);
      const mtime = mtimeOf(path);
      if (mtime === seen.get(path)) {
        return;
      }
      seen.set(path, mtime);
      restartSoon(name);
    });
  } catch {
    console.log(`not watching ${dir}: it isn't built yet`);
  }
}
