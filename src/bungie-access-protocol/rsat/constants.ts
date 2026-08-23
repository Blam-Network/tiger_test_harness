export { e_server_message_network_id } from "./server-message";

export const EMPTY_STRING_HASH = 0x811c9dc5;

// Stub SOIDs until we mint real ones.
export const LOCAL_INVESTMENT_ACCOUNT_SOID = 0x0000000100000001n;
export const SIGNED_IN_CHARACTER_SOID = 0x0000000200000002n;
export const UNIVERSE_ROOT_SOID = 0x7fffffffffffffffn;

// investment_globals tag (+0x208 / +0x20C); client rejects mismatches.
export const SCHEMA_CHECKSUM = 0x413b9657;
export const CONTENT_CHECKSUM = 0x7e9908f6;

// TypeDef descriptor +4 checksums (queuez object headers).
export const SELECT_CHARACTER_CHECKSUM_PRIMARY = 0x0aa5f881;
export const SELECT_CHARACTER_CHECKSUM_CHARACTER = 0x3412a58d;
export const PEER_CHECKSUM_PRIMARY = 0x17edea80;
export const PEER_CHECKSUM_CHARACTER = 0x5f9decd9;
export const INSPECTION_CHECKSUM_PRIMARY = 0xe56d2ea1;
export const INSPECTION_CHECKSUM_CHARACTER = 0x74d6d27c;
export const ROSTER_CHECKSUM_PRIMARY = 0xf354c32a;
export const UNIVERSE_CHECKSUM = 0x7e4e624e;
export const SELF_CHECKSUM_PRIMARY = 0xa9f02ea4;
export const SELF_CHECKSUM_INVENTORY = 0xd78a7055;
export const SELF_CHECKSUM_ITEM = 0x24390bf3;
