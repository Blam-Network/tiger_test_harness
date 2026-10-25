// A character's items: what is equipped in which slot and what sits in the
// bag. Equip / unequip requests mutate it and the self / peer families are
// rebuilt from it.

import { equipSlotIds, equipSlotToBucket } from "../content/inventory";
import { itemDef, itemName } from "../content/items";
import { newCharacterDefaults } from "../content/new-character";
import { contentBuild } from "../content/versions";
import { serverPicks } from "./stubs/starter-kit";
import { starterCurrencies } from "./stubs/starting-currency";

export type StatPair = readonly [number, number];

export interface LoadoutItem {
  artArrangement: number;
  bucket: number;
  defIndex: number;
  // Equip slot while equipped, null in the bag.
  equipSlot: number | null;
  // False for currency / material stacks (vendor purchase entries with
  // inst=0): they never get an 80801A25 item object and never equip; their
  // bag entry carries quantity instead.
  instanced: boolean;
  // Instance level and quality (80801711 +0x18 / +0x20), the inputs of
  // the primary stat the client shows (primary-stat.ts). Absent or 0 = the
  // def's own level block.
  level?: number;
  // Authored power level (the vendor purchase's power), sent verbatim as the
  // item's 808018F2 key-0 stat slot. The client displays power = 10 + 10 * this,
  // so 0 (starter kit, sale credit) shows the curve floor, 10.
  power: number;
  quality?: number;
  // Stack size. Always 1 for instanced items.
  quantity: number;
  sandboxPattern: number;
  soid: bigint;
  // Investment stat block mirrored into 808019CF for weapons.
  stats: readonly StatPair[];
  // 80801BF3: activated-step count per talent grid node (0 = untouched),
  // TALENT_NODE_COUNT entries.
  talentNodes: readonly number[];
  // The item's own progression row XP (griddef+12), the talent tree's level
  // source - not the character's own XP.
  talentXp: number;
}

// 80801BF3 width: 50 u8, one activated-step count per grid node.
export const TALENT_NODE_COUNT = 50;

export function emptyTalentNodes(): number[] {
  return new Array(TALENT_NODE_COUNT).fill(0);
}

// The slot an item equips into: its def's equip slot, else the slot its
// bucket feeds (an item outside the table).
function equipSlotFor(defIndex: number, bucket: number): number | null {
  const def = itemDef(defIndex);
  if (def) {
    return def.equipSlot;
  }
  const slot = equipSlotToBucket().indexOf(bucket);
  return slot < 0 ? null : slot;
}

export type LoadoutSeed = Omit<
  LoadoutItem,
  "soid" | "stats" | "talentNodes" | "talentXp"
>;

// The weapon stat block mirrored into the gear block: the def's own.
export function weaponStatsFor(defIndex: number): readonly StatPair[] {
  return itemDef(defIndex)?.weaponStats ?? [];
}

interface StarterItemDef {
  artArrangement: number;
  bucket: number;
  defIndex: number;
  label: string;
  sandboxPattern: number;
  // Equip slot, null for a bag item.
  slot: number | null;
}

// The class an unknown class index gets the starting kit of: the warlock,
// the stub character's class.
const FALLBACK_CLASS_INDEX = 2;

function classDefaults(classIndex: number) {
  return (
    newCharacterDefaults(classIndex) ??
    newCharacterDefaults(FALLBACK_CLASS_INDEX)!
  );
}

// The subclass a class starts with, by wire class index. An unknown class
// gets the warlock's, like starterKit.
export function starterSubclassDef(classIndex: number): number {
  return classDefaults(classIndex).subclass;
}

// The armour slots' nouns in a kit entry's label.
function armourNouns(): Readonly<Record<number, string>> {
  const slots = equipSlotIds();
  return {
    [slots.helmet]: "helmet",
    [slots.gauntlets]: "gauntlets",
    [slots.chest]: "chest armor",
    [slots.legs]: "leg armor",
  };
}

