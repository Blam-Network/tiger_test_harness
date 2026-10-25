import type { DescEnum, Message } from "@bufbuild/protobuf";
import type { GenMessage } from "@bufbuild/protobuf/codegenv2";
import type {
  CharacterAppearance,
  CharacterRecord,
} from "../../investment/character-store";
import type { LootNonce } from "../../investment/loot";
import type { WorldServerRoute } from "../world-server/context";

export interface ParsedFetchFamilyRequest {
  familyType: number;
  rootSoid: bigint;
}

export interface ParsedCreateCharacterRequest {
  appearance: CharacterAppearance;
  name: string;
}

export interface ParsedLoginAccountRequest {
  account36: Buffer;
  // The account key: the request's trailing u64 when set, else a digest of the
  // 36-byte account nest (the client sends the trailing word as 0).
  platformId: bigint;
}

export interface ParsedLootPickupItemRequest {
  nonce: LootNonce;
  state: number;
}

export interface ParsedTalentGridActivateStepRequest {
  itemSoid: bigint;
  node: number;
}

export interface ParsedTalentGridBinarySwapRequest {
  itemSoid: bigint;
  node: number;
}

export interface ParsedVendorBuyItemRequest {
  purchaseIndex: number;
  vendorIndex: number;
}

export interface ParsedVendorSellItemRequest {
  defIndex: number;
  hasInstance: boolean;
  itemSoid: bigint;
  quantity: number;
  vendorIndex: number;
}

// The world-server messages a build's client schemas encode and decode. The
// bodies are the rsat payloads after the 16-bit network id (responses carry
// it); each parser returns null for a body that does not decode.
export interface BapMessages {
  buildDirectorEnterOrbitResponseBody(): Buffer;
  buildFetchFamilyResponseBody(
    status?: number,
    optional?: Buffer | null
  ): Buffer;
  buildInventoryResponseBody(networkId: number, ok: boolean): Buffer;
  // The login_account response. A build whose response carries the request's
  // 36-byte account nest echoes `account36`.
  buildLoginAccountResponseBodyFromOpts(opts?: {
    account36?: Buffer;
    accountSoid?: bigint;
    contentChecksum?: number;
    schemaChecksum?: number;
    universeSoid?: bigint;
  }): Buffer;
  buildLoginCharacterResponseBody(ok: boolean): Buffer;
  buildLoginCreateCharacterResponseBody(characterSoid: bigint | null): Buffer;
  buildLoginDeleteCharacterResponseBody(ok: boolean): Buffer;
  buildLootPickupItemResponseBody(status: number, nonce: LootNonce): Buffer;
  buildProfileSetAccountProfileResponseBody(): Buffer;
  buildProfileSetCharacterProfileResponseBody(): Buffer;
  buildSignoutCharacterResponseBody(): Buffer;
  buildTalentGridActivateStepResponseBody(
    status: number,
    version: number
  ): Buffer;
  buildTalentGridBinarySwapResponseBody(
    status: number,
    version: number
  ): Buffer;
  buildVendorBuyItemResponseBody(status: number): Buffer;
  buildVendorSellItemResponseBody(status: number): Buffer;
  // The orbit destination key in a stored character profile (702), if it
  // carries one.
  characterProfileOrbitKey(profile: Buffer): number | undefined;
  parseCharacterSoidRequest(body: Buffer, networkId: number): bigint | null;
  parseFetchFamilyRequest(body: Buffer): ParsedFetchFamilyRequest | null;
  parseInventoryItemSoid(body: Buffer, networkId: number): bigint | null;
  parseLoginAccountRequest(body: Buffer): ParsedLoginAccountRequest | null;
  parseLoginCreateCharacterRequest(
    body: Buffer
  ): ParsedCreateCharacterRequest | null;
  parseLootPickupItemRequest(body: Buffer): ParsedLootPickupItemRequest | null;
  parseTalentGridActivateStepRequest(
    body: Buffer
  ): ParsedTalentGridActivateStepRequest | null;
  parseTalentGridBinarySwapRequest(
    body: Buffer
  ): ParsedTalentGridBinarySwapRequest | null;
  parseVendorBuyItemRequest(body: Buffer): ParsedVendorBuyItemRequest | null;
  parseVendorSellItemRequest(body: Buffer): ParsedVendorSellItemRequest | null;
}

