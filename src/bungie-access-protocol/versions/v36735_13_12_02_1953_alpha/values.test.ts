import { decode, encode } from "@blamnetwork/rsat";
import { beforeAll, describe, expect, it } from "vitest";
import { e_build } from "../../../builds";
import type { CharacterRecord } from "../../../investment/character-store";
import {
  emptyTalentNodes,
  TALENT_NODE_COUNT,
} from "../../../investment/loadout";
import { describeBuild, hasPackages } from "../../../test-support/build";
import type { AlphaBapBuild } from ".";

const BUILD = e_build.v36735_13_12_02_1953_alpha;

// Items, gear and levels come from the packages.
describe.skipIf(!hasPackages(BUILD))("alpha values", () => {
  describeBuild(BUILD, "character values", () => {
    let bap: AlphaBapBuild;
    let values: typeof import("./values");
    let power: typeof import("../../queuez/power-level");
    let guardian: () => Promise<CharacterRecord>;

    beforeAll(async () => {
      const { alphaBap } = await import("./alpha-bap");
      bap = alphaBap();
      values = await import("./values");
      power = await import("../../queuez/power-level");
      const { MemoryCharacterStore } = await import(
        "../../../investment/character-store"
      );
      const { STUB_APPEARANCE } = await import(
        "../../../investment/stubs/stub-account"
      );
      guardian = async () => {
        const store = new MemoryCharacterStore();
        const account = await store.accountForPlatformId(1n, "guardian");
        return store.createCharacter(account.soid, "guardian", STUB_APPEARANCE);
      };
    });

    // The item's own talent grid instance goes out for an unequipped item
    // too: without it the client's memset-0 instance fills in with garbage
    // (a bogus level, a blank tree).
    describe("stubInventoryItem", () => {
      it("sends the talent grid instance for a def with a grid", async () => {
        // Def 434 is a subclass: its grid is the one its def names.
        const { itemDef } = await import("../../../content/items");
        const value = values.stubInventoryItem(1n, 434);
        expect(value.unknown4?.unknown0).toBe(itemDef(434)?.gridIndex);
        expect(value.unknown4?.unknown1?.unknown1).toBe(0);
        expect(value.unknown4?.unknown4?.unknown0).toEqual(emptyTalentNodes());
        expect(value.unknown4?.unknown4?.unknown0).toHaveLength(
          TALENT_NODE_COUNT
        );
      });

      it("always sends exactly the key-0 power slot", () => {
        expect(
          values.stubInventoryItem(1n, 434).unknown3?.unknown0?.unknown0
        ).toEqual([{ unknown0: 0, unknown1: 0 }]);
        expect(
          values.stubInventoryItem(1n, 497, 0, undefined, 10).unknown3?.unknown0
            ?.unknown0[0]
        ).toEqual({ unknown0: 0, unknown1: 10 });
      });
    });

    // Stat 0 is the character's power: its power level is that stat read
    // back through the armour curve (50 + 50 * power).
    describe("stubGearCf power", () => {
      it("sends stat 0 from the equipped gear's power", async () => {
        const character = await guardian();
        for (const item of character.loadout.items) {
          item.power = 10;
        }
        const stats = values.stubGearCf(character).unknown9?.unknown0;
        expect(stats?.[0]).toEqual({ unknown0: 0, unknown1: 550 });
        expect(power.characterPowerLevel(character)).toBe(10);
      });

      it("gives a fresh guardian's unauthored gear its level, 1", async () => {
        expect(power.characterPowerLevel(await guardian())).toBe(1);
      });
    });

    // The PoO/DLC director dialog gate: activities 0..9 unlock on flag
    // slot 556, which account offer 14 satisfies.
    it("sends account offer 14 owned in the self primary", () => {
      const body = encode(bap.queuez.self.SelfPrimary, {
        unknown0: {
          soid: 1n,
          unknown1: undefined,
          characterSoid: undefined,
          unknown3: undefined,
          unknown4: undefined,
          unknown5: undefined,
          unknown6: undefined,
          unknown7: {
            unknown0: false,
            unknown1: { unknown0: values.stubSelfAfSlots(false) },
          },
          unknown8: undefined,
        },
      });
      expect(
        decode(bap.queuez.self.SelfPrimary, body).unknown0.unknown7?.unknown1
          ?.unknown0[14]
      ).toBe(2);
    });

    // A Super has no passive regen; the four super-gain perks are its only
    // energy source.
    it("grants the super gain perks in the preset build's slots", async () => {
      const perks = values.stubGearCf(await guardian()).unknown5?.unknown0;
      expect(perks).toHaveLength(26);
      expect(perks?.slice(0, 7)).toEqual([-1, -1, -1, 97, 98, 96, 95]);
      expect(perks?.slice(7).every((perk) => perk === -1)).toBe(true);
    });

    it("binds the class's abilities in the button order", async () => {
      const character = await guardian();
      expect(
        values
          .stubGearCf(character)
          .unknown1?.unknown0.map((binding) => binding.unknown0)
      ).toEqual([1, 12, 22, 7, 20]);
    });

    it("lists the level progression row after the five ability rows", async () => {
      const character = await guardian();
      character.progressionXp = 1234;
      const rows = values.stubSelfCharacter(character).unknown7?.unknown0;
      expect(rows).toHaveLength(6);
      expect(rows?.[5]).toMatchObject({ unknown0: 12, unknown1: 1234 });
    });
  });
});
