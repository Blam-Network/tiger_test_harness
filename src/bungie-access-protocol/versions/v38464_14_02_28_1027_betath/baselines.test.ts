import { expect, it } from "vitest";
import { e_build } from "../../../builds";
import { describeBuild, hasPackages } from "../../../test-support/build";

const BUILD = e_build.v38464_14_02_28_1027_betath;
const ACCOUNT = 0x40_00_00_00_04_7c_6c_8dn;
const CHARACTER = 0x20_00_00_00_0e_f5_cf_7bn;

// The family values fill this build's schemas: fixed-length members get as
// many entries as the schema has (rsat throws otherwise), with the stub
// character's kit read off this build's packages.
describeBuild(BUILD, "38464 family baselines", () => {
  it.skipIf(!hasPackages(BUILD))(
    "encode every family for a stub character",
    async () => {
      const { CharacterLoadout } = await import("../../../investment/loadout");
      const { STUB_APPEARANCE } = await import(
        "../../../investment/stubs/stub-account"
      );
      const baselines = await import("./baselines");
      const character = {
        soid: CHARACTER,
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
      const bodies = [
        baselines.buildSelfBaselineBody(
          ACCOUNT,
          ACCOUNT,
          1,
          undefined,
          character
        ),
        baselines.buildPeerBaselineBody(
          ACCOUNT,
          ACCOUNT,
          1,
          undefined,
          character
        ),
        baselines.buildInspectionBaselineBody(
          ACCOUNT,
          ACCOUNT,
          1,
          undefined,
          character
        ),
        baselines.buildSelectCharacterBaselineBody(
          ACCOUNT,
          ACCOUNT,
          1,
          undefined,
          [character]
        ),
        baselines.buildRosterBaselineBody(
          ACCOUNT,
          ACCOUNT,
          1,
          undefined,
          character
        ),
        baselines.buildUniverseBaselineBody(),
      ];
      for (const body of bodies) {
        expect(body.length).toBeGreaterThan(0);
      }
    },
    60_000
  );

  // A new character is level 6 on every screen: the level row at its XP,
  // the gear block's level 6 (character select, roster, inspection), and no
  // light override below the cap.
  it.skipIf(!hasPackages(BUILD))(
    "shows a new character at its own level",
    async () => {
      const { CharacterLoadout } = await import("../../../investment/loadout");
      const { STUB_APPEARANCE } = await import(
        "../../../investment/stubs/stub-account"
      );
      const { levelProgression } = await import(
        "../../../content/progressions"
      );
      const { NEW_CHARACTER_LEVEL, newCharacterXp } = await import(
        "../../../investment/versions/v38464_14_02_28_1027_betath/new-character"
      );
      const { inspectionCharacter, selectCharacterCharacter, selfCharacter } =
        await import("./values");
      const character = {
        soid: CHARACTER,
        accountSoid: ACCOUNT,
        name: "codie",
        appearance: STUB_APPEARANCE,
        level: NEW_CHARACTER_LEVEL,
        progressionXp: newCharacterXp(),
        progressionZeroXp: 0,
        prologuePending: false,
        loadout: CharacterLoadout.stub(),
        profile: null,
      };
      const self = selfCharacter(character);
      const levelRow = self.unknown7?.unknown0.find(
        (row) => row.unknown0 === levelProgression().index
      );
      expect(levelRow?.unknown1).toBe(newCharacterXp());
      expect(self.unknown16?.unknown3).toBeUndefined();
      expect(inspectionCharacter(character).unknown10?.unknown0).toBe(6);
      expect(selectCharacterCharacter(character).unknown4?.unknown0).toBe(6);
    },
    60_000
  );
});
