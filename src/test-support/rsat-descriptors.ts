import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "vitest";
import { buildFolder, type e_build } from "../builds";
import { type RsatCatalog, readRsatCatalog } from "./rsat-catalog";

// A build's RSAT descriptor dump is gitignored (~48 MB): scripts/rsat-descriptors.py
// regenerates it from the client, and the tests that hold schemas to it skip
// where it is missing.

export function rsatDescriptorsPath(build: e_build): string {
  return resolve(
    __dirname,
    "../../docs",
    buildFolder(build),
    "rsat-descriptors.json"
  );
}

const noticed = new Set<e_build>();

// Whether the build's descriptor dump exists. A missing one is said so once
// per file.
export function hasRsatDescriptors(build: e_build): boolean {
  const found = existsSync(rsatDescriptorsPath(build));
  if (!(found || noticed.has(build))) {
    noticed.add(build);
    console.log(
      `skipping ${buildFolder(build)} descriptor tests: docs/${buildFolder(build)}/rsat-descriptors.json is missing, run scripts/rsat-descriptors.py on the client's eboot`
    );
  }
  return found;
}

// A describe over the build's descriptor catalog: its body runs only when
// hasRsatDescriptors, otherwise the describe is skipped.
export function describeWithRsatDescriptors(
  build: e_build,
  name: string,
  body: (catalog: RsatCatalog) => void
): void {
  if (hasRsatDescriptors(build)) {
    describe(name, () => body(readRsatCatalog(rsatDescriptorsPath(build))));
    return;
  }
  // biome-ignore lint/suspicious/noSkippedTests: the skip is the point
  describe.skip(name, () => {
    it("is not run here", () => undefined);
  });
}
