// The checksums the client's login check holds the server to: the
// investment globals tag states them at +0x208 / +0x20C and the client
// rejects a mismatch.
export const SCHEMA_CHECKSUM = 0x41_3b_96_57;
export const CONTENT_CHECKSUM = 0x7e_99_08_f6;

// The queuez object headers' checksums: +4 of each type's descriptor.
export const SELECT_CHARACTER_CHECKSUM_PRIMARY = 0x0a_a5_f8_81;
export const SELECT_CHARACTER_CHECKSUM_CHARACTER = 0x34_12_a5_8d;
export const PEER_CHECKSUM_PRIMARY = 0x17_ed_ea_80;
export const PEER_CHECKSUM_CHARACTER = 0x5f_9d_ec_d9;
export const INSPECTION_CHECKSUM_PRIMARY = 0xe5_6d_2e_a1;
export const INSPECTION_CHECKSUM_CHARACTER = 0x74_d6_d2_7c;
export const ROSTER_CHECKSUM_PRIMARY = 0xf3_54_c3_2a;
export const UNIVERSE_CHECKSUM = 0x7e_4e_62_4e;
export const SELF_CHECKSUM_PRIMARY = 0xa9_f0_2e_a4;
export const SELF_CHECKSUM_INVENTORY = 0xd7_8a_70_55;
export const SELF_CHECKSUM_ITEM = 0x24_39_0b_f3;
