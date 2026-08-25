import * as crypto from "node:crypto";

/**
 * One activity host (FAH or GAH)
 */
export const ENTITY_INDEX_MASK_BYTES = 1536;
const ENTITY_INDEX_SLOT_COUNT = ENTITY_INDEX_MASK_BYTES * 8;
const ALLOCATE_ENTITY_INDEX_MAX = 2048;
const ALLOCATE_ENTITY_INDEX_DEFAULT = 64;

/** Non-zero u64. Client rejects id 0 as `invalid activity host id`. */
export function randomActivityHostId(): bigint {
  let id = 0n;
  while (id === 0n) {
    id = crypto.randomBytes(8).readBigUInt64BE(0);
  }
  return id;
}

export class ActivityHostService {
  readonly id: bigint;
  private entityIndexGranted = false;
  private entityIndexFreeMask: Buffer | undefined;

  constructor(id: bigint = randomActivityHostId()) {
    if (id === 0n) {
      throw new Error("activity host id must be non-zero");
    }
    this.id = id;
  }

  takeFirstEntityIndexGrant(): Buffer | null {
    if (this.entityIndexGranted) {
      return null;
    }
    this.entityIndexGranted = true;
    return Buffer.alloc(ENTITY_INDEX_MASK_BYTES, 0xff);
  }

  noteEntityIndicesFreed(mask: Buffer): void {
    if (mask.length < ENTITY_INDEX_MASK_BYTES) {
      return;
    }
    this.entityIndexFreeMask = Buffer.from(
      mask.subarray(0, ENTITY_INDEX_MASK_BYTES)
    );
  }

  /**
   * AllocateEntityIndices (class 19) answer. Guest 8360FE10 rejects count
   * outside 0..2048; 0 would send an empty mask and trap in 83604A80.
   * Grant bits the client previously freed (high indices first, matching
   * 8284A830). Fall back to high unused slots if the free pool is empty.
   */
  takeAllocateEntityIndexGrant(count: number): {
    grant: Buffer;
    granted: number;
    source: string;
  } {
    let want = count;
    if (!Number.isFinite(want) || want <= 0) {
      want = ALLOCATE_ENTITY_INDEX_DEFAULT;
    }
    if (want > ALLOCATE_ENTITY_INDEX_MAX) {
      want = ALLOCATE_ENTITY_INDEX_MAX;
    }

    const pool = this.entityIndexFreeMask;
    let grant: Buffer;
    let granted: number;
    let source: string;
    if (pool && pool.length === ENTITY_INDEX_MASK_BYTES) {
      ({ grant, granted } = takeEntityIndexGrantFromFreePool(pool, want));
      source = "free-pool";
    } else {
      grant = Buffer.alloc(ENTITY_INDEX_MASK_BYTES, 0);
      granted = 0;
      source = "high-fallback";
    }
    if (granted <= 0) {
      grant = Buffer.alloc(ENTITY_INDEX_MASK_BYTES, 0);
      granted = 0;
      for (let i = ENTITY_INDEX_SLOT_COUNT - 1; i >= 0 && granted < want; --i) {
        entityIndexBitSet(grant, i, true);
        granted += 1;
      }
      source = `${source}+high-fallback`;
    }
    return { grant, granted, source };
  }
}

/**
 * Xbox BE u32 bitset: word MSB = high index in the word (see 8284A830 cntlzw).
 * Bit `i` → word `i>>5`, value bit `i&31` (LSB = low index).
 */
function entityIndexBitGet(mask: Buffer, bit: number): boolean {
  if (bit < 0 || bit >= ENTITY_INDEX_SLOT_COUNT) {
    return false;
  }
  const word = mask.readUInt32BE((bit >> 5) * 4);
  return ((word >>> (bit & 31)) & 1) !== 0;
}

function entityIndexBitSet(mask: Buffer, bit: number, on: boolean): void {
  if (bit < 0 || bit >= ENTITY_INDEX_SLOT_COUNT) {
    return;
  }
  const off = (bit >> 5) * 4;
  let word = mask.readUInt32BE(off);
  const b = bit & 31;
  word = on ? word | (1 << b) : word & ~(1 << b);
  mask.writeUInt32BE(word >>> 0, off);
}

function takeEntityIndexGrantFromFreePool(
  freePool: Buffer,
  count: number
): { grant: Buffer; granted: number } {
  const grant = Buffer.alloc(ENTITY_INDEX_MASK_BYTES, 0);
  let granted = 0;
  const want = Math.max(0, Math.min(count | 0, ENTITY_INDEX_SLOT_COUNT));
  for (let i = ENTITY_INDEX_SLOT_COUNT - 1; i >= 0 && granted < want; --i) {
    if (!entityIndexBitGet(freePool, i)) {
      continue;
    }
    entityIndexBitSet(grant, i, true);
    entityIndexBitSet(freePool, i, false);
    granted += 1;
  }
  return { grant, granted };
}
