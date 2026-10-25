import {
  existsSync,
  mkdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { embeddedManifest, readAsset } from "./assets";
import { harnessTempDir } from "./env";

const ENGINE_KEY = "engine/query_engine.node";

// A native library can't load from inside the executable, so the embedded
// Prisma engine is written out once to <temp>/tiger_test_harness/engine/<sha256>/
// and loaded from there. Returns the path for PRISMA_QUERY_ENGINE_LIBRARY.
export function extractEngine(): string {
  const bytes = readAsset(ENGINE_KEY);
  const dir = join(harnessTempDir(), "engine", embeddedManifest().engineHash);
  const file = join(dir, "query_engine.node");
  if (existsSync(file) && statSync(file).size === bytes.length) {
    return file;
  }
  mkdirSync(dir, { recursive: true });
  // Written under another name first so a killed start never leaves half a library.
  const partial = `${file}.${process.pid}`;
  writeFileSync(partial, bytes);
  renameSync(partial, file);
  return file;
}
