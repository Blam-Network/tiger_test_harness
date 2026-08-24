import { describe, expect, it } from "vitest";
import { activityNameForId } from "./activity-id";

describe("OWC activity id → package symbol", () => {
  it("uses the first activity C-string in 808E2757+id", () => {
    expect(activityNameForId(0)).toBe("city_tower_default1");
    expect(activityNameForId(1)).toBe("action_mock");
    expect(activityNameForId(2)).toBe("venus_chapter_2");
    expect(activityNameForId(7)).toBe("pvp_marsbattle");
    expect(activityNameForId(10)).toBe("city_tower_default1");
    expect(activityNameForId(11)).toBe("cinematic_osiris_default1");
    expect(activityNameForId(16)).toBe("mars_bounty_1");
    expect(activityNameForId(245)).toBe("cosmo_chapter_1");
  });

  it("leaves holes when the def has no activity name", () => {
    expect(activityNameForId(8)).toBeUndefined();
    expect(activityNameForId(9)).toBeUndefined();
    expect(activityNameForId(13)).toBeUndefined();
    expect(activityNameForId(294)).toBeUndefined();
  });
});
