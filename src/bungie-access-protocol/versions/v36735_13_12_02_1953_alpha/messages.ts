import { createHash } from "node:crypto";
import {
  decodeServerMessage,
  encodeServerMessage,
  type RsatSchema,
  type rsat,
} from "@blamnetwork/rsat";
import type { LootNonce } from "../../../investment/loot";
import { e_server_message_network_id } from "../../rsat/constants";
import {
  LOCAL_INVESTMENT_ACCOUNT_SOID,
  UNIVERSE_ROOT_SOID,
} from "../../stubs/server-objects";
import type {
  BapMessages,
  ParsedCreateCharacterRequest,
  ParsedFetchFamilyRequest,
  ParsedLoginAccountRequest,
  ParsedLootPickupItemRequest,
  ParsedTalentGridActivateStepRequest,
  ParsedTalentGridBinarySwapRequest,
  ParsedVendorBuyItemRequest,
  ParsedVendorSellItemRequest,
} from "../bap-build";
import { type AlphaBapBuild, alphaBap } from "./alpha-bap";

// The request's value, or null for a body that does not decode.
function tryDecode<T extends Record<string, unknown>>(
  schema: RsatSchema<T>,
  body: Buffer
): T | null {
  try {
    return decodeServerMessage(body, schema).value;
  } catch {
    return null;
  }
}

// login_account response (type-11). Optional payload echoes the 36B account
// nest from the type-10 request (padded).
function buildLoginAccountResponseBodyFromOpts(opts?: {
  accountSoid?: bigint;
  universeSoid?: bigint;
  schemaChecksum?: number;
  contentChecksum?: number;
  // 36B nest copied from the type-10 request.
  account36?: Buffer;
}): Buffer {
  const accountSoid = opts?.accountSoid ?? LOCAL_INVESTMENT_ACCOUNT_SOID;
  const universeSoid = opts?.universeSoid ?? UNIVERSE_ROOT_SOID;
  const schemaChecksum =
    opts?.schemaChecksum ?? alphaBap().checksums.SCHEMA_CHECKSUM;
  const contentChecksum =
    opts?.contentChecksum ?? alphaBap().checksums.CONTENT_CHECKSUM;

  const args = {
    unknown0: { unknown0: 0, unknown1: 0 },
    accountSoid,
    schemaChecksum,
    contentChecksum,
    serverObject: {
      soid: universeSoid,
      unknown1: 0n,
      unknown2: undefined,
      unknown3: undefined,
      unknown4: undefined,
    },
  };

  let optional: Buffer | null = null;
  if (opts?.account36 && opts.account36.length > 0) {
    optional = Buffer.alloc(56, 0);
    opts.account36.subarray(0, 36).copy(optional, 8);
  }

  return encodeServerMessage(
    e_server_message_network_id._server_message_network_id_login_account,
    alphaBap().schemas.LoginAccountResponse,
    args,
    optional
  );
}

function buildFetchFamilyResponseBody(
  status = 0,
  optional: Buffer | null = null
): Buffer {
  return encodeServerMessage(
    e_server_message_network_id._server_message_network_id_fetch_family,
    alphaBap().schemas.FetchFamilyResponse,
    { unknown0: status },
    optional
  );
}

function buildDirectorEnterOrbitResponseBody(): Buffer {
  return encodeServerMessage(
    e_server_message_network_id._server_message_network_id_director_enter_orbit,
    alphaBap().schemas.DirectorEnterOrbitResponse,
    {
      unknown0: { unknown0: 0, unknown1: 0 },
      serverObject: {
        soid: UNIVERSE_ROOT_SOID,
        unknown1: 0n,
        unknown2: undefined,
        unknown3: undefined,
        unknown4: undefined,
      },
    }
  );
}

// profile_set_account_profile (701): a zeroed status nest is success, same as
// 702. A header-only type-11 asserts in the client's server_message decode.
function buildProfileSetAccountProfileResponseBody(): Buffer {
  return encodeServerMessage(
    e_server_message_network_id._server_message_network_id_profile_set_account_profile,
    alphaBap().schemas.ProfileSetAccountProfileResponse,
    {
      unknown0: { unknown0: 0, unknown1: 0 },
    }
  );
}

