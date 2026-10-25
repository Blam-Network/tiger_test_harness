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
import { pubalphaBap } from "./pubalpha-bap";
import type { SelfSchemas } from "./queuez/self";
import { serverObject } from "./server-object";

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

// login_account response (type-11).
function buildLoginAccountResponseBodyFromOpts(opts?: {
  accountSoid?: bigint;
  universeSoid?: bigint;
  schemaChecksum?: number;
  contentChecksum?: number;
}): Buffer {
  const accountSoid = opts?.accountSoid ?? LOCAL_INVESTMENT_ACCOUNT_SOID;
  const universeSoid = opts?.universeSoid ?? UNIVERSE_ROOT_SOID;
  const schemaChecksum =
    opts?.schemaChecksum ?? pubalphaBap().checksums.SCHEMA_CHECKSUM;
  const contentChecksum =
    opts?.contentChecksum ?? pubalphaBap().checksums.CONTENT_CHECKSUM;

  const args = {
    unknown0: { unknown0: 0, unknown1: 0 },
    accountSoid,
    schemaChecksum,
    contentChecksum,
    serverObject: serverObject(universeSoid),
  };

  // The client builds the handler context at send time; the real server
  // sends no optional blob here.
  return encodeServerMessage(
    e_server_message_network_id._server_message_network_id_login_account,
    pubalphaBap().schemas.LoginAccountResponse,
    args,
    null
  );
}

function buildFetchFamilyResponseBody(
  status = 0,
  optional: Buffer | null = null
): Buffer {
  return encodeServerMessage(
    e_server_message_network_id._server_message_network_id_fetch_family,
    pubalphaBap().schemas.FetchFamilyResponse,
    { unknown0: status },
    optional
  );
}

function buildDirectorEnterOrbitResponseBody(): Buffer {
  return encodeServerMessage(
    e_server_message_network_id._server_message_network_id_director_enter_orbit,
    pubalphaBap().schemas.DirectorEnterOrbitResponse,
    {
      unknown0: { unknown0: 0, unknown1: 0 },
      serverObject: serverObject(UNIVERSE_ROOT_SOID),
    }
  );
}

// profile_set_account_profile (701): a zeroed status nest is success, same as
// 702. A header-only type-11 asserts in the client's server_message decode.
function buildProfileSetAccountProfileResponseBody(): Buffer {
  return encodeServerMessage(
    e_server_message_network_id._server_message_network_id_profile_set_account_profile,
    pubalphaBap().schemas.ProfileSetAccountProfileResponse,
    {
      unknown0: { unknown0: 0, unknown1: 0 },
    }
  );
}

function buildProfileSetCharacterProfileResponseBody(): Buffer {
  return encodeServerMessage(
    e_server_message_network_id._server_message_network_id_profile_set_character_profile,
    pubalphaBap().schemas.ProfileSetCharacterProfileResponse,
    {
      unknown0: { unknown0: 0, unknown1: 0 },
    }
  );
}

// director_complete_bink_activity (105) ack: the status nest like 701/702. The
// client decodes every type-11 body with the nid's response schema and drops
// BAP on a decode failure (an empty body).
export function buildDirectorCompleteBinkActivityResponseBody(): Buffer {
  return encodeServerMessage(
    e_server_message_network_id._server_message_network_id_director_complete_bink_activity,
    pubalphaBap().schemas.DirectorCompleteBinkActivityResponse,
    {
      unknown0: { unknown0: 0, unknown1: 0 },
    }
  );
}

