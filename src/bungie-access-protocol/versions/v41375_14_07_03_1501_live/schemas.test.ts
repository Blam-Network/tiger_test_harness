import { decodeServerMessage } from "@blamnetwork/rsat";
import { describe, expect, it } from "vitest";
import { hasPackages } from "../../../test-support/build";
import { type RoundTrip, roundTrip } from "../../../test-support/rsat-catalog";
import {
  buildFetchFamilyResponseBody,
  buildLoginAccountResponseBodyFromOpts,
} from "../../rsat/messages";
import { loadBapBuild } from "./index";
import {
  buildDirectorCompleteBinkActivityResponseBody,
  parseDirectorCompleteBinkActivityRequest,
} from "./messages";

const { schemas } = loadBapBuild();

const STATUS = { unknown0: { unknown0: 6, unknown1: 42 } };
const SOID = 0x40_00_00_00_04_7c_6c_8dn;

// One representative value per schema the server encodes or decodes.
const CASES: [string, () => RoundTrip][] = [
  [
    "LoginAccountRequest",
    roundTrip(schemas.LoginAccountRequest, {
      account: {
        unknown: { unknown0: Array.from({ length: 36 }, (_, i) => i * 7) },
        trailing: 0x9_01_fc_3f_b8_fe_71n,
      },
    }),
  ],
  [
    "LoginAccountResponse",
    roundTrip(schemas.LoginAccountResponse, {
      unknown0: { unknown0: 0, unknown1: 0 },
      accountSoid: SOID,
      schemaChecksum: 0x41_3b_96_57,
      contentChecksum: 0x7e_99_08_f6,
      serverObject: {
        soid: 0x7f_ff_ff_ff_ff_ff_ff_ffn,
        unknown1: 5n,
        unknown2: { unknown0: [1, -2, 3] },
        unknown3: undefined,
        unknown4: {
          unknown0: [{ unknown0: 1, unknown1: 2, unknown2: -3 }],
        },
        unknown5: 7,
      },
    }),
  ],
  [
    "FetchFamilyRequest",
    roundTrip(schemas.FetchFamilyRequest, {
      familyType: 4,
      familyRootSoid: SOID,
    }),
  ],
  [
    "FetchFamilyResponse",
    roundTrip(schemas.FetchFamilyResponse, { unknown0: 5 }),
  ],
  [
    "DirectorEnterOrbitResponse",
    roundTrip(schemas.DirectorEnterOrbitResponse, {
      ...STATUS,
      serverObject: {
        soid: 1n,
        unknown1: undefined,
        unknown2: undefined,
        unknown3: undefined,
        unknown4: undefined,
        unknown5: undefined,
      },
    }),
  ],
  [
    "ProfileSetCharacterProfileRequest",
    roundTrip(schemas.ProfileSetCharacterProfileRequest, {
      profile: {
        unknown0: {
          unknown0: { unknown0: 1, unknown1: 0.5, unknown2: 0.25 },
          unknown1: undefined,
          unknown2: 3.5,
        },
        unknown1: undefined,
      },
    }),
  ],
  [
    "LoginCreateCharacterRequest",
    roundTrip(schemas.LoginCreateCharacterRequest, {
      appearanceEc: { unknown0: 1, unknown1: undefined, unknown2: 2 },
      appearanceF0: {
        unknown0: 12,
        unknown1: 3,
        unknown2: 4,
        unknown3: 5,
        unknown4: 6,
        unknown5: 7,
        unknown6: 8,
        unknown7: { unknown0: 9, unknown1: 10, unknown2: 11 },
        unknown8: { unknown0: 12, unknown1: 13, unknown2: 14 },
        unknown9: 15,
        unknown10: 0x01_1c_9d_c5,
        unknown11: 1,
      },
      name: {
        chars: { unknown0: [99, 111, 100, 105, 101, ...new Array(12).fill(0)] },
      },
    }),
  ],
  [
    "LoginCreateCharacterResponse",
    roundTrip(schemas.LoginCreateCharacterResponse, {
      ...STATUS,
      characterSoid: 0x2_00_00_00_03n,
    }),
  ],
  [
    "LoginDeleteCharacterRequest",
    roundTrip(schemas.LoginDeleteCharacterRequest, { characterSoid: 9n }),
  ],
  [
    "LoginCharacterRequest",
    roundTrip(schemas.LoginCharacterRequest, { characterSoid: 9n }),
  ],
  [
    "LootPickupItemRequest",
    roundTrip(schemas.LootPickupItemRequest, {
      state: 3,
      nonce: {
        unknown0: { unknown0: 0x34_fd, unknown1: 0x2_00_00_00_01n },
        unknown1: 2,
      },
    }),
  ],
  [
    "LootPickupItemResponse",
    roundTrip(schemas.LootPickupItemResponse, {
      ...STATUS,
      nonce: { unknown0: { unknown0: -1, unknown1: 1n }, unknown1: 0 },
    }),
  ],
  [
    "InventoryPerformItemActionRequest",
    roundTrip(schemas.InventoryPerformItemActionRequest, {
      item: { hasInstance: true, itemSoid: 0x3_00_00_00_42n, defIndex: 497 },
      unknown1: -5,
    }),
  ],
  [
    "InventoryEquipItemRequest",
    roundTrip(schemas.InventoryEquipItemRequest, { itemSoid: 0x42n }),
  ],
  [
    "InventoryUnequipItemRequest",
    roundTrip(schemas.InventoryUnequipItemRequest, { itemSoid: 0x42n }),
  ],
  [
    "VendorBuyItemRequest",
    roundTrip(schemas.VendorBuyItemRequest, {
      vendorIndex: 9,
      purchaseIndex: 3,
      unknown2: 0x77n,
    }),
  ],
  [
    "VendorSellItemRequest",
    roundTrip(schemas.VendorSellItemRequest, {
      item: { hasInstance: false, itemSoid: 0n, defIndex: -1 },
      quantity: 20,
      vendorIndex: 0,
    }),
  ],
  [
    "TalentGridActivateStepRequest",
    roundTrip(schemas.TalentGridActivateStepRequest, {
      itemSoid: 0x42n,
      node: 7,
    }),
  ],
  [
    "TalentGridBinarySwapRequest",
    roundTrip(schemas.TalentGridBinarySwapRequest, {
      itemSoid: 0x42n,
      node: -1,
    }),
  ],
  // Responses that are the status nest alone.
  ...Object.entries({
    ProfileSetAccountProfileResponse: schemas.ProfileSetAccountProfileResponse,
    ProfileSetCharacterProfileResponse:
      schemas.ProfileSetCharacterProfileResponse,
    LoginDeleteCharacterResponse: schemas.LoginDeleteCharacterResponse,
    LoginCharacterResponse: schemas.LoginCharacterResponse,
    SignoutCharacterResponse: schemas.SignoutCharacterResponse,
    InventoryPerformItemActionResponse:
      schemas.InventoryPerformItemActionResponse,
    InventoryEquipItemResponse: schemas.InventoryEquipItemResponse,
    InventoryUnequipItemResponse: schemas.InventoryUnequipItemResponse,
    VendorBuyItemResponse: schemas.VendorBuyItemResponse,
    VendorSellItemResponse: schemas.VendorSellItemResponse,
    TalentGridActivateStepResponse: schemas.TalentGridActivateStepResponse,
    TalentGridBinarySwapResponse: schemas.TalentGridBinarySwapResponse,
  }).map(([name, schema]): [string, () => RoundTrip] => [
    name,
    roundTrip<typeof STATUS>(schema, STATUS),
  ]),
];

