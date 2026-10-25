import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { e_build } from "../builds";
import { testPackagesDir } from "../env";
import { detectPackagesBuild, packageBuildNumber } from "./detect-build";

function header(platform: number, number: number): Buffer {
  const out = Buffer.alloc(0x70);
  if (platform === 3) {
    out.writeUInt16BE(platform, 2);
    out.writeUInt32BE(number, 0x18);
  } else {
    out.writeUInt16LE(platform, 2);
    out.writeUInt32LE(number, 0x18);
  }
  return out;
}

function packagesDir(files: Record<string, Buffer>): string {
  const dir = mkdtempSync(path.join(tmpdir(), "detect-build-"));
  for (const [name, bytes] of Object.entries(files)) {
    writeFileSync(path.join(dir, name), bytes);
  }
  return dir;
}

describe("packageBuildNumber", () => {
  it("reads 360 headers big-endian and PS4 headers little-endian", () => {
    expect(packageBuildNumber(header(3, 36_735))).toBe(36_735);
    expect(packageBuildNumber(header(7, 41_345))).toBe(41_345);
  });

  it("rejects short or unknown headers", () => {
    expect(packageBuildNumber(Buffer.alloc(8))).toBeUndefined();
    expect(packageBuildNumber(header(9, 1))).toBeUndefined();
  });
});

describe("detectPackagesBuild", () => {
  it("names the build all the packages are from", () => {
    const dir = packagesDir({
      "a.pkg": header(3, 36_735),
      "b.PKG": header(3, 36_735),
      "notes.txt": Buffer.from("x"),
    });
    expect(detectPackagesBuild(dir).build).toBe(
      e_build.v36735_13_12_02_1953_alpha
    );
  });

  it("maps the live package build to the live build, on either platform", () => {
    expect(
      detectPackagesBuild(packagesDir({ "a.pkg": header(7, 41_345) })).build
    ).toBe(e_build.v41375_14_07_03_1501_live);
  });

  it("names none when builds are mixed", () => {
    const found = detectPackagesBuild(
      packagesDir({ "a.pkg": header(7, 41_345), "b.pkg": header(7, 38_464) })
    );
    expect(found.build).toBeUndefined();
    expect(found.numbers.size).toBe(2);
  });

  it("names none for an unsupported build or an unreadable file", () => {
    expect(
      detectPackagesBuild(packagesDir({ "a.pkg": header(7, 52_553) })).build
    ).toBeUndefined();
    const found = detectPackagesBuild(
      packagesDir({ "a.pkg": header(3, 36_735), "b.pkg": Buffer.from("junk") })
    );
    expect(found.build).toBeUndefined();
    expect(found.unreadable).toBe(1);
  });
});

// The real package folders, when their TIGER_TEST_PACKAGES_<FOLDER> is set.
describe("detectPackagesBuild with the disc packages", () => {
  for (const [folder, build] of Object.entries({
    v36735_13_12_02_1953_alpha: e_build.v36735_13_12_02_1953_alpha,
    v38464_14_02_28_1027_betath: e_build.v38464_14_02_28_1027_betath,
    v39573_14_04_03_1336_ff: e_build.v39573_14_04_03_1336_ff,
    v40662_14_05_19_1414_pubalpha: e_build.v40662_14_05_19_1414_pubalpha,
    v41375_14_07_03_1501_live: e_build.v41375_14_07_03_1501_live,
  })) {
    const dir = testPackagesDir(folder);
    it.skipIf(!dir)(`${folder}`, () => {
      expect(detectPackagesBuild(dir as string).build).toBe(build);
    });
  }
});
