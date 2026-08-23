// This file is a mess. I haven't dug into character data very much.
// Please rewrite this all lol
// - codie

import type {
  AppearanceEcValue,
  AppearanceF0Value,
  GearCfValue,
  InspectionCharacterValue,
  InventoryItemValue,
  PeerCharacterValue,
  SelfCharacterValue,
} from "../../queuez";
import { EMPTY_STRING_HASH, SELF_CHECKSUM_ITEM } from "../constants";
import {
  bagIndexForBucket,
  EQUIP_SLOT_HELMET,
  EQUIP_SLOT_VEHICLE,
  EQUIP_SLOT_VEHICLE_UI,
  INVENTORY_BUCKET_BAG_START,
  ITEM_SOID_BASE,
  itemSoidForSlot,
  STUB_ABILITY_LOADOUT,
  STUB_CHARACTER_CLASS,
  STUB_DECAL_COLOR,
  STUB_EYE_COLOR,
  STUB_FACE_INDEX,
  STUB_FEATURE_COLOR,
  STUB_GENDER_INDEX,
  STUB_HAIR_COLOR,
  STUB_ITEM_DEFS,
  STUB_LIP_COLOR,
  STUB_RACE_INDEX,
  STUB_SKIN_COLOR,
} from "./loadout";

const EMPTY_DYE = { unknown0: -1 as number, unknown1: -1 as number };
const EMPTY_DYES = {
  unknown0: [EMPTY_DYE, EMPTY_DYE, EMPTY_DYE, EMPTY_DYE, EMPTY_DYE, EMPTY_DYE],
};

const GEAR_CF_CATEGORY_INDICES = [28, 15, 7, 9, 13] as const;

const GEAR_CF_BFB1: readonly number[] = [
  912, 439, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
];
const GEAR_CF_BFB2: readonly number[] = [
  543, 435, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
];

type GearCfC5 = readonly [number, number];
const GEAR_CF_BFC: readonly (readonly GearCfC5[])[] = [
  [
    [0, 146],
    [2, 7],
    [3, 1],
    [4, 3],
    [5, 10],
    [6, 40],
    [7, 55],
    [28, 90],
  ],
  [
    [0, 20],
    [11, 157],
    [12, 20],
    [13, 80],
    [14, 55],
    [18, 22],
    [20, 29],
    [21, 35],
    [22, 42],
    [23, 29],
    [26, 36],
    [27, 70],
    [28, 15],
    [29, 1],
  ],
  [
    [0, 18],
    [11, 142],
    [12, 60],
    [13, 40],
    [14, 49],
    [18, 18],
    [20, 60],
    [21, 21],
    [22, 25],
    [23, 39],
    [26, 42],
    [27, 60],
    [28, 55],
    [29, 2],
  ],
  [
    [0, 16],
    [11, 130],
    [12, 70],
    [16, 14],
    [17, 78],
    [18, 52],
    [20, 20],
    [21, 60],
    [22, 16],
    [23, 24],
    [26, 83],
    [27, 58],
    [28, 20],
  ],
];

function pad16(values: readonly number[], fill = -1): number[] {
  return Array.from({ length: 16 }, (_, i) =>
    i < values.length ? values[i]! : fill
  );
}

function bfcSlots(pairs: readonly GearCfC5[]) {
  return Array.from({ length: 16 }, (_, i) => {
    const [a, b] = i < pairs.length ? pairs[i]! : ([-1, 0] as const);
    return { unknown0: a, unknown1: b };
  });
}

function emptyEquipSlot() {
  return {
    soid: 0n,
    defIndex: -1,
    unknown2: 0,
    unknown3: -1,
    unknown4: EMPTY_DYES,
  };
}