interface KitEntry {
  defIndex: number;
  label: string;
  // Equip slot, null for a bag item.
  slot: number | null;
}

// The class's new-character gear and the server's picks. A class emblem the
// lists name is equipped unless the build picks an emblem, which then stays
// equipped and sends the lists' one to the bag; a build whose lists name none
// equips its class's starter emblem. No shader: none of the lists grants one
// and an empty shader slot is the default look.
function kitEntries(classIndex: number): KitEntry[] {
  const { items, subclass } = classDefaults(classIndex);
  const emblemSlot = equipSlotIds().emblem;
  const picksEmblem =
    emblemSlot in serverPicks() ||
    contentBuild().ids.starterEmblem?.[classIndex] !== undefined;
  const entries: KitEntry[] = [
    {
      slot: equipSlotIds().subclass,
      defIndex: subclass,
      label: itemName(subclass),
    },
  ];
  for (const [slot, defIndex] of Object.entries(items)) {
    const name = itemName(defIndex);
    entries.push(
      Number(slot) === emblemSlot && picksEmblem
        ? { slot: null, defIndex, label: `${name} (emblem)` }
        : {
            slot: Number(slot),
            defIndex,
            label: [name, armourNouns()[Number(slot)]]
              .filter(Boolean)
              .join(" "),
          }
    );
  }
  for (const [slot, defIndex] of Object.entries(serverPicks())) {
    entries.push({ slot: Number(slot), defIndex, label: itemName(defIndex) });
  }
  const emblem = contentBuild().ids.starterEmblem?.[classIndex];
  if (emblem !== undefined) {
    entries.push({
      slot: equipSlotIds().emblem,
      defIndex: emblem,
      label: `${itemName(emblem)} (emblem)`,
    });
  }
  return entries;
}

// Equipped first (by slot), then the bag items. An unknown class gets the
// warlock kit, the stub character's class.
export function starterKit(classIndex: number): StarterItemDef[] {
  const kit = kitEntries(classIndex).map((entry) => {
    const def = itemDef(entry.defIndex)!;
    return {
      ...entry,
      bucket: def.bucket,
      sandboxPattern: def.sandboxPattern,
      artArrangement: def.artArrangement,
    };
  });
  return [
    ...kit
      .filter((item) => item.slot !== null)
      .sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0)),
    ...kit.filter((item) => item.slot === null),
  ];
}

const ITEM_SOID_BASE = 0x0000000300000001n;

function itemSoidForSlot(slot: number): bigint {
  return ITEM_SOID_BASE + BigInt(slot);
}

// Bag item soids follow the equipped block (slots 0..0x13).
const BAG_ITEM_SOID_BASE = ITEM_SOID_BASE + 0x20n;

function itemSoidForBagItem(index: number): bigint {
  return BAG_ITEM_SOID_BASE + BigInt(index);
}

// The starting kit a new character of this wire class index gets: the
// class's equipped set, its bag items, then starting currency.
export function starterItems(classIndex: number): LoadoutSeed[] {
  return [
    ...starterKit(classIndex).map((g) => ({
      defIndex: g.defIndex,
      bucket: g.bucket,
      sandboxPattern: g.sandboxPattern,
      artArrangement: g.artArrangement,
      equipSlot: g.slot,
      instanced: true,
      quantity: 1,
      // No vendor sells the starter kit's own defs, so there is no authored
      // power for them; 0 shows the curve floor, 10.
      power: 0,
    })),
    ...starterCurrencies().map((c) => ({
      defIndex: c.defIndex,
      bucket: 0,
      sandboxPattern: 0,
      artArrangement: 0,
      equipSlot: null,
      instanced: false,
      quantity: c.quantity,
      power: 0,
    })),
  ];
}

interface EquipChange {
  displaced: LoadoutItem | null;
  equipped: LoadoutItem;
}

export class CharacterLoadout {
  readonly items: LoadoutItem[] = [];

