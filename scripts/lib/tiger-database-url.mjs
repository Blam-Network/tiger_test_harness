import { resolve } from "node:path";

const BUILD_FOLDER = /^v(\d+)_/;

// Each build gets its own SQLite file in `dir`,
// tiger_test_harness-<build number>.db. Same derivation as tigerDatabaseUrlFor in
// src/env.ts (a test keeps them equal).
export function tigerDatabaseUrlFor(dir, buildNumber) {
  return `file:${resolve(dir, `tiger_test_harness-${buildNumber}.db`).replaceAll("\\", "/")}`;
}

// The build number in a build folder name: v41375_14_... is 41375.
export function buildNumberOfFolder(folder) {
  const match = BUILD_FOLDER.exec(folder);
  if (!match) {
    throw new Error(`${folder} is not a build folder name`);
  }
  return match[1];
}
