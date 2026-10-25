import { afterAll, beforeAll, describe, it, vi } from "vitest";
import { buildFolder, e_build } from "../builds";
import { detectPackagesBuild } from "../content/detect-build";
import { testPackagesDir } from "../env";

// The packages directory a build's gated tests read, or undefined unless
// hasPackages.
export function buildPackagesDir(build: e_build): string | undefined {
  return hasPackages(build) ? testPackagesDir(buildFolder(build)) : undefined;
}

const packagesFound = new Map<e_build, boolean>();

// Whether the build's tests can read their packages: its
// TIGER_TEST_PACKAGES_<FOLDER> is set, exists and its headers name that build.
// With no build, the one the test file runs on (see default-build.ts). A
// build without packages is said so once per file.
export function hasPackages(
  build: e_build = process.env.TIGER_GAME_BUILD as e_build
): boolean {
  let found = packagesFound.get(build);
  if (found === undefined) {
    const dir = testPackagesDir(buildFolder(build));
    found = dir !== undefined && detectPackagesBuild(dir).build === build;
    packagesFound.set(build, found);
    if (!found) {
      console.log(skipNotice(build));
    }
  }
  return found;
}

// A describe that stays empty (its body never runs, so it may read content
// the build's packages hold), reported as skipped.
function skipped(name: string): void {
  // biome-ignore lint/suspicious/noSkippedTests: the skip is the point
  describe.skip(name, () => {
    it("is not run here", () => undefined);
  });
}

// A describe for the tests that read the packages of the build the file runs
// on: its body runs only when hasPackages, otherwise it is skipped.
export function describeWithPackages(
  name: string,
  ...rest: [body: () => void] | [options: { timeout: number }, body: () => void]
): void {
  if (hasPackages()) {
    describe(name, ...(rest as [{ timeout: number }, () => void]));
  } else {
    skipped(name);
  }
}

// A describeBuild whose tests read the build's packages: skipped, with one
// line saying why, unless hasPackages.
function describePackages(
  build: e_build,
  name: string,
  body: () => void
): void {
  describeBuild(build, name, body, !hasPackages(build));
}

// A describeEachBuild whose tests read each build's packages.
export function describeEachPackages(
  name: string,
  body: (build: e_build) => void,
  only: readonly e_build[] = Object.values(e_build)
): void {
  const wanted = (process.env.TIGER_TEST_BUILDS ?? "").split(",");
  const runs = only.filter((build) => wanted.includes(build));
  for (const build of runs) {
    describePackages(build, `${name} (${buildFolder(build)})`, () =>
      body(build)
    );
  }
  if (runs.length === 0) {
    skipped(name);
  }
}

function skipNotice(build: e_build): string {
  return `skipping ${buildFolder(build)} package tests: TIGER_TEST_PACKAGES_${buildFolder(build).toUpperCase()} not set or not this build's packages`;
}

// Runs a describe with `build` as the active build, on fresh modules.
// Stubs TIGER_GAME_BUILD and resets the module registry around the block, so
// the block's tests load what they test with a dynamic import (a static one
// would keep the first build's module state). TIGER_PACKAGES_DIR is the
// build's test packages (TIGER_TEST_PACKAGES_<FOLDER>) or empty, never the
// served build's. Build schemas register in rsat's process-wide registry, so
// keep a file to one build.
export function describeBuild(
  build: e_build,
  name: string,
  body: () => void,
  skip = false
): void {
  if (skip) {
    skipped(name);
    return;
  }
  describe(name, () => {
    beforeAll(() => {
      vi.stubEnv("TIGER_GAME_BUILD", build);
      vi.stubEnv("TIGER_PACKAGES_DIR", buildPackagesDir(build) ?? "");
      vi.resetModules();
    });
    afterAll(() => {
      vi.unstubAllEnvs();
      vi.resetModules();
    });
    body();
  });
}

// A describe per build the run covers (see default-build.ts), each on its own
// build as describeBuild does. `only` narrows it to the builds the suite
// applies to. Files that use it are named *.builds.test.ts: vitest.config.ts
// runs those once per build, each in a process of its own.
export function describeEachBuild(
  name: string,
  body: (build: e_build) => void,
  only: readonly e_build[] = Object.values(e_build)
): void {
  const wanted = (process.env.TIGER_TEST_BUILDS ?? "").split(",");
  const runs = only.filter((build) => wanted.includes(build));
  for (const build of runs) {
    describeBuild(build, `${name} (${buildFolder(build)})`, () => body(build));
  }
  if (runs.length === 0) {
    skipped(name);
  }
}
