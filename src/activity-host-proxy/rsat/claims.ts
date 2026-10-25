// Slot-ownership bitmaps exchanged at a slice-set swap: the client's
// abdicate (32) / abandon-slots (25) carry {u8 replication domain, 384 x u32
// bitmap} (the live build's abandon adds a 3-bit member); request-purge (26)
// is the bitmap, with a 3-bit member ahead of it in the live build. The host
// answers with claim (23) / purge (24), a build's own layout around the
// bitmap (the build's entitySlots wire), the bitmap echoed bit-exact: an
// offset or all-ones bitmap asserts on live entities.
export const ENTITY_SLOT_BITMAP_BYTES = 384 * 4;

export function entitySlotBitmap(payload: Buffer): Buffer {
  const bitmap =
    payload.length > ENTITY_SLOT_BITMAP_BYTES
      ? payload.subarray(payload.length - ENTITY_SLOT_BITMAP_BYTES)
      : payload;
  const out = Buffer.alloc(ENTITY_SLOT_BITMAP_BYTES);
  bitmap.copy(out, 0, 0, Math.min(bitmap.length, ENTITY_SLOT_BITMAP_BYTES));
  return out;
}

// A body padded with zeros to its schema's length, so a short one reads as
// an empty bitmap rather than failing.
export function padded(body: Buffer, bits: number): Buffer {
  const out = Buffer.alloc(Math.ceil(bits / 8));
  body.copy(out, 0, 0, Math.min(body.length, out.length));
  return out;
}

// The slot bitmap of an abdicate or abandon body: the 1536 bytes after the
// replication domain byte.
export function slotBitmap(body: Buffer): Buffer {
  return entitySlotBitmap(
    padded(body, 8 + ENTITY_SLOT_BITMAP_BYTES * 8).subarray(
      1,
      1 + ENTITY_SLOT_BITMAP_BYTES
    )
  );
}
