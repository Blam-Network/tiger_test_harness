import { ENTITY_SLOT_BITMAP_BYTES, entitySlotBitmap } from "../../rsat/claims";
import type { EntitySlotsWire } from "../activity-host-build";

// Claim (23, 808044F8) and purge (24, 808044FA) are {u8 epoch, 384 x u32
// bitmap}, 1537 bytes. The guest stores the epoch byte as its replication
// epoch whichever one it is, and the replication domains follow it, so a
// purge goes out under the epoch of the claim before it. The request-purge
// (26, 808044F9) is the bare bitmap.
function withEpoch(epoch: number, bitmap: Buffer): Buffer {
  const body = Buffer.alloc(1 + ENTITY_SLOT_BITMAP_BYTES);
  body.writeUInt8(epoch & 0xff, 0);
  entitySlotBitmap(bitmap).copy(body, 1);
  return body;
}

export function createEntitySlotsWire(): EntitySlotsWire {
  return {
    advancesEpochOnPurge: false,
    claim: withEpoch,
    purge: withEpoch,
  };
}