// The queuez family baselines and updates a build's schemas encode. Each is
// the family's queuez objects framed for a type-123 push.
export interface BapBaselines {
  buildInspectionBaselineBody(
    rootSoid: bigint,
    objectSoid: bigint,
    version?: number,
    headerChecksum?: number,
    character?: CharacterRecord | null
  ): Buffer;
  buildPeerBaselineBody(
    rootSoid: bigint,
    objectSoid: bigint,
    version?: number,
    headerChecksum?: number,
    character?: CharacterRecord | null
  ): Buffer;
  buildPeerUpdateBody(
    rootSoid: bigint,
    version: number,
    character: CharacterRecord
  ): Buffer;
  buildRosterBaselineBody(
    rootSoid: bigint,
    objectSoid: bigint,
    version?: number,
    headerChecksum?: number,
    character?: CharacterRecord | null
  ): Buffer;
  buildSelectCharacterBaselineBody(
    rootSoid: bigint,
    objectSoid: bigint,
    version?: number,
    headerChecksum?: number,
    characters?: readonly CharacterRecord[]
  ): Buffer;
  // The account primary plus, once a character is signed in, its character
  // object and items. `rosterSoids` is every character on the account, for a
  // build whose self primary lists them (BapBuild.selfFamilyHasRoster).
  buildSelfBaselineBody(
    rootSoid: bigint,
    objectSoid: bigint,
    version?: number,
    headerChecksum?: number,
    character?: CharacterRecord | null,
    rosterSoids?: readonly bigint[]
  ): Buffer;
  // A delta: the character object plus the items whose state moved, and a
  // size-0 header for each removed item.
  buildSelfUpdateBody(
    rootSoid: bigint,
    version: number,
    character: CharacterRecord,
    changedItemSoids: readonly bigint[],
    removedItemSoids?: readonly bigint[]
  ): Buffer;
  buildUniverseBaselineBody(
    rootSoid?: bigint,
    objectSoid?: bigint,
    version?: number,
    headerChecksum?: number
  ): Buffer;
}

// The client_to_xetrov_notification messages, as far as the server reads them.
interface XetrovEnvelope extends Message {
  event: Uint8Array;
  reserved1: number;
  reserved2: number;
  reserved3: bigint;
}

interface XetrovPackedEvent extends Message {
  payload: Uint8Array;
  type: number;
}

interface XetrovClientEvent extends Message {
  build: string;
}

// The packed event the envelope carries.
export interface XetrovEventProtos {
  XetrovClientEventSchema: GenMessage<XetrovClientEvent>;
  XetrovEventTypeSchema: DescEnum;
  XetrovPackedEventSchema: GenMessage<XetrovPackedEvent>;
}

interface XetrovEnvelopeProtos {
  ClientToXetrovNotificationSchema: GenMessage<XetrovEnvelope>;
}

// A build whose event layout is not known has the envelope alone: its events
// are logged as bytes and name no build.
type XetrovProtos =
  | XetrovEnvelopeProtos
  | (XetrovEnvelopeProtos & XetrovEventProtos);

// A platform account as account id translation carries it: the account type
// byte the client checks, and the size of one platform id.
export interface PlatformAccount {
  idBytes: number;
  type: number;
}

// What the build-neutral code uses of a build's client schemas. Schemas
// register themselves by id when the build's loader defines them, so they are
// reached through bapBuild(), never imported by neutral code. A build without
// a feature leaves the member out or states it false.
export interface BapBuild {
  baselines: BapBaselines;
  // The schema and content checksums the client checks at login.
  checksums: { CONTENT_CHECKSUM: number; SCHEMA_CHECKSUM: number };
  // The client_config response (cookie, social matchmaking id) as protobuf
  // bytes.
  encodeClientConfigResponse(
    cookie: bigint,
    socialMatchmakingId: number
  ): Uint8Array;
  messages: BapMessages;
  // A new character is signed in as it, and the self family goes back out
  // with it, because the client sends no login_character for it.
  newCharacterSignsIn: boolean;
  // How the client names a platform account in account id translation.
  platformAccount: PlatformAccount;
  // A one-time reward the character earns points toward from kills: the
  // first step of this progression, granted when the total crosses it.
  progressionZero?: { progression: number };
  // The activity index of the new-character prologue mission, if the build
  // has one.
  prologueMissionActivity?: number;
  protos: { xetrov: XetrovProtos };
  // The world-server requests the build handles, by network id.
  routes: ReadonlyMap<number, WorldServerRoute>;
  // Every profile the client uploads (702) is answered with a self delta, so
  // the director redraws its node statuses.
  selfDeltaAfterProfileUpload: boolean;
  // The self primary lists every character on the account.
  selfFamilyHasRoster: boolean;
  // The self character names the activity in progress and its finish, which
  // is how the client chains to the activity's next one.
  selfNamesActivity: boolean;
  // The reply to a request no route handles: the response schema's status-0
  // body, or null for a build that answers with an empty body.
  unhandledReply(networkId: number): Buffer | null;
}
