import { expect, it } from "vitest";
import { describeWithPackages } from "../test-support/build";
import { scenarioClient } from "./scenario-client";

describeWithPackages("scenario clients", () => {
  it("come from the disc tables", () => {
    const tower = scenarioClient("city_tower_default1");
    expect(tower?.privateChecksum).toBe(0x04_6c_16_22);
    expect(tower?.publicChecksum).toBe(0xae_03_9a_56);
    expect(tower?.bubbleCount).toBe(5);
    // venus_portal_1:scenario_client 80FE00BF starts in the academy plaza
    // (15) at its venus_strike_1_phase01 spawn points.
    const strike = scenarioClient("venus_portal_1");
    expect(strike).toMatchObject({
      bubbleCount: 29,
      emptyBubbles: [14, 19, 25],
      familyChecksum: 0xa8_ea_d8_4d,
      initialBubble: 15,
      privateChecksum: 0xd1_83_0c_6c,
      publicChecksum: 0x66_23_9d_d0,
      spawnTransition: 0x9c_f7_24_00,
      tag: 0x80_fe_00_bf,
    });
  });
});

// A minimal script that only carries start decorators is enough to start an
// activity the packages give a scenario_client.
describeWithPackages(
  "scenario client of an activity with a minimal script",
  () => {
    it("is startable", () => {
      expect(scenarioClient("mars_portal_2")).toBeDefined();
    });
  }
);
