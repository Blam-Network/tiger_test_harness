// The disc packages on disk.
import { createHash } from "node:crypto";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { requirePackagesDir } from "../env";

let fingerprint: string | undefined;

// Identifies the package files a cached table was read from: their names,
// sizes and modification times.
export function packageFingerprint(): string {
  if (fingerprint === undefined) {
    const hash = createHash("sha1");
    const packagesDir = requirePackagesDir();
    for (const name of readdirSync(packagesDir).sort()) {
      if (name.toLowerCase().endsWith(".pkg")) {
        const { mtimeMs, size } = statSync(path.join(packagesDir, name));
        hash.update(`${name}:${size}:${mtimeMs}\n`);
      }
    }
    fingerprint = hash.digest("hex").slice(0, 16);
  }
  return fingerprint;
}
