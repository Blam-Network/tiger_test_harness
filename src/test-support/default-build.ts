import path from "node:path";
import { config as loadDotenv } from "dotenv";
import { expect } from "vitest";
import { buildFolder, e_build } from "../builds";
import { testPackagesDir } from "../env";

// A test file runs on the build whose version folder it is in, else the live
// build; describeEachBuild covers all builds or the one TIGER_GAME_BUILD names.
// TIGER_PACKAGES_DIR is the build's test packages or empty, never a dev .env's.
const BUILDS = Object.values(e_build);

function folderOf(path: string | undefined): e_build | undefined {
  return BUILDS.find((build) =>
    path?.includes(`/versions/${buildFolder(build)}/`)
  );
}

const requested = process.env.TIGER_GAME_BUILD?.trim();
process.env.TIGER_TEST_BUILDS = requested || BUILDS.join(",");
// biome-ignore lint/suspicious/noMisplacedAssertion: the test path is only on the expect state
const testPath = expect.getState().testPath?.replaceAll("\\", "/");
process.env.TIGER_GAME_BUILD =
  folderOf(testPath) ?? e_build.v41375_14_07_03_1501_live;
const build = process.env.TIGER_GAME_BUILD as e_build;
loadDotenv({ path: path.join(process.cwd(), ".env.test"), override: false });
process.env.TIGER_PACKAGES_DIR = testPackagesDir(buildFolder(build)) ?? "";
