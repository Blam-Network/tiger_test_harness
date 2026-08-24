import { describe, expect, it } from "vitest";
import { FAH_INITIAL_BUBBLE, scenarioClient } from "./scenario-client";

describe("FAH_INITIAL_BUBBLE", () => {
  it("is the 80800890+0x1C dword from each named scenario_fah tag", () => {
    expect(FAH_INITIAL_BUBBLE.city_tower_default1).toBe(3);
    expect(FAH_INITIAL_BUBBLE.venus_chapter_2).toBe(16);
    expect(FAH_INITIAL_BUBBLE.venus_portal_1).toBe(16);
    expect(FAH_INITIAL_BUBBLE.venus_bounty_1).toBe(21);
    expect(FAH_INITIAL_BUBBLE.pvp_factory).toBe(0);
    expect(scenarioClient("city_tower_default1")?.initialBubble).toBe(3);
    expect(scenarioClient("venus_chapter_2")?.initialBubble).toBe(16);
  });
});
