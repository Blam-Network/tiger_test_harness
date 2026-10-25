// Activity tables, read off the disc packages on first use (an activity's
// scenario_client is found by name, "<activity>:scenario_client",
// activity-table.ts) and kept in memory. Each is also written under
// <temp>/tiger_test_harness/<build folder>/tables (outside src/, so the dev
// server's watcher doesn't restart), keyed so a different reader or package
// set never reuses it.
//
// Launching an activity needs its table: the GAS activity checksum must equal
// the scenario_client's (activity-host-proxy/scenario-client.ts). The table is
// read with the start its script writes (start-config.ts); an activity no
// script starts has no table, so it is not startable.

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { ActivityStartData } from "@blamnetwork/bullshcript/destiny1/common";
import { event_message, event_warning } from "@blamnetwork/datamine";
import { activeBuild, buildFolder } from "../builds";
import { harnessTempDir } from "../env";
import { readActivityTable } from "./activity-table";
import { packageFingerprint } from "./packages";
import { activityStart } from "./start-config";
import type { ActivityBundles } from "./types";
import { contentBuild } from "./versions";

// Bumped whenever the reader's output changes, so older cache files are read
// again.
const TABLE_FORMAT = 9;

// In the temp directory (regenerable), under the build folder so two builds
// never share one.
function cacheDir(): string {
  return path.join(harnessTempDir(), buildFolder(activeBuild()), "tables");
}

const SAFE_NAME = /^\w+$/;

interface CachedTable {
  key: string;
  table: ActivityBundles;
}

// By activity, with the digest of the start it was read with: a script
// rebuild that changes the start reads the table again.
const tables = new Map<
  string,
  { start: string; table: ActivityBundles | null }
>();

function startDigest(start: ActivityStartData | undefined): string {
  return createHash("sha1")
    .update(JSON.stringify(start ?? null))
    .digest("hex")
    .slice(0, 16);
}

// What a cache file must carry to be used: this reader's format, the
// package files it was read from and the script start it was read with.
function cacheKey(start: string): string {
  return `${TABLE_FORMAT}:${packageFingerprint()}:${start}`;
}

function readCached(file: string, key: string): ActivityBundles | undefined {
  try {
    const cached = JSON.parse(readFileSync(file, "utf8")) as CachedTable;
    return cached.key === key ? cached.table : undefined;
  } catch {
    return;
  }
}

function load(
  activityName: string,
  start: ActivityStartData | undefined,
  digest: string
): ActivityBundles | undefined {
  if (!start) {
    if (contentBuild().readers.activityScenario(activityName)) {
      event_warning(
        "content:tables: %s is not startable: no script starts it (@activity)",
        activityName
      );
    }
    return;
  }
  const key = cacheKey(digest);
  const dir = cacheDir();
  const file = path.join(dir, `${activityName}.json`);
  const cached = readCached(file, key);
  if (cached) {
    return cached;
  }
  const table = readActivityTable(activityName, start);
  if (!table) {
    return;
  }
  event_message(
    "content:tables: table for %s read from packages",
    activityName
  );
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, JSON.stringify({ key, table } satisfies CachedTable));
  } catch (error) {
    event_warning(
      "content:tables: could not cache %s: %s",
      file,
      (error as Error).message
    );
  }
  return table;
}

// Script build failures already warned of, so each is said once.
const warnedFailures = new Set<string>();

// The table of an activity, or undefined when the packages don't name a
// scenario_client for it or no script starts it.
export function bundleTable(activityName: string): ActivityBundles | undefined {
  if (!SAFE_NAME.test(activityName)) {
    return;
  }
  let start: ActivityStartData | undefined;
  try {
    start = activityStart(activityName);
  } catch (error) {
    const reason = (error as Error).message;
    if (!warnedFailures.has(reason)) {
      warnedFailures.add(reason);
      event_warning(
        "content:tables: start of %s not read: %s",
        activityName,
        reason
      );
    }
    return;
  }
  const digest = startDigest(start);
  const known = tables.get(activityName);
  if (known?.start === digest) {
    return known.table ?? undefined;
  }
  let table: ActivityBundles | undefined;
  try {
    table = load(activityName, start, digest);
  } catch (error) {
    event_warning(
      "content:tables: table for %s not read: %s",
      activityName,
      (error as Error).message
    );
  }
  tables.set(activityName, { start: digest, table: table ?? null });
  return table;
}