function buildProfileSetCharacterProfileResponseBody(): Buffer {
  return encodeServerMessage(
    e_server_message_network_id._server_message_network_id_profile_set_character_profile,
    alphaBap().schemas.ProfileSetCharacterProfileResponse,
    {
      unknown0: { unknown0: 0, unknown1: 0 },
    }
  );
}

function parseFetchFamilyRequest(
  body: Buffer
): ParsedFetchFamilyRequest | null {
  if (
    body.length < 2 ||
    body.readUInt16BE(0) !==
      e_server_message_network_id._server_message_network_id_fetch_family
  ) {
    return null;
  }
  const value = tryDecode(alphaBap().schemas.FetchFamilyRequest, body);
  return value
    ? { familyType: value.familyType, rootSoid: value.familyRootSoid }
    : null;
}

// Status nest 80801A2B: 0 = ok (the client also accepts 6); 1..5 = failure,
// names unknown.
const STATUS_OK = { unknown0: 0, unknown1: 0 };
const STATUS_FAILED = { unknown0: 1, unknown1: 0 };

// login_create_character (501): the appearance options and the platform user
// name.
function parseLoginCreateCharacterRequest(
  body: Buffer
): ParsedCreateCharacterRequest | null {
  const value = tryDecode(alphaBap().schemas.LoginCreateCharacterRequest, body);
  if (!value) {
    return null;
  }
  const ec = value.appearanceEc;
  const f0 = value.appearanceF0;
  // Code units are stored with the usual 0x8000 bias (0x8063 = "c"); 0
  // ends the name and 0x7fff pads it.
  const chars = Buffer.from(value.name.chars);
  let name = "";
  for (let i = 0; i + 1 < chars.length; i += 2) {
    const code = (chars.readUInt16BE(i) - 0x8000) & 0xffff;
    if (code === 0 || code === 0xffff) {
      break;
    }
    name += String.fromCharCode(code);
  }
  return {
    name,
    appearance: {
      race: ec.race ?? 0,
      gender: ec.gender ?? 0,
      classIndex: ec.classIndex ?? 0,
      faceIndex: f0.faceIndex,
      hairIndex: f0.hairIndex,
      featureIndex: f0.featureIndex,
      decalIndex: f0.decalIndex,
      skinColor: f0.skinColor,
      lipColor: f0.lipColor,
      eyeColor: f0.eyeColor,
      hairColor: f0.hairColor,
      featureColor: f0.featureColor,
      decalColor: f0.decalColor,
      personalityId: f0.personalityId,
      helmetPreference: f0.helmetPreference,
    },
  };
}

function buildLoginCreateCharacterResponseBody(
  characterSoid: bigint | null
): Buffer {
  return encodeServerMessage(
    e_server_message_network_id._server_message_network_id_login_create_character,
    alphaBap().schemas.LoginCreateCharacterResponse,
    {
      unknown0: characterSoid === null ? STATUS_FAILED : STATUS_OK,
      characterSoid: characterSoid ?? 0n,
    }
  );
}

// login_character (504) and login_delete_character (502) both carry one soid.
function parseCharacterSoidRequest(
  body: Buffer,
  networkId: number
): bigint | null {
  const { schemas } = alphaBap();
  const schema =
    networkId ===
    e_server_message_network_id._server_message_network_id_login_character
      ? schemas.LoginCharacterRequest
      : schemas.LoginDeleteCharacterRequest;
  return tryDecode(schema, body)?.characterSoid ?? null;
}

function buildLoginCharacterResponseBody(ok: boolean): Buffer {
  return encodeServerMessage(
    e_server_message_network_id._server_message_network_id_login_character,
    alphaBap().schemas.LoginCharacterResponse,
    { unknown0: ok ? STATUS_OK : STATUS_FAILED }
  );
}

function buildLoginDeleteCharacterResponseBody(ok: boolean): Buffer {
  return encodeServerMessage(
    e_server_message_network_id._server_message_network_id_login_delete_character,
    alphaBap().schemas.LoginDeleteCharacterResponse,
    { unknown0: ok ? STATUS_OK : STATUS_FAILED }
  );
}

function buildSignoutCharacterResponseBody(): Buffer {
  return encodeServerMessage(
    e_server_message_network_id._server_message_network_id_signout_character,
    alphaBap().schemas.SignoutCharacterResponse,
    { unknown0: STATUS_OK }
  );
}

