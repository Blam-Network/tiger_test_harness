import { event_message } from "@blamnetwork/datamine";
import { resolveGameBuild } from "./env";

// Builds this server can serve, one per process. Keys are the folder names the tag definitions, bullshcript, Fukugen Daihon and the dictionary use.
export const e_build = {
  v36735_13_12_02_1953_alpha: "36735.13.12.02.1953.alpha",
  v38464_14_02_28_1027_betath: "38464.14.02.28.1027.betath",
  v39573_14_04_03_1336_ff: "39573.14.04.03.1336.ff",
  v40662_14_05_19_1414_pubalpha: "40662.14.05.19.1414.pubalpha",
  v41375_14_07_03_1501_live: "41375.14.07.03.1501.live",
} as const;
export type e_build = (typeof e_build)[keyof typeof e_build];
export type build_folder = keyof typeof e_build;

const BUILD_FOLDERS = Object.keys(e_build) as build_folder[];
const BUILDS = Object.values(e_build) as e_build[];

// What follows a build string in some reports ("...live__release_internal").
const BUILD_SUFFIX = "__";

export function buildFolder(build: e_build): build_folder {
  const folder = BUILD_FOLDERS.find((key) => e_build[key] === build);
  if (!folder) {
    throw new Error(`unknown build ${build}`);
  }
  return folder;
}

// A build string or a folder name, either with a suffix after "__".
export function parseBuild(text: string): e_build | undefined {
  const bare = text.trim().toLowerCase().split(BUILD_SUFFIX)[0];
  const folder = BUILD_FOLDERS.find((key) => key === bare);
  return (
    BUILDS.find((build) => build === bare) ??
    (folder && e_build[folder]) ??
    undefined
  );
}

function validBuilds(): string {
  return BUILDS.map((build) => `${build} (${buildFolder(build)})`).join(", ");
}

// The build named by `raw` (TIGER_GAME_BUILD). Unset picks the only build,
// which stops being possible once the server has several.
export function chooseBuild(raw: string | undefined): e_build {
  if (raw === undefined) {
    if (BUILDS.length !== 1) {
      throw new Error(
        `TIGER_GAME_BUILD is not set: choose one of ${validBuilds()}`
      );
    }
    return BUILDS[0];
  }
  const build = parseBuild(raw);
  if (!build) {
    throw new Error(
      `TIGER_GAME_BUILD=${raw} is not a known build: choose one of ${validBuilds()}`
    );
  }
  return build;
}

let active: e_build | undefined;
let loaded = new WeakMap<object, unknown>();
let logged = false;

export function activeBuild(): e_build {
  active ??= chooseBuild(resolveGameBuild());
  return active;
}

// Test seam: read TIGER_GAME_BUILD again, and load and log afresh.
export function resetActiveBuildForTest(): void {
  active = undefined;
  loaded = new WeakMap();
  logged = false;
}

// Runs only the active build's loader, once per loaders object.
export function forBuild<T>(
  loaders: Readonly<Record<build_folder, () => T>>
): T {
  if (!loaded.has(loaders)) {
    loaded.set(loaders, loaders[buildFolder(activeBuild())]());
  }
  return loaded.get(loaders) as T;
}

// A client's reported build against ours. Missing is not a mismatch: not
// every client message says which build it is.
export function clientBuildMatches(
  reported: string | undefined
): "match" | "missing" | "mismatch" {
  if (!reported?.trim()) {
    return "missing";
  }
  return parseBuild(reported) === activeBuild() ? "match" : "mismatch";
}

// Names the active build in the log, once per process; throws if there is none.
export function logActiveBuild(): void {
  const build = activeBuild();
  if (!logged) {
    logged = true;
    event_message(
      "lifecycle: serving build %s (%s)",
      build,
      buildFolder(build)
    );
  }
}
