import { afterEach, describe, expect, it, vi } from "vitest";
import {
  activeBuild,
  buildFolder,
  chooseBuild,
  clientBuildMatches,
  e_build,
  forBuild,
  parseBuild,
  resetActiveBuildForTest,
} from "./builds";

const LIVE = e_build.v41375_14_07_03_1501_live;
const ALPHA = e_build.v36735_13_12_02_1953_alpha;

afterEach(() => {
  vi.unstubAllEnvs();
  resetActiveBuildForTest();
});

describe("build names", () => {
  it("maps a build to its folder", () => {
    expect(buildFolder(LIVE)).toBe("v41375_14_07_03_1501_live");
    expect(buildFolder(ALPHA)).toBe("v36735_13_12_02_1953_alpha");
  });

  it("parses a build string, a folder name and a suffixed report", () => {
    expect(parseBuild("41375.14.07.03.1501.live")).toBe(LIVE);
    expect(parseBuild("v41375_14_07_03_1501_live")).toBe(LIVE);
    expect(parseBuild("41375.14.07.03.1501.live__release_internal")).toBe(LIVE);
    expect(parseBuild(" 41375.14.07.03.1501.LIVE ")).toBe(LIVE);
    expect(parseBuild("36735.13.12.02.1953.alpha")).toBe(ALPHA);
    expect(parseBuild("v36735_13_12_02_1953_alpha")).toBe(ALPHA);
  });

  it("rejects what is not a build", () => {
    expect(parseBuild("")).toBeUndefined();
    expect(parseBuild("1.0.0.0.0.other")).toBeUndefined();
    expect(parseBuild("41375.14.07.03.1501.live.extra")).toBeUndefined();
  });
});

describe("the active build", () => {
  it("must be chosen while the server has several builds", () => {
    expect(() => chooseBuild(undefined)).toThrow(
      /TIGER_GAME_BUILD is not set.*36735\.13\.12\.02\.1953\.alpha.*41375\.14\.07\.03\.1501\.live/
    );
  });

  it("takes either spelling from the environment", () => {
    vi.stubEnv("TIGER_GAME_BUILD", "v41375_14_07_03_1501_live");
    expect(activeBuild()).toBe(LIVE);
  });

  it("names the valid builds when the value is unknown", () => {
    expect(() => chooseBuild("12345.1.1.1.1.nope")).toThrow(
      /not a known build.*36735\.13\.12\.02\.1953\.alpha \(v36735_13_12_02_1953_alpha\), 38464\.14\.02\.28\.1027\.betath \(v38464_14_02_28_1027_betath\), 39573\.14\.04\.03\.1336\.ff \(v39573_14_04_03_1336_ff\), 40662\.14\.05\.19\.1414\.pubalpha \(v40662_14_05_19_1414_pubalpha\), 41375\.14\.07\.03\.1501\.live \(v41375_14_07_03_1501_live\)/
    );
    vi.stubEnv("TIGER_GAME_BUILD", "nope");
    expect(() => activeBuild()).toThrow(/TIGER_GAME_BUILD=nope/);
  });

  it("is read once", () => {
    vi.stubEnv("TIGER_GAME_BUILD", "41375.14.07.03.1501.live");
    expect(activeBuild()).toBe(LIVE);
    vi.stubEnv("TIGER_GAME_BUILD", "nope");
    expect(activeBuild()).toBe(LIVE);
  });
});

describe("forBuild", () => {
  it("runs only the active build's loader, once", () => {
    const load = vi.fn(() => ({ loaded: true }));
    const other = vi.fn(() => ({ loaded: false }));
    const loaders = {
      v36735_13_12_02_1953_alpha: other,
      v38464_14_02_28_1027_betath: other,
      v39573_14_04_03_1336_ff: other,
      v40662_14_05_19_1414_pubalpha: other,
      v41375_14_07_03_1501_live: load,
    };
    vi.stubEnv("TIGER_GAME_BUILD", "41375.14.07.03.1501.live");
    expect(forBuild(loaders)).toBe(forBuild(loaders));
    expect(load).toHaveBeenCalledTimes(1);
    expect(other).not.toHaveBeenCalled();
  });
});

describe("clientBuildMatches", () => {
  it("tells match, missing and mismatch apart", () => {
    expect(clientBuildMatches("41375.14.07.03.1501.live")).toBe("match");
    expect(
      clientBuildMatches("41375.14.07.03.1501.live__release_internal")
    ).toBe("match");
    expect(clientBuildMatches(undefined)).toBe("missing");
    expect(clientBuildMatches("")).toBe("missing");
    expect(clientBuildMatches("1.0.0.0.0.other")).toBe("mismatch");
    expect(clientBuildMatches("36735.13.12.02.1953.alpha")).toBe("mismatch");
  });

  it("matches the alpha when that is the build served", () => {
    vi.stubEnv("TIGER_GAME_BUILD", "36735.13.12.02.1953.alpha");
    expect(clientBuildMatches("36735.13.12.02.1953.alpha")).toBe("match");
    expect(clientBuildMatches("41375.14.07.03.1501.live")).toBe("mismatch");
  });
});
