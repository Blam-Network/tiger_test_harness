import { expect, it } from "vitest";
import { activityName } from "../../../content/activities";
import {
  flagSetTime,
  flagSlot,
  flagSource,
  timedFlags,
  type UnlockScope,
} from "../../../content/unlock-flags";
import { describeWithPackages } from "../../../test-support/build";
import * as policy from "./unlock-policy";

const slotted: [UnlockScope, readonly number[]][] = [
  ["offer", policy.OWNED_OFFER_FLAGS],
  ["offer", policy.VENDOR_OFFER_FLAGS],
  ["offer", policy.LOCK_OFFER_FLAGS],
  ["offer", policy.REVEAL_OFFER_FLAGS],
  ["account", policy.UNLOCKED_ACCOUNT_FLAGS],
  ["account", policy.SUBCLASS_ACCOUNT_FLAGS],
  ["account", policy.PROGRESSION_ACCOUNT_FLAGS],
  ["account", policy.REVEAL_ACCOUNT_FLAGS],
  ["character", policy.UNLOCKED_CHARACTER_FLAGS],
  ["character", policy.REVEAL_CHARACTER_FLAGS],
  ["character", policy.DIRECTOR_CLEARED_CHARACTER_FLAGS],
  ["character", policy.DEBUG_CLEARED_CHARACTER_FLAGS],
  ["character", policy.DEBUG_SET_CHARACTER_FLAGS],
  ["character", [policy.PROLOGUE_CHARACTER_FLAG]],
];

describeWithPackages("unlock policy flags", () => {
  it("are flags the slot tables of their scope can set", () => {
    for (const [scope, flags] of slotted) {
      for (const flag of flags) {
        expect(flagSlot(scope, flag), `${scope} flag ${flag}`).toBeDefined();
      }
    }
  });

  it("forces only flags no slot table carries", () => {
    for (const flags of [
      policy.UNIVERSE_UNLOCK_FLAGS,
      policy.REVEAL_UNIVERSE_FLAGS,
      policy.DIRECTOR_FLAG_PRIORITY,
      policy.TOWER_STATE_FLAGS,
      policy.RELEASE_FLAGS,
    ]) {
      for (const flag of flags) {
        expect(flagSource(flag), `flag ${flag}`).toBe("none");
      }
    }
  });

  it("leaves the release and Tower state flags to the time table", () => {
    for (const flag of [...policy.RELEASE_FLAGS, ...policy.TOWER_STATE_FLAGS]) {
      expect(timedFlags().has(flag), `flag ${flag}`).toBe(true);
    }
    for (const flag of policy.RELEASE_FLAGS) {
      expect(flagSetTime(flag), `flag ${flag}`).toBeDefined();
    }
  });

  it("names the prologue mission", () => {
    expect(activityName(policy.PROLOGUE_MISSION_ACTIVITY)).toBe(
      "act_cosmo_m0_highway"
    );
  });
});
