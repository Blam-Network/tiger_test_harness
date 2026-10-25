import { beforeAll, describe, expect, it } from "vitest";
import { e_build } from "../../../builds";
import type { CharacterRecord } from "../../../investment/character-store";
import { describeBuild, hasPackages } from "../../../test-support/build";
import type { AlphaBapBuild } from ".";

const BUILD = e_build.v36735_13_12_02_1953_alpha;
const ACCOUNT = 0x0000000100000001n;

// Characters and their kits come from the packages.
describe.skipIf(!hasPackages(BUILD))("alpha baselines", () => {
  describeBuild(BUILD, "typed peer/inspection/self baselines", () => {
    let character: CharacterRecord;
    let baselines: AlphaBapBuild["baselines"];
    beforeAll(async () => {
      baselines = (await import("./alpha-bap")).alphaBap().baselines;
      const { CharacterLoadout } = await import("../../../investment/loadout");
      const { STUB_APPEARANCE } = await import(
        "../../../investment/stubs/stub-account"
      );
      character = {
        soid: 0x0000000200000002n,
        accountSoid: ACCOUNT,
        name: "codie",
        appearance: STUB_APPEARANCE,
        level: 1,
        progressionXp: 0,
        progressionZeroXp: 0,
        prologuePending: false,
        loadout: CharacterLoadout.stub(),
        profile: null,
      };
    });

    it("peer baseline is deterministic and non-empty", () => {
      const a = baselines.buildPeerBaselineBody(
        ACCOUNT,
        ACCOUNT,
        1,
        undefined,
        character
      );
      const b = baselines.buildPeerBaselineBody(
        ACCOUNT,
        ACCOUNT,
        1,
        undefined,
        character
      );
      expect(a.length).toBeGreaterThan(32);
      expect(a.equals(b)).toBe(true);
    });

    it("inspection baseline is deterministic and non-empty", () => {
      const a = baselines.buildInspectionBaselineBody(
        ACCOUNT,
        ACCOUNT,
        1,
        undefined,
        character
      );
      const b = baselines.buildInspectionBaselineBody(
        ACCOUNT,
        ACCOUNT,
        1,
        undefined,
        character
      );
      expect(a.length).toBeGreaterThan(32);
      expect(a.equals(b)).toBe(true);
    });

    it("self baseline is deterministic and non-empty", () => {
      const a = baselines.buildSelfBaselineBody(
        ACCOUNT,
        ACCOUNT,
        1,
        undefined,
        character
      );
      const b = baselines.buildSelfBaselineBody(
        ACCOUNT,
        ACCOUNT,
        1,
        undefined,
        character
      );
      expect(a.length).toBeGreaterThan(32);
      expect(a.equals(b)).toBe(true);
    });

    it("a self primary without a character lists none and the update has no items", () => {
      const bare = baselines.buildSelfBaselineBody(ACCOUNT, ACCOUNT, 1);
      const signedIn = baselines.buildSelfBaselineBody(
        ACCOUNT,
        ACCOUNT,
        1,
        undefined,
        character
      );
      expect(signedIn.length).toBeGreaterThan(bare.length);
      const update = baselines.buildSelfUpdateBody(ACCOUNT, 2, character, []);
      expect(update.length).toBeLessThan(signedIn.length);
    });

    it("ignores the account's roster: the primary lists the signed-in character", () => {
      const without = baselines.buildSelfBaselineBody(
        ACCOUNT,
        ACCOUNT,
        1,
        undefined,
        character
      );
      const withRoster = baselines.buildSelfBaselineBody(
        ACCOUNT,
        ACCOUNT,
        1,
        undefined,
        character,
        [character.soid, 0x0000000200000009n]
      );
      expect(withRoster.equals(without)).toBe(true);
    });
  });
});
