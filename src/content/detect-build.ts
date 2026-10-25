// Names the game build a packages folder belongs to from the .pkg headers.
import { closeSync, openSync, readdirSync, readSync } from "node:fs";
import path from "node:path";
import { e_build } from "../builds";

// Every package starts with the same header. Where it is not text, the
// platform decides the byte order: 360 packages are big-endian, PS4 little.
//   0x02 u16  platform (3 = 360, 7 = PS4)
//   0x14 u32  build time, unix seconds
//   0x18 u32  build number of the tool that wrote the package
const HEADER_SIZE = 0x1c;
const PLATFORM_OFFSET = 0x02;
const BUILD_NUMBER_OFFSET = 0x18;
const PLATFORM_X360 = 3;
const PLATFORM_PS4 = 7;

// Package build number -> build. The live packages were written by tool build
// 41345, a little before the 41375 executable.
const PACKAGE_BUILDS: Record<number, e_build> = {
  36735: e_build.v36735_13_12_02_1953_alpha,
  38464: e_build.v38464_14_02_28_1027_betath,
  39573: e_build.v39573_14_04_03_1336_ff,
  40662: e_build.v40662_14_05_19_1414_pubalpha,
  41345: e_build.v41375_14_07_03_1501_live,
};

// The package build number in a header, or undefined if it isn't one.
export function packageBuildNumber(header: Buffer): number | undefined {
  if (header.length < HEADER_SIZE) {
    return;
  }
  const platform = header.readUInt16BE(PLATFORM_OFFSET);
  if (platform === PLATFORM_X360) {
    return header.readUInt32BE(BUILD_NUMBER_OFFSET);
  }
  if (header.readUInt16LE(PLATFORM_OFFSET) === PLATFORM_PS4) {
    return header.readUInt32LE(BUILD_NUMBER_OFFSET);
  }
  return;
}

interface detected_packages {
  // The one supported build all the packages are from.
  build?: e_build;
  // Package build number -> files with it.
  numbers: Map<number, number>;
  // Files that don't start like a package.
  unreadable: number;
}

export function detectPackagesBuild(dir: string): detected_packages {
  const numbers = new Map<number, number>();
  let unreadable = 0;
  const header = Buffer.alloc(HEADER_SIZE);
  for (const name of readdirSync(dir)) {
    if (!name.toLowerCase().endsWith(".pkg")) {
      continue;
    }
    let number: number | undefined;
    try {
      const fd = openSync(path.join(dir, name), "r");
      try {
        const read = readSync(fd, header, 0, HEADER_SIZE, 0);
        number = packageBuildNumber(header.subarray(0, read));
      } finally {
        closeSync(fd);
      }
    } catch {
      number = undefined;
    }
    if (number === undefined) {
      unreadable++;
    } else {
      numbers.set(number, (numbers.get(number) ?? 0) + 1);
    }
  }
  const builds = new Set([...numbers.keys()].map((n) => PACKAGE_BUILDS[n]));
  const only = builds.size === 1 ? [...builds][0] : undefined;
  return { numbers, unreadable, build: unreadable === 0 ? only : undefined };
}

export function describeDetected(found: detected_packages): string {
  const parts = [...found.numbers]
    .sort(([a], [b]) => a - b)
    .map(
      ([n, files]) =>
        `${n}${PACKAGE_BUILDS[n] ? "" : " (not supported)"} x${files}`
    );
  if (found.unreadable) {
    parts.push(`${found.unreadable} unreadable`);
  }
  return parts.length ? parts.join(", ") : "no .pkg files";
}

// The packages folder, once its headers are not clearly another supported
// build than the one served. Unknown, mixed or unreadable folders are left to
// the reader.
export function checkedPackagesDir(dir: string, served: e_build): string {
  const found = detectPackagesBuild(dir);
  if (found.build && found.build !== served) {
    throw new Error(
      `TIGER_PACKAGES_DIR ${dir} holds build ${found.build}, serving ${served}`
    );
  }
  return dir;
}