function parseLoginAccountRequest(
  body: Buffer
): ParsedLoginAccountRequest | null {
  const value = tryDecode(alphaBap().schemas.LoginAccountRequest, body);
  if (!value) {
    return null;
  }
  const account36 = Buffer.from(value.account.unknown.bytes);
  const platformId =
    value.account.trailing === 0n
      ? createHash("sha1").update(account36).digest().readBigUInt64BE(0) >> 1n
      : value.account.trailing;
  return { account36, platformId };
}

type CharacterProfileValue = rsat.Infer<
  AlphaBapBuild["schemas"]["ProfileSetCharacterProfileRequest"]
>["profile"];

// profile_set_character_profile (702) body as stored on the character. Holds
// the ammo fractions and the orbit destination key (unknown3 of the profile
// body).
export function parseCharacterProfile(
  body: Buffer
): CharacterProfileValue | null {
  return (
    tryDecode(alphaBap().schemas.ProfileSetCharacterProfileRequest, body)
      ?.profile ?? null
  );
}

// Inventory requests 401..404. Each carries one item soid (402 wraps it in an
// item reference); every response is the status nest alone. The client applies
// nothing locally: the self and peer families have to be pushed after a
// successful equip / unequip.
const inventoryRequests = () => ({
  [e_server_message_network_id._server_message_network_id_inventory_destroy_item]:
    {
      request: alphaBap().schemas.InventoryDestroyItemRequest,
      response: alphaBap().schemas.InventoryDestroyItemResponse,
    },
  [e_server_message_network_id._server_message_network_id_inventory_equip_item]:
    {
      request: alphaBap().schemas.InventoryEquipItemRequest,
      response: alphaBap().schemas.InventoryEquipItemResponse,
    },
  [e_server_message_network_id._server_message_network_id_inventory_unequip_item]:
    {
      request: alphaBap().schemas.InventoryUnequipItemRequest,
      response: alphaBap().schemas.InventoryUnequipItemResponse,
    },
});

type InventoryNetworkId = keyof ReturnType<typeof inventoryRequests>;

function parseInventoryItemSoid(
  body: Buffer,
  networkId: number
): bigint | null {
  const { schemas } = alphaBap();
  if (
    networkId ===
    e_server_message_network_id._server_message_network_id_inventory_perform_item_action
  ) {
    return (
      tryDecode(schemas.InventoryPerformItemActionRequest, body)?.item
        .itemSoid ?? null
    );
  }
  const schema = inventoryRequests()[networkId as InventoryNetworkId];
  return schema ? (tryDecode(schema.request, body)?.itemSoid ?? null) : null;
}

function buildInventoryResponseBody(networkId: number, ok: boolean): Buffer {
  const status = { unknown0: ok ? STATUS_OK : STATUS_FAILED };
  if (
    networkId ===
    e_server_message_network_id._server_message_network_id_inventory_perform_item_action
  ) {
    return encodeServerMessage(
      networkId,
      alphaBap().schemas.InventoryPerformItemActionResponse,
      status
    );
  }
  const schema = inventoryRequests()[networkId as InventoryNetworkId];
  return encodeServerMessage(networkId, schema.response, status);
}

function parseLootPickupItemRequest(
  body: Buffer
): ParsedLootPickupItemRequest | null {
  const value = tryDecode(alphaBap().schemas.LootPickupItemRequest, body);
  if (!value) {
    return null;
  }
  return {
    state: value.state,
    nonce: {
      incidentNumber: value.nonce.unknown0.unknown0,
      submitterSoid: value.nonce.unknown0.unknown1,
      ordinal: value.nonce.unknown1,
    },
  };
}

// status 0 = accepted; 1 = unknown nonce (logged only). The nonce is echoed
// back regardless of status.
function buildLootPickupItemResponseBody(
  status: number,
  nonce: LootNonce
): Buffer {
  return encodeServerMessage(
    e_server_message_network_id._server_message_network_id_loot_pickup_item,
    alphaBap().schemas.LootPickupItemResponse,
    {
      unknown0: { unknown0: status, unknown1: 0 },
      nonce: {
        unknown0: {
          unknown0: nonce.incidentNumber,
          unknown1: nonce.submitterSoid,
        },
        unknown1: nonce.ordinal,
      },
    }
  );
}

