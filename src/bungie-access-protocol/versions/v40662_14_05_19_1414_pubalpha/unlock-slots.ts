// Unlock flag recipe. The flags to set are this build's picks
// (unlock-policy.ts); the slot that sets each comes from the investment
// globals' slot table (rows {u32 name hash, i16 flag}). A slot value of 2 sets
// the flag; 0/1 clear it. Only rows that exist are applied (account 867, offer
// 132, character 482), later slots are ignored by the client.
import { flagSlot, type UnlockScope } from "../../../content/unlock-flags";
import * as unlockPolicy from "./unlock-policy";

// Account offers (self primary member 8, storage type 3): 256 slots.
const OFFER_SLOT_COUNT = 256;
// Account (self primary member 7, storage type 4).
const ACCOUNT_SLOT_COUNT = 1024;
// Character (self character member 10, storage type 5).
const CHARACTER_SLOT_COUNT = 1024;

// The client's cap on the universe list.
export const UNIVERSE_FLAG_CAP = 20;

// The slots that set these flags in a scope. A flag the scope has no slot for
// is a policy mistake.
function slotsFor(scope: UnlockScope, flags: readonly number[]): number[] {
  return flags.map((flag) => {
    const slot = flagSlot(scope, flag);
    if (slot === undefined) {
      throw new Error(`no ${scope} slot sets unlock flag ${flag}`);
    }
    return slot;
  });
}

// Account offer slots for the flags the account owns (self primary member 8).
export function offerSlotValues(): number[] {
  const slots = new Array<number>(OFFER_SLOT_COUNT).fill(0);
  for (const slot of slotsFor("offer", unlockPolicy.VENDOR_OFFER_FLAGS)) {
    slots[slot] = 2;
  }
  return slots;
}

// Account / character slot arrays (1024 x int2): 2 at the unlocked slots,
// absent elsewhere so the client keeps its default.
function flagSlotValues(
  count: number,
  setSlots: readonly number[]
): (number | undefined)[] {
  const slots = new Array<number | undefined>(count).fill(undefined);
  for (const slot of setSlots) {
    slots[slot] = 2;
  }
  return slots;
}

// Recommended on top of the unlocked account flags: the subclass equip and
// progression gates and the progression rows' account flags.
export function recommendedAccountSlots(): number[] {
  const { SUBCLASS_ACCOUNT_FLAGS, PROGRESSION_ACCOUNT_FLAGS } = unlockPolicy;
  return slotsFor("account", [
    ...SUBCLASS_ACCOUNT_FLAGS,
    ...PROGRESSION_ACCOUNT_FLAGS,
  ]);
}

export function accountSlotValues(): (number | undefined)[] {
  return flagSlotValues(
    ACCOUNT_SLOT_COUNT,
    slotsFor("account", unlockPolicy.UNLOCKED_ACCOUNT_FLAGS)
  );
}

export function characterSlotValues(
  prologuePending: boolean
): (number | undefined)[] {
  const { UNLOCKED_CHARACTER_FLAGS, PROLOGUE_CHARACTER_FLAG } = unlockPolicy;
  return flagSlotValues(
    CHARACTER_SLOT_COUNT,
    slotsFor("character", [
      ...UNLOCKED_CHARACTER_FLAGS,
      ...(prologuePending ? [PROLOGUE_CHARACTER_FLAG] : []),
    ])
  );
}