describe("message schemas", () => {
  it.each(CASES)("round-trips %s", (_name, run) => {
    const { value, back, bytes, again } = run();
    expect(back).toEqual(value);
    expect(again).toEqual(bytes);
  });

  it.skipIf(!hasPackages())(
    "encodes login_account like the capture (status 4 bits, then error, then soid)",
    () => {
      const body = buildLoginAccountResponseBodyFromOpts({ accountSoid: SOID });
      // BAP boot sequence (2.3.1 capture): 01f7 18000000 04000000 0047c6c8d...
      expect(body.toString("hex")).toMatch(/^01f718000000040000000047c6c8d/);
      const { value } = decodeServerMessage(body, schemas.LoginAccountResponse);
      expect(value.accountSoid).toBe(SOID);
      expect(value.unknown0.unknown0).toBe(0);
    }
  );

  it("writes the fetch_family response status in 4 bits", () => {
    // Bits after the nid: status + 1 in 4 bits, then the optional-payload flag.
    expect(buildFetchFamilyResponseBody(0).toString("hex")).toBe("00ce10");
    expect(buildFetchFamilyResponseBody(7).toString("hex")).toBe("00ce80");
    expect(buildFetchFamilyResponseBody(0, Buffer.from([0xab]))[2]).toBe(0x18);
  });

  it("acks director_complete_bink_activity with a status nest, never empty", () => {
    // Request bytes from a captured log: activity 125 (the prologue bink).
    expect(
      parseDirectorCompleteBinkActivityRequest(Buffer.from("0069807d00", "hex"))
    ).toBe(125);
    const body = buildDirectorCompleteBinkActivityResponseBody();
    const { networkId, value } = decodeServerMessage(
      body,
      schemas.DirectorCompleteBinkActivityResponse
    );
    expect(networkId).toBe(105);
    expect(value.unknown0).toEqual({ unknown0: 0, unknown1: 0 });
  });
});
