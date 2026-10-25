import {
  decode,
  decodeServerMessage,
  type RsatSchema,
} from "@blamnetwork/rsat";
import { describe, expect, it } from "vitest";
import { e_build } from "../../../builds";
import {
  type CatalogValue,
  catalogEncode,
  type RoundTrip,
  roundTrip,
  sampleSchema,
  schemaMismatches,
  UnsupportedKind,
} from "../../../test-support/rsat-catalog";
import { describeWithRsatDescriptors } from "../../../test-support/rsat-descriptors";
import { buildFetchFamilyResponseBody } from "../../rsat/messages";
import { loadBapBuild } from "./index";
import {
  buildDirectorCompleteBinkActivityResponseBody,
  parseDirectorCompleteBinkActivityRequest,
} from "./messages";
import { ZERO_REPLY_BODIES } from "./zero-replies";

const BUILD = e_build.v39573_14_04_03_1336_ff;
const build = loadBapBuild();
const { schemas } = build;

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
      schemaChecksum: 0x12_34_56_78,
      contentChecksum: 0x1a_bc_de_f0,
      serverObject: {
        soid: 0x7f_ff_ff_ff_ff_ff_ff_ffn,
        unknown1: 5n,
        unknown2: { unknown0: [1, -2, 3] },
        unknown3: undefined,
        unknown4: undefined,
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

// Every schema this build defines, by id, and the ids two different schemas
// claim.
function definedSchemas() {
  const schemaById = new Map<number, RsatSchema<Record<string, unknown>>>();
  const claimedTwice: number[] = [];
  for (const group of [schemas, ...Object.values(build.queuez)]) {
    for (const value of Object.values(group)) {
      if (typeof value === "object" && value !== null && "hash" in value) {
        const schema = value as RsatSchema<Record<string, unknown>>;
        const seen = schemaById.get(schema.hash);
        if (seen !== undefined && seen !== schema) {
          claimedTwice.push(schema.hash);
        }
        schemaById.set(schema.hash, schema);
      }
    }
  }
  return { claimedTwice, schemaById };
}

// The self schemas this build lays out unlike the 40662 build, with their
// fields in the catalog's member order.
const CHANGED: [string, number, readonly string[]][] = [
  // A level progression row: the index is an i8 here (an i16 in 40662).
  [
    "Unknown8080176B",
    0x80_80_17_6b,
    ["unknown0", "unknown1", "unknown2", "unknown3"],
  ],
  // An item's primary stat: two level lists where 40662 has two i32s.
  ["Unknown80801711", 0x80_80_17_11, ["unknown0", "unknown1", "unknown2"]],
  ["Unknown808046A9", 0x80_80_46_a9, ["unknown0"]],
  ["Unknown80801920", 0x80_80_19_20, ["unknown0", "unknown1"]],
  ["Unknown80801708", 0x80_80_17_08, ["unknown0", "unknown1", "unknown2"]],
  // An item's talent grid: 40662's with a second u8 ahead of the nests.
  [
    "Unknown80801846",
    0x80_80_18_46,
    [
      "unknown0",
      "unknown1",
      "unknown2",
      "unknown3",
      "unknown4",
      "unknown5",
      "unknown6",
    ],
  ],
  [
    "InventoryItem",
    0x80_80_17_32,
    ["soid", "defIndex", "unknown2", "unknown3", "unknown4"],
  ],
  // The character's unlock slots: 512 (the account's stay 1024).
  ["Unknown8080469B", 0x80_80_46_9b, ["unknown0"]],
  [
    "Unknown808018C7",
    0x80_80_18_c7,
    [
      "soid",
      "roster",
      "characterSoid",
      "unknown3",
      "unknown4",
      "unknown5",
      "unknown6",
      "unknown7",
      "unknown8",
      "unknown9",
      "unknown10",
      "unknown11",
      "unknown12",
    ],
  ],
];

describeWithRsatDescriptors(
  BUILD,
  "schemas against the eboot's catalog",
  (catalog) => {
    const { self, inspection } = build.queuez;

    it.each(CHANGED)("lays out %s as the catalog does", (name, id, fields) => {
      const schema = (self as Record<string, unknown>)[name] as RsatSchema<
        Record<string, unknown>
      >;
      expect(schema.hash).toBe(id);
      expect(Object.keys(schema.fields)).toEqual(fields);
      for (const mode of ["present", "zero"] as const) {
        expect(
          schemaMismatches(catalog, schema, sampleSchema(catalog, id, mode))
        ).toEqual([]);
      }
    });

    it("reads the def index from member 1 of an item", () => {
      const value = sampleSchema(catalog, 0x80_80_17_32, "present") as {
        struct: CatalogValue[];
      };
      const { bytes } = catalogEncode(catalog, 0x80_80_17_32, value);
      expect(decode(self.InventoryItem, bytes).defIndex).toBe(value.struct[1]);
    });

    it("round-trips the characters that hold the changed schemas", () => {
      const characters = [
        self.SelfCharacter,
        self.SelfInventory,
        inspection.InspectionCharacter,
      ] as RsatSchema<Record<string, unknown>>[];
      for (const schema of characters) {
        for (const mode of ["present", "zero"] as const) {
          expect(
            schemaMismatches(
              catalog,
              schema,
              sampleSchema(catalog, schema.hash, mode)
            )
          ).toEqual([]);
        }
      }
    });

    it("states the queuez header checksums of the catalog", () => {
      const checksum = (id: number) =>
        Number.parseInt(
          catalog.descriptors[(id >>> 0).toString(16)]?.checksum ?? "",
          16
        );
      const { peer, roster, selectCharacter } = build.queuez;
      expect(self.SELF_CHECKSUM_PRIMARY).toBe(checksum(0x80_80_18_03));
      expect(self.SELF_CHECKSUM_INVENTORY).toBe(checksum(0x80_80_17_43));
      expect(self.SELF_CHECKSUM_ITEM).toBe(checksum(0x80_80_17_32));
      expect(inspection.INSPECTION_CHECKSUM_PRIMARY).toBe(
        checksum(0x80_80_19_1c)
      );
      expect(inspection.INSPECTION_CHECKSUM_CHARACTER).toBe(
        checksum(0x80_80_17_a5)
      );
      expect(peer.PEER_CHECKSUM_PRIMARY).toBe(checksum(0x80_80_19_21));
      expect(peer.PEER_CHECKSUM_CHARACTER).toBe(checksum(0x80_80_17_fd));
      expect(roster.ROSTER_CHECKSUM_PRIMARY).toBe(checksum(0x80_80_18_b7));
      expect(roster.ROSTER_CHECKSUM_MEMBER).toBe(checksum(0x80_80_18_10));
      expect(selectCharacter.SELECT_CHARACTER_CHECKSUM_PRIMARY).toBe(
        checksum(0x80_80_19_51)
      );
      expect(selectCharacter.SELECT_CHARACTER_CHECKSUM_CHARACTER).toBe(
        checksum(0x80_80_19_54)
      );
      expect(schemas.UNIVERSE_CHECKSUM).toBe(checksum(0x80_80_19_41));
    });

    it("matches the catalog for every schema it defines", () => {
      const { claimedTwice, schemaById } = definedSchemas();
      expect(claimedTwice).toEqual([]);
      const unsupported: string[] = [];
      for (const [id, schema] of schemaById) {
        let present: CatalogValue;
        try {
          present = sampleSchema(catalog, id, "present");
        } catch (error) {
          if (!(error instanceof UnsupportedKind)) {
            throw error;
          }
          unsupported.push((id >>> 0).toString(16));
          continue;
        }
        expect(schemaMismatches(catalog, schema, present)).toEqual([]);
        expect(
          schemaMismatches(catalog, schema, sampleSchema(catalog, id, "zero"))
        ).toEqual([]);
      }
      expect(unsupported).toEqual([]);
    });

    // The status-0 replies of the responses this build's schemas declare.
    it("has the zero reply bodies the catalog gives", () => {
      const responses: [number, RsatSchema<Record<string, unknown>>][] = [
        [104, schemas.DirectorEnterOrbitResponse],
        [105, schemas.DirectorCompleteBinkActivityResponse],
        [206, schemas.FetchFamilyResponse],
        [402, schemas.InventoryPerformItemActionResponse],
        [403, schemas.InventoryEquipItemResponse],
        [404, schemas.InventoryUnequipItemResponse],
        [501, schemas.LoginCreateCharacterResponse],
        [502, schemas.LoginDeleteCharacterResponse],
        [503, schemas.LoginAccountResponse],
        [504, schemas.LoginCharacterResponse],
        [505, schemas.SignoutCharacterResponse],
        [601, schemas.LootPickupItemResponse],
        [701, schemas.ProfileSetAccountProfileResponse],
        [702, schemas.ProfileSetCharacterProfileResponse],
        [801, schemas.TalentGridActivateStepResponse],
        [802, schemas.TalentGridBinarySwapResponse],
        [901, schemas.VendorBuyItemResponse],
        [903, schemas.VendorSellItemResponse],
      ];
      for (const [networkId, schema] of responses) {
        const { bits, bytes } = catalogEncode(
          catalog,
          schema.hash,
          sampleSchema(catalog, schema.hash, "zero")
        );
        expect(ZERO_REPLY_BODIES[networkId], `${networkId}`).toEqual({
          bits,
          hex: bytes.toString("hex"),
        });
      }
    });
  }
);
