// Live sensor row state the script host drives: the activity flags the
// scripts hold, and the row key the session indexes rows by.
type RowKey = string;

export function rowKey(
  bundle: number,
  typeId: number,
  typeIndex: number
): RowKey {
  return `${bundle >>> 0}:${typeId}:${typeIndex}`;
}

export class SensorRowState {
  // FNV-1 hashes of the activity flags the local player holds. A script's
  // `_activity_flag:activate()` puts one here.
  private readonly activityFlags = new Set<number>();

  // Returns true when the set actually changed.
  setActivityFlag(hash: number, active: boolean): boolean {
    const key = hash >>> 0;
    if (active === this.activityFlags.has(key)) {
      return false;
    }
    if (active) {
      this.activityFlags.add(key);
    } else {
      this.activityFlags.delete(key);
    }
    return true;
  }

  get playerActivityFlags(): readonly number[] {
    return [...this.activityFlags];
  }
}
