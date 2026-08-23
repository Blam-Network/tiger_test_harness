import { decodeServerMessage, encodeServerMessage } from "@blamnetwork/rsat";
import {
  CONTENT_CHECKSUM,
  e_server_message_network_id,
  LOCAL_INVESTMENT_ACCOUNT_SOID,
  SCHEMA_CHECKSUM,
  UNIVERSE_ROOT_SOID,
} from "../constants";
import {
  DirectorEnterOrbitResponse,
  FetchFamilyRequest,
  FetchFamilyResponse,
  LoginAccountResponse,
  ProfileSetCharacterProfileResponse,
} from "../schemas/messages";

export interface ParsedFetchFamilyRequest {
  familyType: number;
  rootSoid: bigint;
}

/**
 * login_account response (type-11). Optional payload echoes the 36B account nest
 * from the type-10 request (padded).
 */
export function buildLoginAccountResponseBodyFromOpts(opts?: {
  accountSoid?: bigint;
  universeSoid?: bigint;
  schemaChecksum?: number;
  contentChecksum?: number;
  /** 36B nest copied from the type-10 request. */
  account36?: Buffer;
}): Buffer {
  const accountSoid = opts?.accountSoid ?? LOCAL_INVESTMENT_ACCOUNT_SOID;
  const universeSoid = opts?.universeSoid ?? UNIVERSE_ROOT_SOID;
  const schemaChecksum = opts?.schemaChecksum ?? SCHEMA_CHECKSUM;
  const contentChecksum = opts?.contentChecksum ?? CONTENT_CHECKSUM;

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
    LoginAccountResponse,
    args,
    optional
  );
}

/** @param reqPlain type-10 plaintext `[u16 type][u32 seq][body]` */
export function buildLoginAccountResponseBody(reqPlain: Buffer): Buffer {
  const reqBody = reqPlain.length > 6 ? reqPlain.subarray(6) : Buffer.alloc(0);
  const account36 = Buffer.alloc(36, 0);
  if (reqBody.length >= 2 + 36) {
    reqBody.subarray(2, 2 + 36).copy(account36);
  }
  return buildLoginAccountResponseBodyFromOpts({ account36 });
}

export function buildFetchFamilyResponseBody(
  status = 0,
  optional: Buffer | null = null
): Buffer {
  return encodeServerMessage(
    e_server_message_network_id._server_message_network_id_fetch_family,
    FetchFamilyResponse,
    { unknown0: status },
    optional
  );
}

export function buildDirectorEnterOrbitResponseBody(): Buffer {
  return encodeServerMessage(
    e_server_message_network_id._server_message_network_id_director_enter_orbit,
    DirectorEnterOrbitResponse,
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

export function buildProfileSetCharacterProfileResponseBody(): Buffer {
  return encodeServerMessage(
    e_server_message_network_id._server_message_network_id_profile_set_character_profile,
    ProfileSetCharacterProfileResponse,
    {
      unknown0: { unknown0: 0, unknown1: 0 },
    }
  );
}

/** Parse fetch_family request from type-10 plaintext. */
export function parseFetchFamilyRequest(
  type10Plain: Buffer
): ParsedFetchFamilyRequest | null {
  if (type10Plain.length < 8) {
    return null;
  }
  const body = type10Plain.subarray(6);
  if (
    body.readUInt16BE(0) !==
    e_server_message_network_id._server_message_network_id_fetch_family
  ) {
    return null;
  }

  try {
    const { networkId, value } = decodeServerMessage(body, FetchFamilyRequest);
    if (
      networkId !==
      e_server_message_network_id._server_message_network_id_fetch_family
    ) {
      return null;
    }
    return { familyType: value.familyType, rootSoid: value.familyRootSoid };
  } catch {
    return null;
  }
}
