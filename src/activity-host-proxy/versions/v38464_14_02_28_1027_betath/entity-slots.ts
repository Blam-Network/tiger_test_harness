import { BitReader, BitWriter } from "@blamnetwork/rsat";
import {
  ENTITY_SLOT_BITMAP_BYTES,
  entitySlotBitmap,
  padded,
} from "../../rsat/claims";
import type { EntitySlotsWire } from "../activity-host-build";

// The handoff bodies (from the schema registry): abdicate 808009FE {u8,
// bitmap}; abandon and claim 80800DFB / 80800D26 {u8, bitmap, i8 3 bits bias
// 1}; request-purge 80800C8C {i8 3 bits, bitmap}; purge 80800CE0 {i8 3 bits,
// u8, bitmap}. A claim without the 3-bit member is 3 bits short, and the
// client never asks to purge after one.
// A retail capture (same layout) answers only the abandon: claim {1, its
// bitmap, its 3-bit value + 1} (abandon 3 -> claim 4), and the purge request
// {4, bitmap} with {4, 2, bitmap} (act_cosmo_m0_highway).
// The 3-bit member's true name is unknown.
const SLOT_BITMAP_BITS = ENTITY_SLOT_BITMAP_BYTES * 8;
const SLOT_SMALL_BITS = 3;
// A claim the host puts together itself carries raw 5 (value 4) every time in
// the capture.
const CLAIM_SMALL_RAW = 5;

function copyBits(br: BitReader, bw: BitWriter, bits: number): void {
  for (let i = 0; i < bits; i++) {
    bw.writeBit(br.readBit());
  }
}

export function createEntitySlotsWire(): EntitySlotsWire {
  return {
    advancesEpochOnPurge: true,

    claim(epoch, bitmap) {
      const bw = new BitWriter();
      bw.write(epoch & 0xff, 8);
      copyBits(new BitReader(entitySlotBitmap(bitmap)), bw, SLOT_BITMAP_BITS);
      bw.write(CLAIM_SMALL_RAW, SLOT_SMALL_BITS);
      return bw.finish();
    },

    purge(epoch, request) {
      const br = new BitReader(
        padded(request, SLOT_SMALL_BITS + SLOT_BITMAP_BITS)
      );
      const bw = new BitWriter();
      bw.write(br.readNumber(SLOT_SMALL_BITS), SLOT_SMALL_BITS);
      bw.write(epoch & 0xff, 8);
      copyBits(br, bw, SLOT_BITMAP_BITS);
      return bw.finish();
    },
  };
}