function stubEquipSlots() {
  const slots = Array.from({ length: 20 }, () => emptyEquipSlot());
  for (const g of STUB_ITEM_DEFS) {
    slots[g.slot] = {
      soid: itemSoidForSlot(g.slot),
      defIndex: g.defIndex,
      unknown2: g.sandboxPattern,
      unknown3: g.artArrangement,
      unknown4: EMPTY_DYES,
    };
  }
  const veh = STUB_ITEM_DEFS.find((g) => g.slot === EQUIP_SLOT_VEHICLE);
  if (veh) {
    slots[EQUIP_SLOT_VEHICLE_UI] = {
      soid: itemSoidForSlot(veh.slot),
      defIndex: veh.defIndex,
      unknown2: veh.sandboxPattern,
      unknown3: veh.artArrangement,
      unknown4: EMPTY_DYES,
    };
  }
  return slots;
}

export function stubAppearanceEc(): AppearanceEcValue {
  return {
    race: STUB_RACE_INDEX,
    gender: STUB_GENDER_INDEX,
    classIndex: STUB_CHARACTER_CLASS > 0 ? STUB_CHARACTER_CLASS - 1 : 0,
  };
}

export function stubAppearanceF0(): AppearanceF0Value {
  return {
    faceIndex: STUB_FACE_INDEX,
    hairIndex: 0,
    featureIndex: 0,
    decalIndex: 0,
    skinColor: STUB_SKIN_COLOR,
    lipColor: STUB_LIP_COLOR,
    eyeColor: STUB_EYE_COLOR,
    hairColor: STUB_HAIR_COLOR,
    featureColor: STUB_FEATURE_COLOR,
    decalColor: STUB_DECAL_COLOR,
    personalityId: 0,
    helmetPreference: 0,
  };
}

export function stubGearCf(): GearCfValue {
  return {
    unknown0: 40,
    unknown1: {
      unknown0: GEAR_CF_CATEGORY_INDICES.map((index) => ({
        unknown0: index,
        unknown1: {
          unknown0: Array.from({ length: 8 }, () => EMPTY_STRING_HASH),
        },
      })),
    },
    unknown2: {
      unknown0: Array.from({ length: 32 }, () => EMPTY_STRING_HASH),
    },
    unknown3: { unknown0: stubEquipSlots() },
    unknown4: {
      unknown0: Array.from({ length: 8 }, () => ({
        unknown0: -1,
        soid: 0n,
      })),
    },
    unknown5: { unknown0: Array.from({ length: 26 }, () => -1) },
    unknown6: { unknown0: pad16([]) },
    unknown7: { unknown0: pad16(GEAR_CF_BFB1) },
    unknown8: { unknown0: pad16(GEAR_CF_BFB2) },
    unknown9: { unknown0: bfcSlots(GEAR_CF_BFC[0]!) },
    unknown10: { unknown0: bfcSlots(GEAR_CF_BFC[1]!) },
    unknown11: { unknown0: bfcSlots(GEAR_CF_BFC[2]!) },
    unknown12: { unknown0: bfcSlots(GEAR_CF_BFC[3]!) },
  };
}

export function stubPeerCharacter(characterSoid: bigint): PeerCharacterValue {
  return {
    soid: characterSoid,
    unknown1: stubAppearanceEc(),
    unknown2: stubAppearanceF0(),
    unknown3: stubGearCf(),
  };
}

export function stubInspectionCharacter(
  characterSoid: bigint
): InspectionCharacterValue {
  return {
    soid: characterSoid,
    unknown1: stubAppearanceEc(),
    unknown2: stubAppearanceF0(),
    // Dirty idx 6 → empty 808017D3 nest must be present.
    unknown3: { unknown0: [] },
    unknown4: undefined,
    unknown5: undefined,
    unknown6: undefined,
    unknown7: undefined,
    unknown8: undefined,
    unknown9: undefined,
    unknown10: stubGearCf(),
  };
}

function emptyBagEntry() {
  return {
    defIndex: -1,
    soid: 0n,
    unknown2: 0,
    unknown3: 0,
  };
}

