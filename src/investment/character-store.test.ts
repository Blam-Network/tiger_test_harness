import { encodeServerMessage } from "@blamnetwork/rsat";
import { describe, expect, it } from "vitest";
import { e_server_message_network_id } from "../bungie-access-protocol/rsat/constants";
import {
  buildLoginCreateCharacterResponseBody,
  parseCharacterSoidRequest,
  parseLoginCreateCharacterRequest,
} from "../bungie-access-protocol/rsat/messages";
import { liveBap } from "../bungie-access-protocol/versions/v41375_14_07_03_1501_live/live-bap";
import { hasPackages } from "../test-support/build";
import {
  MemoryCharacterStore,
  SOID_TYPE_CHARACTER,
  soidFor,
  soidRowId,
} from "./character-store";
import { CharacterLoadout, type LoadoutItem } from "./loadout";
import { STUB_APPEARANCE } from "./stubs/stub-account";

const nid = e_server_message_network_id;

// 80804257 name: 17 x i8, NUL-terminated bytes.
function nameChars(name: string): number[] {
  const out = Array.from({ length: 17 }, () => 0);
  const bytes = Buffer.from(name, "utf8");
  for (let i = 0; i < Math.min(bytes.length, 16); i++) {
    out[i] = bytes[i];
  }
  return out;
}

describe("character store", () => {
  it.skipIf(!hasPackages())(
    "creates, lists and deletes characters",
    async () => {
      const store = new MemoryCharacterStore();
      const account = await store.accountForPlatformId(7n, "guardian");
      const created = await store.createCharacter(account.soid, "hunter", {
        ...STUB_APPEARANCE,
        classIndex: 1,
      });
      expect(soidRowId(created.soid)).toBe(1);
      expect(created.soid).toBe(soidFor(SOID_TYPE_CHARACTER, 1));
      expect(await store.listCharacters(account.soid)).toHaveLength(1);
      expect(await store.deleteCharacter(created.soid)).toBe(true);
      expect(await store.listCharacters(account.soid)).toHaveLength(0);
    }
  );
});

describe("character loadout", () => {
  it.skipIf(!hasPackages())(
    "equips a bag weapon into its bucket's slot and displaces the old one",
    () => {
      const loadout = CharacterLoadout.stub();
      const oldPrimary = loadout.primary;
      expect(oldPrimary).toBeTruthy();
      // The starter kit has no bag spares; add one by hand to exercise the
      // equip/displace path.
      const bagPrimary: LoadoutItem = {
        ...oldPrimary!,
        soid: 0x999n,
        equipSlot: null,
      };
      loadout.addItem(bagPrimary);
      const change = loadout.equip(bagPrimary.soid);
      expect(change?.equipped.soid).toBe(bagPrimary.soid);
      expect(change?.displaced?.soid).toBe(oldPrimary!.soid);
      expect(loadout.primary?.soid).toBe(bagPrimary.soid);
      expect(oldPrimary!.equipSlot).toBeNull();
      expect(loadout.unequip(bagPrimary.soid)).not.toBeNull();
      expect(loadout.primary).toBeUndefined();
      expect(loadout.equip(0x123n)).toBeNull();
    }
  );
});

describe("login messages", () => {
  it("round-trips login_create_character", () => {
    const body = encodeServerMessage(
      nid._server_message_network_id_login_create_character,
      liveBap().schemas.LoginCreateCharacterRequest,
      {
        appearanceEc: { unknown0: 1, unknown1: 0, unknown2: 2 },
        appearanceF0: {
          unknown0: 12,
          unknown1: 3,
          unknown2: 4,
          unknown3: 5,
          unknown4: 6,
          unknown5: 7,
          unknown6: 8,
          unknown7: { unknown0: 9, unknown1: 9, unknown2: 9 },
          unknown8: { unknown0: 10, unknown1: 10, unknown2: 10 },
          unknown9: 11,
          unknown10: 0x811c9dc5,
          unknown11: 1,
        },
        name: { chars: { unknown0: nameChars("codie") } },
      }
    );
    const parsed = parseLoginCreateCharacterRequest(body);
    expect(parsed?.name).toBe("codie");
    expect(parsed?.appearance.classIndex).toBe(2);
    expect(parsed?.appearance.faceIndex).toBe(12);
    expect(parsed?.appearance.decalColor).toBe(11);
    expect(parsed?.appearance.hairColor).toBe(9);
    expect(parsed?.appearance.featureColor).toBe(10);
    expect(parsed?.appearance.helmetPreference).toBe(1);
    expect(
      buildLoginCreateCharacterResponseBody(0x200000003n).length
    ).toBeGreaterThan(8);
  });

  it("parses login_character soid", () => {
    const body = encodeServerMessage(
      nid._server_message_network_id_login_character,
      liveBap().schemas.LoginCharacterRequest,
      { characterSoid: 0x200000009n }
    );
    expect(
      parseCharacterSoidRequest(
        body,
        nid._server_message_network_id_login_character
      )
    ).toBe(0x200000009n);
  });
});
