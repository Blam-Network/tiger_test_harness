import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { APP_NAME, UNTRACKED_BUILD_STRING, VERSION_LINE } from "./build-info";

const script = resolve("scripts", "compute-build-string.mjs");

// Runs the script the way CI and release.mjs do, from a clean environment so
// the machine's own TIGER_TEST_HARNESS_* settings don't leak in.
function compute(env: Record<string, string>) {
  const output = execFileSync(process.execPath, [script], {
    encoding: "utf8",
    env: { PATH: process.env.PATH ?? "", ...env },
  });
  return JSON.parse(output);
}

describe("build info", () => {
  it("is the untracked version outside a release build", () => {
    expect(VERSION_LINE).toBe(`${APP_NAME} ${UNTRACKED_BUILD_STRING}`);
  });
});

describe("compute-build-string", () => {
  it("formats seq, UTC stamp and branch", () => {
    const info = compute({
      TIGER_TEST_HARNESS_SEQ: "42",
      TIGER_TEST_HARNESS_BRANCH: "main",
    });
    expect(info.buildString).toMatch(
      /^00042\.\d{2}\.\d{2}\.\d{2}\.\d{4}\.main$/
    );
    expect(info.seq).toBe(42);
    expect(info.branch).toBe("main");
  });

  it("makes a branch name safe for a tag", () => {
    const info = compute({
      TIGER_TEST_HARNESS_SEQ: "7",
      TIGER_TEST_HARNESS_BRANCH: "feature/hard wipe",
    });
    expect(info.buildString).toMatch(/\.feature-hard_wipe$/);
  });

  it("is untracked without a seq, when forced and on a detached HEAD", () => {
    const cases: Record<string, string>[] = [
      { TIGER_TEST_HARNESS_BRANCH: "main" },
      {
        TIGER_TEST_HARNESS_SEQ: "42",
        TIGER_TEST_HARNESS_BRANCH: "main",
        TIGER_TEST_HARNESS_UNTRACKED: "1",
      },
      { TIGER_TEST_HARNESS_SEQ: "42", TIGER_TEST_HARNESS_BRANCH: "HEAD" },
    ];
    for (const env of cases) {
      expect(compute(env).buildString).toBe(UNTRACKED_BUILD_STRING);
    }
  });
});
