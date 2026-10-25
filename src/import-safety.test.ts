import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MODULES } from "./test-support/import-safety";

describe("importing with an unknown build", () => {
  beforeEach(() => {
    vi.stubEnv("TIGER_GAME_BUILD", "bogus");
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it.each(Object.entries(MODULES))("%s", async (_path, load) => {
    await expect(load()).resolves.toBeDefined();
  });
});