function stubBagSlots() {
  const slots = Array.from({ length: 256 }, () => emptyBagEntry());
  for (const g of STUB_ITEM_DEFS) {
    const bagIndex = bagIndexForBucket(g.bucket);
    if (bagIndex < 0) {
      continue;
    }
    slots[bagIndex] = {
      defIndex: g.defIndex,
      soid: itemSoidForSlot(g.slot),
      unknown2: 1,
      unknown3: 0,
    };
  }
  return slots;
}

function stubEquippedSoids() {
  const soids = Array.from({ length: 20 }, () => 0n);
  for (const g of STUB_ITEM_DEFS) {
    soids[g.slot] = itemSoidForSlot(g.slot);
  }
  soids[EQUIP_SLOT_VEHICLE_UI] = itemSoidForSlot(EQUIP_SLOT_VEHICLE);
  return soids;
}

function stubAbilities() {
  return {
    unknown0: STUB_ABILITY_LOADOUT.map((row) => ({
      unknown0: row.slot,
      unknown1: row.option ?? 0,
      unknown2: 0,
      unknown3: 0,
    })),
  };
}

export function stubSelfCharacter(characterSoid: bigint): SelfCharacterValue {
  const helmetArt =
    STUB_ITEM_DEFS.find((g) => g.slot === EQUIP_SLOT_HELMET)?.artArrangement ??
    316;
  return {
    soid: characterSoid,
    unknown1: stubAppearanceEc(),
    unknown2: stubAppearanceF0(),
    unknown3: {
      unknown0: 256,
      unknown1: { unknown0: stubBagSlots() },
    },
    unknown4: { unknown0: stubEquippedSoids() },
    unknown5: {
      unknown0: helmetArt,
      unknown1: 0,
      unknown2: 0,
      unknown3: false,
    },
    unknown6: undefined,
    unknown7: stubAbilities(),
    unknown8: {
      unknown0: 1,
      unknown1: 1,
      unknown2: 0,
      unknown3: 5,
      unknown4: undefined,
      // Shared dirty idx 6 is set by inventory bag → dump emits this u64 as 0.
      unknown5: 0n,
      unknown6: undefined,
      unknown7: undefined,
    },
    unknown9: undefined,
    unknown10: undefined,
    unknown11: undefined,
    unknown12: undefined,
    unknown13: undefined,
    unknown14: undefined,
    unknown15: undefined,
    unknown16: undefined,
    unknown17: undefined,
    unknown18: undefined,
  };
}

/** Sparse 80801BD0 slots matching dump shared dirty {0} or {0,2}. */
export function stubSelfAfSlots(
  hasCharacterSoid: boolean
): (number | undefined)[] {
  const slots: (number | undefined)[] = Array.from(
    { length: 128 },
    () => undefined
  );
  slots[0] = 0;
  if (hasCharacterSoid) {
    slots[2] = 0;
  }
  return slots;
}

export function stubInventoryItem(
  soid: bigint,
  defIndex: number,
  equipSlot = -1
): InventoryItemValue {
  const unknown4 =
    equipSlot >= 0 && equipSlot < 0x14
      ? {
          unknown0: 0,
          unknown1: {
            unknown0: equipSlot,
            unknown1: 0,
            unknown2: 0,
            // Shared dirty idx 3 is not set on item stubs.
            unknown3: undefined,
          },
          unknown2: undefined,
          unknown3: undefined,
          unknown4: undefined,
          unknown5: undefined,
        }
      : undefined;
  return {
    soid,
    defIndex,
    unknown2: {
      unknown0: -1,
      unknown1: 0n,
    },
    unknown3: undefined,
    unknown4,
  };
}

export function stubInventoryItemObject(
  soid: bigint,
  defIndex: number,
  equipSlot = -1
): { value: InventoryItemValue; headerChecksum: number; soid: bigint } {
  return {
    soid,
    headerChecksum: SELF_CHECKSUM_ITEM,
    value: stubInventoryItem(soid, defIndex, equipSlot),
  };
}

export {
  bagIndexForBucket,
  INVENTORY_BUCKET_BAG_START,
  ITEM_SOID_BASE,
  itemSoidForSlot,
  STUB_ITEM_DEFS,
};
