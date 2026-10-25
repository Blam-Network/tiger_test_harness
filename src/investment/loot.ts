// Investment loot: server-rolled kill drops and the ground loot table the
// self family advertises. Loot records live entirely server-side, keyed by
// character soid; not persisted (a restart clears the ground), so an
// in-memory registry is enough.
import { itemDef } from "../content/items";
import type { CharacterRecord, CharacterStore } from "./character-store";
import type { LoadoutItem, LoadoutSeed } from "./loadout";
import {
  dropChanceForValue,
  LOOT_DROP_CONFIG,
  lootPoolDefs,
} from "./stubs/loot-policy";

// state 3 = "on the ground, spawn a bauble". 5 is the same for the client
// but the server only ever writes 3.
export const LOOT_STATE_GROUND = 3;
export const LOOT_SLOT_COUNT = 64;

export interface LootNonce {
  incidentNumber: number;
  ordinal: number;
  submitterSoid: bigint;
}

export interface LootSlot {
  itemDef: number;
  nonce: LootNonce;
  quantity: number;
  state: number;
}

// One character's 64-slot loot table (8080195F). A slot is undefined when it
// has nothing left to say: never dropped, or a pickup already sent the
// one-shot "index -1" clear. pendingClear tracks slots that owe that one
// clear on the next wire render.
export class LootTable {
  private readonly slots: (LootSlot | undefined)[] = Array.from(
    { length: LOOT_SLOT_COUNT },
    () => undefined
  );
  private readonly pendingClear = new Set<number>();
  // Insertion order, parallel to slots: which slot drop() should evict once
  // every slot is taken (the oldest, rather than leaking "no free slot").
  private readonly writtenAt: number[] = Array.from(
    { length: LOOT_SLOT_COUNT },
    () => 0
  );
  private sequence = 0;

  at(index: number): LootSlot | undefined {
    return this.slots[index];
  }

  // Whether the self character's unknown9 (80801966) needs to be present at
  // all on the next push. False keeps the field absent.
  get hasPendingWire(): boolean {
    return (
      this.slots.some((slot) => slot !== undefined) ||
      this.pendingClear.size > 0
    );
  }

  isPendingClear(index: number): boolean {
    return this.pendingClear.has(index);
  }

  // Consumed by the wire encoder once the clear has been rendered present.
  consumePendingClear(index: number): void {
    this.pendingClear.delete(index);
  }

  // Kill -> drop: first free slot, or - once every slot is taken - the
  // oldest one, evicted rather than refused. Nonce ordinal is per
  // (incidentNumber, submitterSoid) so a kill that drops more than once still
  // gets distinct nonces.
  drop(
    itemDef: number,
    quantity: number,
    incidentNumber: number,
    submitterSoid: bigint
  ): { index: number; slot: LootSlot } {
    let index = this.slots.indexOf(undefined);
    if (index < 0) {
      index = this.writtenAt.indexOf(Math.min(...this.writtenAt));
    }
    const ordinal = this.slots.filter(
      (slot) =>
        slot?.nonce.incidentNumber === incidentNumber &&
        slot?.nonce.submitterSoid === submitterSoid
    ).length;
    const slot: LootSlot = {
      itemDef,
      quantity,
      state: LOOT_STATE_GROUND,
      nonce: { incidentNumber, submitterSoid, ordinal },
    };
    this.slots[index] = slot;
    this.writtenAt[index] = ++this.sequence;
    return { index, slot };
  }

  // 601 lookup: match state and the full nonce.
  findByNonce(
    state: number,
    nonce: LootNonce
  ): { index: number; slot: LootSlot } | undefined {
    const index = this.slots.findIndex(
      (slot) =>
        slot !== undefined &&
        slot.state === state &&
        slot.nonce.incidentNumber === nonce.incidentNumber &&
        slot.nonce.submitterSoid === nonce.submitterSoid &&
        slot.nonce.ordinal === nonce.ordinal
    );
    return index < 0 ? undefined : { index, slot: this.slots[index]! };
  }

  // Pickup: free the slot and arm the one-shot "index -1" clear so the
  // client's bauble collects.
  collect(index: number): void {
    this.slots[index] = undefined;
    this.pendingClear.add(index);
  }
}

const tables = new Map<bigint, LootTable>();

// Get-or-create; both the AH proxy (drops) and the BAP session (pickups)
// share the same table for a character soid.
export function lootTableForCharacter(characterSoid: bigint): LootTable {
  let table = tables.get(characterSoid);
  if (!table) {
    table = new LootTable();
    tables.set(characterSoid, table);
  }
  return table;
}

// 80801A2B status values for the 601 reply: 0 ok, 1 unknown nonce (the
// client only logs a non-zero status).
export const LOOT_STATUS_OK = 0 as const;
export const LOOT_STATUS_UNKNOWN_NONCE = 1 as const;

interface LootDropPlan {
  itemDef: number;
  quantity: number;
}

// `value` is the killed combatant's reward row value; see dropChanceForValue
// for what it does with it.
export function rollLootDrop(
  value: number,
  random: () => number = Math.random
): LootDropPlan | undefined {
  const pool = lootPoolDefs();
  if (pool.length === 0 || random() > dropChanceForValue(value)) {
    return;
  }
  const itemDef = pool[Math.floor(random() * pool.length)]!;
  return { itemDef, quantity: LOOT_DROP_CONFIG.quantity };
}

// Pickup (601): create the instanced item row and add it to the loadout,
// mirroring applyPurchase's insert branch - dropped items are always
// instanced, so there is no stack-merge case.
export async function applyLootPickup(
  store: CharacterStore,
  character: CharacterRecord,
  defIndex: number
): Promise<LoadoutItem> {
  const def = itemDef(defIndex);
  const seed: LoadoutSeed = {
    defIndex,
    bucket: def?.bucket ?? 0,
    equipSlot: null,
    instanced: true,
    quantity: 1,
    artArrangement: def?.artArrangement ?? 0,
    sandboxPattern: def?.sandboxPattern ?? 0,
    // Nothing authors a drop's power; the owned item takes the character's
    // level (itemPower).
    power: 0,
  };
  const item = await store.addItem(character.soid, seed);
  character.loadout.addItem(item);
  return item;
}