// The activity whose bink ended (125 for the new-character prologue), or null.
export function parseDirectorCompleteBinkActivityRequest(
  body: Buffer
): number | null {
  return (
    tryDecode(pubalphaBap().schemas.DirectorCompleteBinkActivityRequest, body)
      ?.activityIndex ?? null
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
  const value = tryDecode(pubalphaBap().schemas.FetchFamilyRequest, body);
  return value
    ? { familyType: value.familyType, rootSoid: value.familyRootSoid }
    : null;
}

// Status nest (4 bits): 0 = ok (the client also accepts 6); 1..5 = failure,
// names unknown.
const STATUS_OK = { unknown0: 0, unknown1: 0 };
const STATUS_FAILED = { unknown0: 1, unknown1: 0 };

// login_create_character (501): the appearance options and the platform user
// name.
function parseLoginCreateCharacterRequest(
  body: Buffer
): ParsedCreateCharacterRequest | null {
  const { schemas } = pubalphaBap();
  const value = tryDecode(schemas.LoginCreateCharacterRequest, body);
  if (!value) {
    return null;
  }
  const ec = value.appearanceEc;
  const f0 = value.appearanceF0;
  // The name is 17 x i8; read as UTF-8 bytes up to the first 0.
  const bytes = value.name.chars.unknown0.map((c) => c & 0xff);
  const end = bytes.indexOf(0);
  const name = Buffer.from(end < 0 ? bytes : bytes.slice(0, end)).toString(
    "utf8"
  );
  return {
    name,
    appearance: {
      race: ec.unknown0 ?? 0,
      gender: ec.unknown1 ?? 0,
      classIndex: ec.unknown2 ?? 0,
      faceIndex: f0.unknown0,
      hairIndex: f0.unknown1,
      featureIndex: f0.unknown2,
      decalIndex: f0.unknown3,
      skinColor: f0.unknown4,
      lipColor: f0.unknown5,
      eyeColor: f0.unknown6,
      // Hair / feature colour is a group of three; the store keeps a single
      // colour, slot 0.
      hairColor: f0.unknown7.unknown0,
      featureColor: f0.unknown8.unknown0,
      decalColor: f0.unknown9,
      personalityId: f0.unknown10,
      helmetPreference: f0.unknown11,
    },
  };
}

function buildLoginCreateCharacterResponseBody(
  characterSoid: bigint | null
): Buffer {
  return encodeServerMessage(
    e_server_message_network_id._server_message_network_id_login_create_character,
    pubalphaBap().schemas.LoginCreateCharacterResponse,
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
  const { schemas } = pubalphaBap();
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
    pubalphaBap().schemas.LoginCharacterResponse,
    { unknown0: ok ? STATUS_OK : STATUS_FAILED }
  );
}

function buildLoginDeleteCharacterResponseBody(ok: boolean): Buffer {
  return encodeServerMessage(
    e_server_message_network_id._server_message_network_id_login_delete_character,
    pubalphaBap().schemas.LoginDeleteCharacterResponse,
    { unknown0: ok ? STATUS_OK : STATUS_FAILED }
  );
}

function buildSignoutCharacterResponseBody(): Buffer {
  return encodeServerMessage(
    e_server_message_network_id._server_message_network_id_signout_character,
    pubalphaBap().schemas.SignoutCharacterResponse,
    { unknown0: STATUS_OK }
  );
}

function parseLoginAccountRequest(
  body: Buffer
): ParsedLoginAccountRequest | null {
  const { schemas } = pubalphaBap();
  const value = tryDecode(schemas.LoginAccountRequest, body);
  if (!value) {
    return null;
  }
  const account36 = Buffer.from(value.account.unknown.unknown0);
  const platformId =
    value.account.trailing === 0n
      ? createHash("sha1").update(account36).digest().readBigUInt64BE(0) >> 1n
      : value.account.trailing;
  return { account36, platformId };
}

export type CharacterProfileValue = rsat.Infer<SelfSchemas["Unknown8080193C"]>;

// profile_set_character_profile (702) body as stored on the character. Holds
// the ammo fractions and the orbit destination key (unknown3 of the profile
// body).
export function parseCharacterProfile(
  body: Buffer
): CharacterProfileValue | null {
  return (
    tryDecode(pubalphaBap().schemas.ProfileSetCharacterProfileRequest, body)
      ?.profile ?? null
  );
}

// Inventory requests 402..404. Each carries one item soid (402 wraps it in an
// item reference); every response is the status nest alone. There is no 401
// inventory_destroy_item here (405 is in the server_message table, name
// unknown). The client applies nothing locally: the self and peer families
// have to be pushed after a successful equip / unequip.
const inventoryRequests = () => ({
  [e_server_message_network_id._server_message_network_id_inventory_equip_item]:
    {
      request: pubalphaBap().schemas.InventoryEquipItemRequest,
      response: pubalphaBap().schemas.InventoryEquipItemResponse,
    },
  [e_server_message_network_id._server_message_network_id_inventory_unequip_item]:
    {
      request: pubalphaBap().schemas.InventoryUnequipItemRequest,
      response: pubalphaBap().schemas.InventoryUnequipItemResponse,
    },
});

type InventoryNetworkId = keyof ReturnType<typeof inventoryRequests>;

function parseInventoryItemSoid(
  body: Buffer,
  networkId: number
): bigint | null {
  const { schemas } = pubalphaBap();
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
      pubalphaBap().schemas.InventoryPerformItemActionResponse,
      status
    );
  }
  const schema = inventoryRequests()[networkId as InventoryNetworkId];
  return encodeServerMessage(networkId, schema.response, status);
}

function parseLootPickupItemRequest(
  body: Buffer
): ParsedLootPickupItemRequest | null {
  const { schemas } = pubalphaBap();
  const value = tryDecode(schemas.LootPickupItemRequest, body);
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

// status 0 = accepted; 1 = unknown nonce (logged only).
// The nonce is echoed back regardless of status.
function buildLootPickupItemResponseBody(
  status: number,
  nonce: LootNonce
): Buffer {
  return encodeServerMessage(
    e_server_message_network_id._server_message_network_id_loot_pickup_item,
    pubalphaBap().schemas.LootPickupItemResponse,
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
  const { schemas } = pubalphaBap();
  const value = tryDecode(schemas.VendorBuyItemRequest, body);
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
    pubalphaBap().schemas.VendorBuyItemResponse,
    { unknown0: { unknown0: status, unknown1: 0 } }
  );
}

function parseVendorSellItemRequest(
  body: Buffer
): ParsedVendorSellItemRequest | null {
  const { schemas } = pubalphaBap();
  const value = tryDecode(schemas.VendorSellItemRequest, body);
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
    pubalphaBap().schemas.VendorSellItemResponse,
    { unknown0: { unknown0: status, unknown1: 0 } }
  );
}

function parseTalentGridActivateStepRequest(
  body: Buffer
): ParsedTalentGridActivateStepRequest | null {
  const { schemas } = pubalphaBap();
  const value = tryDecode(schemas.TalentGridActivateStepRequest, body);
  if (!value) {
    return null;
  }
  return { itemSoid: value.itemSoid, node: value.node };
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
    pubalphaBap().schemas.TalentGridActivateStepResponse,
    { unknown0: { unknown0: status, unknown1: version } }
  );
}

function parseTalentGridBinarySwapRequest(
  body: Buffer
): ParsedTalentGridBinarySwapRequest | null {
  const { schemas } = pubalphaBap();
  const value = tryDecode(schemas.TalentGridBinarySwapRequest, body);
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
    pubalphaBap().schemas.TalentGridBinarySwapResponse,
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
