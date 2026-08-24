import { rsat } from "@blamnetwork/rsat";
import { JoinIdentity } from "../../join";

export const MEMBERSHIP_SLOT_COUNT = 20;
export const PAH_REGION_COUNT = 40;
export const PAH_PEER_SLOT_COUNT = 20;

const SessionId8 = rsat.schema(0x80800e31, {
  bytes: rsat.bytes(8),
});

const AdvertisedPad = rsat.schema(0x80800e38, {
  bytes: rsat.bytes(36),
});

const ActivityHost16 = rsat.schema(0x8080024a, {
  bytes: rsat.bytes(16),
});

/** 808044B3 — advertised session / AH. Leave zero until a real public host. */
const PahAdvertised = rsat.schema(0x808044b3, {
  session: rsat.nested(SessionId8),
  pad: rsat.nested(AdvertisedPad),
  activityHost: rsat.nested(ActivityHost16),
});

/** 80804AA0 — per-slot peer markers; local slot 0 holds the transition token. */
const PahPeerSlots = rsat.schema(0x80804aa0, {
  markers: rsat.bytes(PAH_PEER_SLOT_COUNT),
});

const PahAmbassador = rsat.schema(0x808044c1, {
  revokeToken: rsat.u8(),
  opcode: rsat.u8({ size: 2, bias: 1 }),
  slot: rsat.u8({ size: 5, bias: 1 }),
  flag: rsat.bool(),
});

const PahPublic = rsat.schema(0x808044c4, {
  unk0: rsat.u8(),
  sessionLock: rsat.u32({ size: 20 }),
  peerSlots: rsat.nested(PahPeerSlots),
  advertised: rsat.nested(PahAdvertised),
  activityHostId: rsat.u64(),
});

/** 808044C5 — one tabulated region row. */
export const PahRegion = rsat.schema(0x808044c5, {
  regionId: rsat.i32(),
  unk1: rsat.u8({ size: 2, bias: 1 }),
  ambassador: rsat.nested(PahAmbassador),
  peerMask: rsat.u32({ size: 20 }),
  public: rsat.nested(PahPublic),
});

const PahRegionTable = rsat.schema(0x80804aa2, {
  rows: rsat.repeat(rsat.nested(PahRegion), PAH_REGION_COUNT),
});

const Unknown808044CB = rsat.schema(0x808044cb, {
  a: rsat.u8(),
  b: rsat.u8(),
  c: rsat.u8({ size: 3, bias: 1 }),
});

const Unknown808044CC = rsat.schema(0x808044cc, {
  a: rsat.u8(),
  b: rsat.i32(),
  c: rsat.u32(),
  d: rsat.u32({ size: 20 }),
});

const Unknown808044D2 = rsat.schema(0x808044d2, {
  a: rsat.u8({ size: 2, bias: 1 }),
  left: rsat.nested(Unknown808044CC),
  right: rsat.nested(Unknown808044CC),
});

/** 808044DD — region table + two unknown nests. */
export const PahRegions = rsat.schema(0x808044dd, {
  table: rsat.nested(PahRegionTable),
  unknown0: rsat.nested(Unknown808044CB),
  unknown1: rsat.nested(Unknown808044D2),
});

export const MembershipSlot = rsat.schema(0x808044db, {
  identity: rsat.optional(rsat.nested(JoinIdentity)),
  auth: rsat.optional(rsat.bool()),
});

export const MembershipSlots = rsat.schema(0x80804aa3, {
  slots: rsat.repeat(rsat.nested(MembershipSlot), MEMBERSHIP_SLOT_COUNT),
});

export const ReplicateMembership = rsat.schema(0x808044e0, {
  generation: rsat.u32(),
  unk: rsat.u32(),
  clients: rsat.nested(MembershipSlots),
  pahRegions: rsat.optional(rsat.nested(PahRegions)),
  occupiedMask: rsat.optional(rsat.u32({ size: 20 })),
  machineMask: rsat.optional(rsat.u32({ size: 20 })),
  unkMask: rsat.optional(rsat.u32({ size: 20 })),
  replicateMask: rsat.optional(rsat.u32({ size: 20 })),
});
