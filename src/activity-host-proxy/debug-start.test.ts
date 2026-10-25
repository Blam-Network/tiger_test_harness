import { afterEach, describe, expect, it } from "vitest";
import { setDebugTogglesForTest } from "../dev-config/debug-toggles";
import { hasPackages } from "../test-support/build";
import { debugOmitsRowType, debugStart } from "./debug-start";

describe("debug start", () => {
  afterEach(() => {
    setDebugTogglesForTest(undefined);
  });

  it("never withholds the binder's lifetime and player rows", () => {
    const toggles = { omitScriptRowTypes: [1, 2, 12, 16] };
    expect(debugOmitsRowType(toggles, 1)).toBe(true);
    expect(debugOmitsRowType(toggles, 2)).toBe(true);
    expect(debugOmitsRowType(toggles, 12)).toBe(false);
    expect(debugOmitsRowType(toggles, 16)).toBe(false);
    expect(debugOmitsRowType({}, 1)).toBe(false);
  });

  it.skipIf(!hasPackages())(
    "names a phase's bubble state and spawn transition for a debug start",
    () => {
      setDebugTogglesForTest({
        startPhase: { act_cosmo_m0_highway: 2, cine_reveal: 0 },
      });
      expect(debugStart("act_cosmo_m0_highway")).toEqual({
        bubble: 3,
        phaseIndex: 2,
        spawnTransition: 0x68_93_54_72,
        state: 0,
      });
      // The intro phase owns the highway's state 1.
      setDebugTogglesForTest({ startPhase: { act_cosmo_m0_highway: 0 } });
      expect(debugStart("act_cosmo_m0_highway")).toEqual({
        bubble: 14,
        phaseIndex: 0,
        spawnTransition: 0xea_ec_23_35,
        state: 1,
      });
      expect(debugStart("city_tower_default1")).toBeUndefined();
      expect(debugStart(undefined)).toBeUndefined();
      setDebugTogglesForTest({ startPhase: { act_cosmo_m0_highway: 99 } });
      expect(debugStart("act_cosmo_m0_highway")).toBeUndefined();
    }
  );
});
