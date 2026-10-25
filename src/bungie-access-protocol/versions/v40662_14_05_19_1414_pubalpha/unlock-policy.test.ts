import { expect, it } from "vitest";
import { e_build } from "../../../builds";
import type { UnlockScope } from "../../../content/unlock-flags";
import { describeBuild, hasPackages } from "../../../test-support/build";
import * as policy from "./unlock-policy";
import { UNIVERSE_FLAG_CAP } from "./unlock-slots";

const BUILD = e_build.v40662_14_05_19_1414_pubalpha;
const slotted: [UnlockScope, readonly number[]][] = [
  ["offer", policy.VENDOR_OFFER_FLAGS],
  ["account", policy.UNLOCKED_ACCOUNT_FLAGS],
  ["account", policy.SUBCLASS_ACCOUNT_FLAGS],
  ["account", policy.PROGRESSION_ACCOUNT_FLAGS],
  ["character", policy.UNLOCKED_CHARACTER_FLAGS],
  ["character", [policy.PROLOGUE_CHARACTER_FLAG]],
];

describeBuild(BUILD, "40662 unlock policy flags", () => {
  it.skipIf(!hasPackages(BUILD))(
    "are flags the slot tables of their scope can set",
    async () => {
      const { flagSlot } = await import("../../../content/unlock-flags");
      for (const [scope, flags] of slotted) {
        for (const flag of flags) {
          expect(flagSlot(scope, flag), `${scope} flag ${flag}`).toBeDefined();
        }
      }
    }
  );

  it.skipIf(!hasPackages(BUILD))(
    "forces only flags no slot table or clock sets",
    async () => {
      const { flagSource, timedFlags } = await import(
        "../../../content/unlock-flags"
      );
      expect(policy.UNIVERSE_UNLOCK_FLAGS.length).toBeLessThanOrEqual(
        UNIVERSE_FLAG_CAP
      );
      for (const flag of policy.UNIVERSE_UNLOCK_FLAGS) {
        expect(flagSource(flag), `flag ${flag}`).toBe("none");
        expect(timedFlags().has(flag), `flag ${flag}`).toBe(false);
      }
    }
  );

  // The self family the client subscribes to after login_account: the
  // account primary alone, then with a fresh character signed in.
  it.skipIf(!hasPackages(BUILD))(
    "builds the self family for a fresh character",
    async () => {
      const { MemoryCharacterStore } = await import(
        "../../../investment/character-store"
      );
      const { STUB_APPEARANCE } = await import(
        "../../../investment/stubs/stub-account"
      );
      const { flagSlot } = await import("../../../content/unlock-flags");
      const { buildSelfBaselineBody } = await import("./baselines");
      const { selfCharacter, selfPrimary } = await import("./values");
      const store = new MemoryCharacterStore();
      const account = await store.accountForPlatformId(1n, "guardian");
      const character = await store.createCharacter(
        account.soid,
        "guardian",
        STUB_APPEARANCE
      );
      expect(character.prologuePending).toBe(true);
      const primary = selfPrimary(account.soid, character.soid).unknown0;
      const offers = primary.unknown8?.unknown1?.unknown0 ?? [];
      for (const flag of policy.VENDOR_OFFER_FLAGS) {
        expect(offers[flagSlot("offer", flag)!], `offer ${flag}`).toBe(2);
      }
      const accountSlots = primary.unknown7?.unknown0 ?? [];
      for (const flag of policy.UNLOCKED_ACCOUNT_FLAGS) {
        expect(
          accountSlots[flagSlot("account", flag)!],
          `account ${flag}`
        ).toBe(2);
      }
      const flags = selfCharacter(character).unknown10?.unknown0 ?? [];
      for (const flag of [
        ...policy.UNLOCKED_CHARACTER_FLAGS,
        policy.PROLOGUE_CHARACTER_FLAG,
      ]) {
        expect(flags[flagSlot("character", flag)!], `character ${flag}`).toBe(
          2
        );
      }
      expect(
        buildSelfBaselineBody(account.soid, account.soid).length
      ).toBeGreaterThan(0);
      expect(
        buildSelfBaselineBody(
          account.soid,
          account.soid,
          1,
          undefined,
          character,
          [character.soid]
        ).length
      ).toBeGreaterThan(0);
    }
  );

  it.skipIf(!hasPackages(BUILD))(
    "names the prologue mission and its new-character flag",
    async () => {
      const { activityName } = await import("../../../content/activities");
      const { newCharacterFlags } = await import(
        "../../../content/new-character"
      );
      expect(activityName(policy.PROLOGUE_MISSION_ACTIVITY)).toBe(
        "act_cosmo_m1_dome_a"
      );
      for (const classIndex of [0, 1, 2]) {
        for (const race of [0, 1, 2]) {
          expect(newCharacterFlags(classIndex, race)).toContainEqual({
            flag: policy.PROLOGUE_CHARACTER_FLAG,
            value: 2,
          });
        }
      }
    }
  );
});
