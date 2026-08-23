// This file is a mess. I haven't dug into character data very much.
// Please rewrite this all lol
// - codie

// Not confirmed. Once known, move into an enum.
export const EQUIP_SLOT_ABILITY = 1;
export const EQUIP_SLOT_HELMET = 2;
export const EQUIP_SLOT_GAUNTLETS = 3;
export const EQUIP_SLOT_CHEST = 4;
export const EQUIP_SLOT_LEGS = 5;
export const EQUIP_SLOT_CLASS_ITEM = 6;
export const EQUIP_SLOT_PRIMARY = 7;
export const EQUIP_SLOT_SPECIAL = 8;
export const EQUIP_SLOT_HEAVY = 9;
export const EQUIP_SLOT_SHIP = 10;
export const EQUIP_SLOT_GHOST = 11;
export const EQUIP_SLOT_VEHICLE = 12;
export const EQUIP_SLOT_VEHICLE_UI = 13;

export const ITEM_SOID_BASE = 0x0000000300000001n;

export function itemSoidForSlot(slot: number): bigint {
  return ITEM_SOID_BASE + BigInt(slot);
}

export const STUB_ITEM_DEFS: {
  slot: number;
  bucket: number;
  defIndex: number;
  artArrangement: number;
  sandboxPattern: number;
  label: string;
}[] = [
  {
    slot: EQUIP_SLOT_ABILITY,
    bucket: 7,
    defIndex: 434,
    artArrangement: 415,
    sandboxPattern: 12,
    label: "ability",
  },
  {
    slot: EQUIP_SLOT_PRIMARY,
    bucket: 3,
    defIndex: 934,
    artArrangement: 632,
    sandboxPattern: 15,
    label: "primary",
  },
  {
    slot: EQUIP_SLOT_SPECIAL,
    bucket: 4,
    defIndex: 937,
    artArrangement: 635,
    sandboxPattern: 15,
    label: "secondary",
  },
  {
    slot: EQUIP_SLOT_HEAVY,
    bucket: 5,
    defIndex: 961,
    artArrangement: 659,
    sandboxPattern: 15,
    label: "heavy",
  },
  {
    slot: EQUIP_SLOT_HELMET,
    bucket: 8,
    defIndex: 330,
    artArrangement: 316,
    sandboxPattern: 11,
    label: "helmet",
  },
  {
    slot: EQUIP_SLOT_GAUNTLETS,
    bucket: 9,
    defIndex: 317,
    artArrangement: 303,
    sandboxPattern: 11,
    label: "gauntlets",
  },
  {
    slot: EQUIP_SLOT_CHEST,
    bucket: 10,
    defIndex: 323,
    artArrangement: 309,
    sandboxPattern: 11,
    label: "chest",
  },
  {
    slot: EQUIP_SLOT_LEGS,
    bucket: 11,
    defIndex: 336,
    artArrangement: 322,
    sandboxPattern: 11,
    label: "legs",
  },
  {
    slot: EQUIP_SLOT_CLASS_ITEM,
    bucket: 12,
    defIndex: 327,
    artArrangement: 313,
    sandboxPattern: 11,
    label: "class_item",
  },
  {
    slot: EQUIP_SLOT_SHIP,
    bucket: 13,
    defIndex: 760,
    artArrangement: -1,
    sandboxPattern: 0,
    label: "ship",
  },
  {
    slot: EQUIP_SLOT_GHOST,
    bucket: 14,
    defIndex: 943,
    artArrangement: 641,
    sandboxPattern: 0,
    label: "ghost",
  },
  {
    slot: EQUIP_SLOT_VEHICLE,
    bucket: 15,
    defIndex: 450,
    artArrangement: -1,
    sandboxPattern: 0,
    label: "sparrow",
  },
];

export const CHAR_CLASS_NONE = 0;
export const CHAR_CLASS_GUARDIAN = 1;
export const CHAR_CLASS_HUNTER = 2;
export const CHAR_CLASS_WARLOCK = 3;

export const STUB_CHARACTER_CLASS = CHAR_CLASS_WARLOCK;

export const STUB_FACE_INDEX = 364;

export const STUB_SKIN_COLOR = 1;
export const STUB_LIP_COLOR = 1;
export const STUB_EYE_COLOR = 1;
export const STUB_HAIR_COLOR = 1;
export const STUB_FEATURE_COLOR = 1;
export const STUB_DECAL_COLOR = 1;

export const STUB_RACE_INDEX = 0;
export const STUB_GENDER_INDEX = 0;

export const EQUIP_SLOT_TO_BUCKET: readonly number[] = [
  1, 2, 3, 4, 5, 6, 10, 12, 11, 7, 8, 9, 13, 15, 14,
];

export const INVENTORY_BUCKET_BAG_START: Readonly<Record<number, number>> = {
  1: 30,
  2: 50,
  3: 115,
  4: 125,
  5: 135,
  6: 10,
  7: 60,
  8: 65,
  9: 75,
  10: 85,
  11: 95,
  12: 105,
  13: 145,
  14: 155,
  15: 165,
};

export function bagIndexForBucket(bucket: number): number {
  const start = INVENTORY_BUCKET_BAG_START[bucket];
  return start === undefined ? -1 : start;
}

export interface StubAbilityEntry {
  option?: number;
  slot: number;
}

export const STUB_ABILITY_LOADOUT: readonly StubAbilityEntry[] = [
  { slot: 1 },
  { slot: 2 },
  { slot: 3 },
  { slot: 4 },
  { slot: 5 },
];
