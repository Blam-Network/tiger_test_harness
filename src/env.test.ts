import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildNumberOfFolder,
  tigerDatabaseUrlFor as scriptDatabaseUrlFor,
} from "../scripts/lib/tiger-database-url.mjs";
import { e_build } from "./builds";
import { testPackagesDir, tigerDatabaseUrlFor } from "./env";

const LIVE = e_build.v41375_14_07_03_1501_live;
const ALPHA = "36735.13.12.02.1953.alpha" as e_build;

describe("tigerDatabaseUrlFor", () => {
  it("is the build's tiger_test_harness-<build number>.db file in the directory", () => {
    const dir = resolve("some", "dir");
    expect(tigerDatabaseUrlFor(dir, LIVE)).toBe(
      `file:${dir.replaceAll("\\", "/")}/tiger_test_harness-41375.db`
    );
    expect(tigerDatabaseUrlFor(dir, ALPHA)).toBe(
      `file:${dir.replaceAll("\\", "/")}/tiger_test_harness-36735.db`
    );
  });

  it("matches the migration script's", () => {
    expect(tigerDatabaseUrlFor("somewhere", LIVE)).toBe(
      scriptDatabaseUrlFor(
        "somewhere",
        buildNumberOfFolder("v41375_14_07_03_1501_live")
      )
    );
  });
});

describe("testPackagesDir", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reads the variable named for the build folder", () => {
    vi.stubEnv("TIGER_TEST_PACKAGES_V36735_13_12_02_1953_ALPHA", __dirname);
    expect(testPackagesDir("v36735_13_12_02_1953_alpha")).toBe(__dirname);
  });

  it("is nothing for an unset variable or a directory that is not there", () => {
    vi.stubEnv("TIGER_TEST_PACKAGES_V36735_13_12_02_1953_ALPHA", "");
    expect(testPackagesDir("v36735_13_12_02_1953_alpha")).toBeUndefined();
    vi.stubEnv(
      "TIGER_TEST_PACKAGES_V36735_13_12_02_1953_ALPHA",
      "/no/such/dir"
    );
    expect(testPackagesDir("v36735_13_12_02_1953_alpha")).toBeUndefined();
  });
});
