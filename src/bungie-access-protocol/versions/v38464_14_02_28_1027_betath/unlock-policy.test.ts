import { expect, it } from "vitest";
import { e_build } from "../../../builds";
import type { UnlockScope } from "../../../content/unlock-flags";
import { describeBuild, hasPackages } from "../../../test-support/build";
import * as policy from "./unlock-policy";

const BUILD = e_build.v38464_14_02_28_1027_betath;
const slotted: [UnlockScope, readonly number[]][] = [
  ["offer", policy.VENDOR_OFFER_FLAGS],
  ["character", policy.UNLOCKED_CHARACTER_FLAGS],
];

// The new-character rows' first flag (41375's prologue-pending flag), which
// nothing in this build reads.
const NEW_CHARACTER_FLAG = 1518;

describeBuild(BUILD, "38464 unlock policy flags", () => {
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

  it.skipIf(!hasPackages(BUILD))("sets only flags no clock owns", async () => {
    const { timedFlags } = await import("../../../content/unlock-flags");
    for (const [, flags] of slotted) {
      for (const flag of flags) {
        expect(timedFlags().has(flag), `flag ${flag}`).toBe(false);
      }
    }
  });

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
      const primary = selfPrimary(account.soid, character.soid).unknown0;
      const offers = primary.unknown8?.unknown1?.unknown0 ?? [];
      for (const flag of policy.VENDOR_OFFER_FLAGS) {
        expect(offers[flagSlot("offer", flag)!], `offer ${flag}`).toBe(2);
      }
      const accountSlots = primary.unknown7?.unknown0 ?? [];
      expect(accountSlots.every((value) => value === undefined)).toBe(true);
      const flags = selfCharacter(character).unknown10?.unknown0 ?? [];
      for (const flag of policy.UNLOCKED_CHARACTER_FLAGS) {
        expect(flags[flagSlot("character", flag)!], `character ${flag}`).toBe(
          2
        );
      }
      expect(flags[flagSlot("character", NEW_CHARACTER_FLAG)!]).toBe(undefined);
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

  it.skipIf(!hasPackages(BUILD))("has no prologue mission", async () => {
    const { bapBuild } = await import("..");
    const { newCharacterFlags } = await import(
      "../../../content/new-character"
    );
    expect(bapBuild().prologueMissionActivity).toBeUndefined();
    // Every new-character row still sets the flag; nothing reads it.
    for (const classIndex of [0, 1, 2]) {
      for (const race of [0, 1, 2]) {
        expect(newCharacterFlags(classIndex, race)).toContainEqual({
          flag: NEW_CHARACTER_FLAG,
          value: 2,
        });
      }
    }
  });

  it.skipIf(!hasPackages(BUILD))(
    "opens the pre-alpha's own activities by their flag",
    async () => {
      const { activityName } = await import("../../../content/activities");
      // 238..243: what the pre-alpha's destination offers on PREALPHA_FLAG.
      expect([238, 239, 240, 241, 242].map(activityName)).toEqual([
        "cosmo_portal_1",
        "cosmo_patrols_1",
        "city_tower_default1",
        "pvp_factory",
        "pvp_marsbattle",
      ]);
      expect(policy.UNLOCKED_CHARACTER_FLAGS).toContain(policy.PREALPHA_FLAG);
    }
  );
});
