// The unlock flags' tables, read off the disc packages on first use: which
// flag each wire slot sets, where a flag comes from, when the time table
// flips it, and which flags the records (achievements, grimoire cards) read.
// The flags are numbered, not named: their name hashes aren't cracked.
import type {
  UnlockFlagSource,
  UnlockScope,
  UnlockTime,
} from "./model/investment";
import { contentBuild } from "./versions";

export type {
  UnlockFlagSource,
  UnlockScope,
  UnlockTime,
} from "./model/investment";

const SCOPES: readonly UnlockScope[] = ["account", "offer", "character"];

interface UnlockSlots {
  flagOfSlot: Readonly<Record<UnlockScope, readonly number[]>>;
  slotOfFlag: Readonly<Record<UnlockScope, ReadonlyMap<number, number>>>;
  sources: readonly UnlockFlagSource[];
  times: ReadonlyMap<number, readonly UnlockTime[]>;
}

let tables: UnlockSlots | undefined;
let records: readonly number[] | undefined;

function readTables(): UnlockSlots {
  const {
    flagOfSlot,
    sources,
    times: rows,
  } = contentBuild().readers.unlockTables();
  const slotOfFlag = {} as Record<UnlockScope, Map<number, number>>;
  for (const scope of SCOPES) {
    slotOfFlag[scope] = new Map();
    flagOfSlot[scope].forEach((flag, slot) => {
      if (flag >= 0) {
        slotOfFlag[scope].set(flag, slot);
      }
    });
  }
  const times = new Map<number, UnlockTime[]>();
  for (const row of rows) {
    const list = times.get(row.flag) ?? [];
    list.push({ time: row.time, value: row.value });
    times.set(row.flag, list);
  }
  return { flagOfSlot, slotOfFlag, sources, times };
}

function unlockTables(): UnlockSlots {
  tables ??= readTables();
  return tables;
}

// The flag a slot sets when its value is the build's unlockFlagSet, undefined
// past the table or for a slot with no flag.
export function slotFlag(scope: UnlockScope, slot: number): number | undefined {
  const flag = unlockTables().flagOfSlot[scope][slot];
  return flag === undefined || flag < 0 ? undefined : flag;
}

// The slot that sets a flag, undefined when the scope has none.
export function flagSlot(scope: UnlockScope, flag: number): number | undefined {
  return unlockTables().slotOfFlag[scope].get(flag);
}

// How many slots a scope's table has; the client ignores later ones.
export function unlockSlotCount(scope: UnlockScope): number {
  return unlockTables().flagOfSlot[scope].length;
}

// Where a flag comes from, undefined past the flag table.
export function flagSource(flag: number): UnlockFlagSource | undefined {
  return unlockTables().sources[flag];
}

export function flagCount(): number {
  return unlockTables().sources.length;
}

// The flags the time table flips, with each one's times in table order.
export function timedFlags(): ReadonlyMap<number, readonly UnlockTime[]> {
  return unlockTables().times;
}

// When the time table first sets a flag, undefined for one it never sets.
export function flagSetTime(flag: number): bigint | undefined {
  return timedFlags()
    .get(flag)
    ?.find((entry) => entry.value === contentBuild().ids.unlockFlagSet)?.time;
}

// The flag each record row (achievements first, then grimoire cards) reads,
// by record index.
export function recordFlags(): readonly number[] {
  records ??= contentBuild().readers.recordFlags();
  return records;
}
