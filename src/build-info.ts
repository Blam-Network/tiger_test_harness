// Build identity, Bungie style: {seq}.{yy}.{mm}.{dd}.{hhmm}.{branch}, or
// "untracked version". scripts/release.mjs embeds the value computed by
// scripts/compute-build-string.mjs as __TIGER_TEST_HARNESS_BUILD__.

export interface BuildInfo {
  readonly branch: string;
  readonly buildString: string;
  readonly builtAt: string;
  readonly commit: string;
  readonly seq: number;
}

declare const __TIGER_TEST_HARNESS_BUILD__: BuildInfo | undefined;

export const APP_NAME = "tiger_test_harness";

export const UNTRACKED_BUILD_STRING = "untracked version";

// Stands in wherever the release build did not define the value (nest and tsc
// builds, vitest).
const untracked: BuildInfo = {
  branch: "unknown",
  buildString: UNTRACKED_BUILD_STRING,
  builtAt: "",
  commit: "",
  seq: 0,
};

export const BUILD_INFO: BuildInfo =
  typeof __TIGER_TEST_HARNESS_BUILD__ === "undefined"
    ? untracked
    : __TIGER_TEST_HARNESS_BUILD__;

// "tiger_test_harness 00042.26.10.25.0612.main", what the banner, --version
// and the first log line say.
export const VERSION_LINE = `${APP_NAME} ${BUILD_INFO.buildString}`;
