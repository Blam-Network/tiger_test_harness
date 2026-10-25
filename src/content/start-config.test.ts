import { describe, expect, it } from "vitest";
import { activityStart } from "./start-config";

describe("activityStart", () => {
  it("carries the start a script writes", () => {
    const start = activityStart("act_cosmo_m4_dome_c");
    expect(start?.destination).toBe("cosmo");
    expect(start?.startSlice).toBe("delta_n");
    expect(start?.phases[0]).toMatchObject({
      name: "cosmo_m4_phase00_array",
      slice: "array",
    });
  });

  it("names the spawn point by its hash", () => {
    expect(activityStart("act_cosmo_m0_highway")?.spawnTransition).toBe(
      0xea_ec_23_35
    );
  });

  it("is undefined for an activity no script starts", () => {
    expect(activityStart("pvp_oasis")).toBeUndefined();
  });
});
