import type { LootNonce } from "../../investment/loot";
import { bapBuild } from "../versions";

export type {
  ParsedCreateCharacterRequest,
  ParsedFetchFamilyRequest,
  ParsedLoginAccountRequest,
  ParsedLootPickupItemRequest,
  ParsedTalentGridActivateStepRequest,
  ParsedTalentGridBinarySwapRequest,
  ParsedVendorBuyItemRequest,
  ParsedVendorSellItemRequest,
} from "../versions";

// The world-server messages in the active build's client schemas.
const messages = () => bapBuild().messages;

export const buildDirectorEnterOrbitResponseBody = () =>
  messages().buildDirectorEnterOrbitResponseBody();

export const buildFetchFamilyResponseBody = (
  status?: number,
  optional?: Buffer | null
) => messages().buildFetchFamilyResponseBody(status, optional);

export const buildInventoryResponseBody = (networkId: number, ok: boolean) =>
  messages().buildInventoryResponseBody(networkId, ok);

export const buildLoginAccountResponseBodyFromOpts = (
  opts?: Parameters<
    ReturnType<typeof messages>["buildLoginAccountResponseBodyFromOpts"]
  >[0]
) => messages().buildLoginAccountResponseBodyFromOpts(opts);

export const buildLoginCharacterResponseBody = (ok: boolean) =>
  messages().buildLoginCharacterResponseBody(ok);

export const buildLoginCreateCharacterResponseBody = (
  characterSoid: bigint | null
) => messages().buildLoginCreateCharacterResponseBody(characterSoid);

export const buildLoginDeleteCharacterResponseBody = (ok: boolean) =>
  messages().buildLoginDeleteCharacterResponseBody(ok);

export const buildLootPickupItemResponseBody = (
  status: number,
  nonce: LootNonce
) => messages().buildLootPickupItemResponseBody(status, nonce);

export const buildProfileSetAccountProfileResponseBody = () =>
  messages().buildProfileSetAccountProfileResponseBody();

export const buildProfileSetCharacterProfileResponseBody = () =>
  messages().buildProfileSetCharacterProfileResponseBody();

export const buildSignoutCharacterResponseBody = () =>
  messages().buildSignoutCharacterResponseBody();

export const buildTalentGridActivateStepResponseBody = (
  status: number,
  version: number
) => messages().buildTalentGridActivateStepResponseBody(status, version);

export const buildTalentGridBinarySwapResponseBody = (
  status: number,
  version: number
) => messages().buildTalentGridBinarySwapResponseBody(status, version);

export const buildVendorBuyItemResponseBody = (status: number) =>
  messages().buildVendorBuyItemResponseBody(status);

export const buildVendorSellItemResponseBody = (status: number) =>
  messages().buildVendorSellItemResponseBody(status);

export const characterProfileOrbitKey = (profile: Buffer) =>
  messages().characterProfileOrbitKey(profile);

export const parseCharacterSoidRequest = (body: Buffer, networkId: number) =>
  messages().parseCharacterSoidRequest(body, networkId);

export const parseFetchFamilyRequest = (body: Buffer) =>
  messages().parseFetchFamilyRequest(body);

export const parseInventoryItemSoid = (body: Buffer, networkId: number) =>
  messages().parseInventoryItemSoid(body, networkId);

export const parseLoginAccountRequest = (body: Buffer) =>
  messages().parseLoginAccountRequest(body);

export const parseLoginCreateCharacterRequest = (body: Buffer) =>
  messages().parseLoginCreateCharacterRequest(body);

export const parseLootPickupItemRequest = (body: Buffer) =>
  messages().parseLootPickupItemRequest(body);

export const parseTalentGridActivateStepRequest = (body: Buffer) =>
  messages().parseTalentGridActivateStepRequest(body);

export const parseTalentGridBinarySwapRequest = (body: Buffer) =>
  messages().parseTalentGridBinarySwapRequest(body);

export const parseVendorBuyItemRequest = (body: Buffer) =>
  messages().parseVendorBuyItemRequest(body);

export const parseVendorSellItemRequest = (body: Buffer) =>
  messages().parseVendorSellItemRequest(body);