function parseVendorBuyItemRequest(
  body: Buffer
): ParsedVendorBuyItemRequest | null {
  const value = tryDecode(alphaBap().schemas.VendorBuyItemRequest, body);
  if (!value) {
    return null;
  }
  return {
    vendorIndex: value.vendorIndex,
    purchaseIndex: value.purchaseIndex,
  };
}

function buildVendorBuyItemResponseBody(status: number): Buffer {
  return encodeServerMessage(
    e_server_message_network_id._server_message_network_id_vendor_buy_item,
    alphaBap().schemas.VendorBuyItemResponse,
    { unknown0: { unknown0: status, unknown1: 0 } }
  );
}

function parseVendorSellItemRequest(
  body: Buffer
): ParsedVendorSellItemRequest | null {
  const value = tryDecode(alphaBap().schemas.VendorSellItemRequest, body);
  if (!value) {
    return null;
  }
  return {
    hasInstance: value.item.hasInstance,
    itemSoid: value.item.itemSoid,
    defIndex: value.item.defIndex,
    quantity: value.quantity,
    vendorIndex: value.vendorIndex,
  };
}

function buildVendorSellItemResponseBody(status: number): Buffer {
  return encodeServerMessage(
    e_server_message_network_id._server_message_network_id_vendor_sell_item,
    alphaBap().schemas.VendorSellItemResponse,
    { unknown0: { unknown0: status, unknown1: 0 } }
  );
}

function parseTalentGridActivateStepRequest(
  body: Buffer
): ParsedTalentGridActivateStepRequest | null {
  const value = tryDecode(
    alphaBap().schemas.TalentGridActivateStepRequest,
    body
  );
  if (!value) {
    return null;
  }
  return { itemSoid: value.itemSoid, node: value.node.unknown0 };
}

// version is the family-4 version the response makes the client block until
// (state 4 spins until the applied family-4 version reaches it): the version
// about to be pushed on success, or the version already applied on failure.
function buildTalentGridActivateStepResponseBody(
  status: number,
  version: number
): Buffer {
  return encodeServerMessage(
    e_server_message_network_id._server_message_network_id_talent_grid_activate_step,
    alphaBap().schemas.TalentGridActivateStepResponse,
    { unknown0: { unknown0: status, unknown1: version } }
  );
}

function parseTalentGridBinarySwapRequest(
  body: Buffer
): ParsedTalentGridBinarySwapRequest | null {
  const value = tryDecode(alphaBap().schemas.TalentGridBinarySwapRequest, body);
  if (!value) {
    return null;
  }
  return { itemSoid: value.itemSoid, node: value.node };
}

function buildTalentGridBinarySwapResponseBody(
  status: number,
  version: number
): Buffer {
  return encodeServerMessage(
    e_server_message_network_id._server_message_network_id_talent_grid_binary_swap,
    alphaBap().schemas.TalentGridBinarySwapResponse,
    { unknown0: { unknown0: status, unknown1: version } }
  );
}

// The orbit destination key a stored character profile (702) carries, if any.
function characterProfileOrbitKey(profile: Buffer): number | undefined {
  return parseCharacterProfile(profile)?.unknown1?.unknown3 ?? undefined;
}

export const messages: BapMessages = {
  buildDirectorEnterOrbitResponseBody,
  buildFetchFamilyResponseBody,
  buildInventoryResponseBody,
  buildLoginAccountResponseBodyFromOpts,
  buildLoginCharacterResponseBody,
  buildLoginCreateCharacterResponseBody,
  buildLoginDeleteCharacterResponseBody,
  buildLootPickupItemResponseBody,
  buildProfileSetAccountProfileResponseBody,
  buildProfileSetCharacterProfileResponseBody,
  buildSignoutCharacterResponseBody,
  buildTalentGridActivateStepResponseBody,
  buildTalentGridBinarySwapResponseBody,
  buildVendorBuyItemResponseBody,
  buildVendorSellItemResponseBody,
  characterProfileOrbitKey,
  parseCharacterSoidRequest,
  parseFetchFamilyRequest,
  parseInventoryItemSoid,
  parseLoginAccountRequest,
  parseLoginCreateCharacterRequest,
  parseLootPickupItemRequest,
  parseTalentGridActivateStepRequest,
  parseTalentGridBinarySwapRequest,
  parseVendorBuyItemRequest,
  parseVendorSellItemRequest,
};
