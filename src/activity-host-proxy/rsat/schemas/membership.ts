import { rsat } from "@blamnetwork/rsat";
import { JoinIdentity } from "../../join";

export const MEMBERSHIP_SLOT_COUNT = 20;

/**
 * 808044DB one of 20 slots
 */
export const MembershipSlot = rsat.schema(0x808044db, {
  identity: rsat.optional(rsat.nested(JoinIdentity)),
  auth: rsat.optional(rsat.bool()),
});

/** 80804AA3 20 nested slots. */
export const MembershipSlots = rsat.schema(0x80804aa3, {
  slots: rsat.repeat(rsat.nested(MembershipSlot), MEMBERSHIP_SLOT_COUNT),
});

/**
 * 808044E0 replicate membership
 */
export const ReplicateMembership = rsat.schema(0x808044e0, {
  generation: rsat.u32(),
  unk: rsat.u32(),
  clients: rsat.nested(MembershipSlots),
  pahRegions: rsat.optional(rsat.bool()),
  occupiedMask: rsat.optional(rsat.u32({ size: 20 })),
  machineMask: rsat.optional(rsat.u32({ size: 20 })),
  unkMask: rsat.optional(rsat.u32({ size: 20 })),
  replicateMask: rsat.optional(rsat.u32({ size: 20 })),
});