  static fromItems(
    items: readonly (LoadoutSeed & {
      soid: bigint;
      talentNodes?: readonly number[];
      talentXp?: number;
    })[]
  ): CharacterLoadout {
    const loadout = new CharacterLoadout();
    for (const item of items) {
      loadout.items.push({
        ...item,
        stats: weaponStatsFor(item.defIndex),
        talentNodes: item.talentNodes ?? emptyTalentNodes(),
        talentXp: item.talentXp ?? 0,
      });
    }
    return loadout;
  }

  // Starter kit with the fixed stub soids (no database). Warlock by default,
  // the stub character's class.
  static stub(classIndex = 2): CharacterLoadout {
    let bagIndex = 0;
    return CharacterLoadout.fromItems(
      starterItems(classIndex).map((seed) => ({
        ...seed,
        soid:
          seed.equipSlot === null
            ? itemSoidForBagItem(bagIndex++)
            : itemSoidForSlot(seed.equipSlot),
      }))
    );
  }

  item(soid: bigint): LoadoutItem | undefined {
    return this.items.find((i) => i.soid === soid);
  }

  equipped(slot: number): LoadoutItem | undefined {
    return this.items.find((i) => i.equipSlot === slot);
  }

  // inventory_equip_item (403): the slot follows the item's def; the item it
  // displaces goes back to the bag.
  equip(soid: bigint): EquipChange | null {
    const item = this.item(soid);
    const slot = item ? equipSlotFor(item.defIndex, item.bucket) : null;
    if (!item?.instanced || slot === null) {
      return null;
    }
    const current = this.equipped(slot);
    let displaced: LoadoutItem | null = null;
    if (current && current !== item) {
      current.equipSlot = null;
      displaced = current;
    }
    item.equipSlot = slot;
    return { equipped: item, displaced };
  }

  // inventory_unequip_item (404).
  unequip(soid: bigint): LoadoutItem | null {
    const item = this.item(soid);
    if (!item || item.equipSlot === null) {
      return null;
    }
    item.equipSlot = null;
    return item;
  }

  weaponStats(slot: number): readonly StatPair[] {
    return this.equipped(slot)?.stats ?? [];
  }

  // talent_grid_activate_step / talent_grid_binary_swap (801/802): set one
  // node's activated-step count in place. Returns the item so the caller can
  // persist it, or null if the soid or node don't resolve.
  setTalentNode(soid: bigint, node: number, value: number): LoadoutItem | null {
    const item = this.item(soid);
    if (!item || node < 0 || node >= TALENT_NODE_COUNT) {
      return null;
    }
    const nodes = item.talentNodes.slice();
    nodes[node] = value;
    item.talentNodes = nodes;
    return item;
  }

  // Vendor purchase / sale: insert a new row the store minted, or drop one
  // entirely.
  addItem(item: LoadoutItem): void {
    this.items.push(item);
  }

  removeItem(soid: bigint): void {
    const index = this.items.findIndex((i) => i.soid === soid);
    if (index >= 0) {
      this.items.splice(index, 1);
    }
  }

  // The one stack of a def in a bucket (currency and material stacks never
  // split).
  stackAt(defIndex: number, bucket: number): LoadoutItem | undefined {
    return this.items.find(
      (i) => !i.instanced && i.defIndex === defIndex && i.bucket === bucket
    );
  }

  // A stack by def alone, for 903 sells that only give the def index
  // (ItemReference.hasInstance false).
  stackByDef(defIndex: number): LoadoutItem | undefined {
    return this.items.find((i) => !i.instanced && i.defIndex === defIndex);
  }

  // How many bag rows a bucket already holds, against
  // bucketSlotCounts for vendor purchase room checks.
  bucketCount(bucket: number): number {
    return this.items.filter((i) => i.bucket === bucket).length;
  }

  get primary(): LoadoutItem | undefined {
    return this.equipped(equipSlotIds().primary);
  }

  get special(): LoadoutItem | undefined {
    return this.equipped(equipSlotIds().special);
  }

  get heavy(): LoadoutItem | undefined {
    return this.equipped(equipSlotIds().heavy);
  }
}
