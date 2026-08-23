/**
 * One activity host (FAH or GAH). Owns per-AH state such as the class-0
 * entity-index grant — a second full mask to the same AH asserts.
 *
 * Class 0 / 808044F4 → 80800E39: 384×u32. Dirty_en=0 and p1=32, so the
 * wire is 1536 bytes as-is. sub_83604A80 asserts nonempty — all-zero
 * guest-breaks. First grant is the full pool (0xff); later grants are deltas.
 */
export class ActivityHostService {
  private entityIndexGranted = false;

  constructor(readonly id: bigint) {}

  takeFirstEntityIndexGrant(): Buffer | null {
    if (this.entityIndexGranted) {
      return null;
    }
    this.entityIndexGranted = true;
    return Buffer.alloc(1536, 0xff);
  }
}
