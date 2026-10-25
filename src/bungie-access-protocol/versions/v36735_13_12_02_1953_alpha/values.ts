// Values for the alpha's self, select_character, peer and inspection
// families. Little of a character is stored: the rest is the alpha's canned
// defaults, which is why this file is mostly constants.

import type { rsat } from "@blamnetwork/rsat";
import { equipSlotIds } from "../../../content/inventory";
import { levelProgression } from "../../../content/progressions";
import { levelForXp } from "../../../investment/character-level";
import type { CharacterRecord } from "../../../investment/character-store";
import { bagIndexForBucket } from "../../../investment/inventory-layout";
import type { StatPair } from "../../../investment/loadout";
import { emptyTalentNodes } from "../../../investment/loadout";
import {
  LOOT_SLOT_COUNT,
  type LootSlot,
  lootTableForCharacter,
} from "../../../investment/loot";
import {
  gridIndexForDef,
  TALENT_GRID_INSTANCE_TIER,
  talentGridProgression,
} from "../../../investment/talent-grid";
import { k_empty_name_hash } from "../../../utils/name-hash";
import { characterPowerStat } from "../../queuez/power-level";
import { parseCharacterProfile } from "./messages";
import type { InspectionCharacterValue } from "./queuez/inspection";
import type { PeerCharacterValue } from "./queuez/peer";
import type {
  InventoryItemValue,
  SelfCharacterValue,
  SelfSchemas,
} from "./queuez/self";
import type { SharedSchemas } from "./queuez/shared";

type AppearanceEcValue = rsat.Infer<SharedSchemas["AppearanceEc"]>;
type AppearanceF0Value = rsat.Infer<SharedSchemas["AppearanceF0"]>;
type GearCfValue = rsat.Infer<SharedSchemas["Unknown808019CF"]>;
type Unknown8080195FValue = rsat.Infer<SelfSchemas["Unknown8080195F"]>;
type Unknown80801966Value = rsat.Infer<SelfSchemas["Unknown80801966"]>;

const EMPTY_DYE = { unknown0: -1 as number, unknown1: -1 as number };
const EMPTY_DYES = {
  unknown0: [EMPTY_DYE, EMPTY_DYE, EMPTY_DYE, EMPTY_DYE, EMPTY_DYE, EMPTY_DYE],
};

// Gear block field 5: character perks, by perk_reference index. A Super has no
// passive regen in this build; its energy comes only from these four (slots
// 3-6, as Bungie's preset builds): super gain on kill, on combatant kill, on
// capture, on assist.
const CHARACTER_PERKS: readonly number[] = [-1, -1, -1, 97, 98, 96, 95];

const GEAR_CF_BFB1: readonly number[] = [
  912, 439, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
];
const GEAR_CF_BFB2: readonly number[] = [
  543, 435, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
];

// The character stat block (gear field 9), 16 x { i8 stat index, i32 value }.
// The client scatters it into a zeroed array, so a stat left out reads back
// 0.0 in the per-ability stat entries the charge/cooldown formulas divide by.
// The values are ours (the shipped default guardian runs with
// SHIELD/AGILITY/DISCIPLINE/ENERGY at zero); only the stat-ID map is authored:
// these eight slots plus stat 0 ("power", characterPowerStat); 5-7 are weapon
// stat slots. They stay in 0..6: the 7-row stat tables assert the weapon path
// on retail-scale numbers.
const GEAR_CF_CHARACTER_STATS: readonly StatPair[] = [
  // The top of the 7-row tables (0..6).
  [1, 6], // SHIELD
  [2, 6], // AGILITY
  [3, 6], // DISCIPLINE
  [4, 6], // ENERGY
  // True names unknown; authored in the stat map beside the four above.
  [25, 6],
  [26, 6],
  [27, 6],
  [28, 6],
];

// The investment ability table indices.
const ABILITY_AXION_BOLT = 1;
const ABILITY_DOUBLE_JUMP = 3;
const ABILITY_FIST_OF_HAVOC = 4;
const ABILITY_FLUX_GRENADE = 5;
const ABILITY_GOLDEN_GUN = 6;
const ABILITY_GLIDE = 7;
const ABILITY_TITAN_MELEE = 8;
const ABILITY_HUNTER_MELEE = 9;
const ABILITY_LIFT = 10;
const ABILITY_MAGNETIC_GRENADE = 11;
const ABILITY_NOVA_BOMB = 12;
const ABILITY_SPRINT = 20;
const ABILITY_WARLOCK_MELEE = 22;

// Button bindings by wire class (0 titan, 1 hunter, 2 warlock): gear block
// entry i binds ability slot i, in the order Target (grenade, LB), Super,
// Melee (RB), Jump (A), Movement (L3). The client copies these straight into
// the player and does not check ability kind against slot (the retail
// capture's indices would put a grenade on L3 here); no step of the alpha's
// grids has an ability (0xFF), so the grid can't give them.
const ABILITY_BINDINGS: Readonly<Record<number, readonly number[]>> = {
  0: [
    ABILITY_MAGNETIC_GRENADE,
    ABILITY_FIST_OF_HAVOC,
    ABILITY_TITAN_MELEE,
    ABILITY_LIFT,
    ABILITY_SPRINT,
  ],
  1: [
    ABILITY_FLUX_GRENADE,
    ABILITY_GOLDEN_GUN,
    ABILITY_HUNTER_MELEE,
    ABILITY_DOUBLE_JUMP,
    ABILITY_SPRINT,
  ],
  2: [
    ABILITY_AXION_BOLT,
    ABILITY_NOVA_BOMB,
    ABILITY_WARLOCK_MELEE,
    ABILITY_GLIDE,
    ABILITY_SPRINT,
  ],
};

// The five ability progression rows (slots 1..5) the character sheet lists
// ahead of the level row, all empty.
const ABILITY_PROGRESSION_SLOTS = [1, 2, 3, 4, 5] as const;

// The bag has 256 entries.
const BAG_SLOTS = 256;

function pad16(values: readonly number[], fill = -1): number[] {
  return Array.from({ length: 16 }, (_, i) =>
    i < values.length ? values[i]! : fill
  );
}

function bfcSlots(pairs: readonly StatPair[]) {
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

// Per equip slot: soid, def, sandbox pattern (the byte the guest builds the
// weapon / ship sobject from), art arrangement, dyes.
function equipSlots(character: CharacterRecord) {
  const slots = Array.from({ length: 20 }, () => emptyEquipSlot());
  for (let slot = 0; slot < slots.length; slot++) {
    const item = character.loadout.equipped(slot);
    if (item) {
      slots[slot] = {
        soid: item.soid,
        defIndex: item.defIndex,
        unknown2: item.sandboxPattern,
        unknown3: item.artArrangement,
        unknown4: EMPTY_DYES,
      };
    }
  }
  return slots;
}

export function appearanceEc(character: CharacterRecord): AppearanceEcValue {
  const a = character.appearance;
  return { race: a.race, gender: a.gender, classIndex: a.classIndex };
}

export function appearanceF0(character: CharacterRecord): AppearanceF0Value {
  const a = character.appearance;
  return {
    faceIndex: a.faceIndex,
    hairIndex: a.hairIndex,
    featureIndex: a.featureIndex,
    decalIndex: a.decalIndex,
    skinColor: a.skinColor,
    lipColor: a.lipColor,
    eyeColor: a.eyeColor,
    hairColor: a.hairColor,
    featureColor: a.featureColor,
    decalColor: a.decalColor,
    personalityId: a.personalityId,
    helmetPreference: a.helmetPreference,
  };
}

function abilityBindings(character: CharacterRecord): readonly number[] {
  return (
    ABILITY_BINDINGS[character.appearance.classIndex] ?? ABILITY_BINDINGS[2]!
  );
}

// The gear block the select, peer and inspection screens show. Field 0 is the
// character level the screens print, 1 binds the ability slots, 3 holds the
// equip slots, 9 the stat block and 10..12 mirror the equipped weapons' stat
// blocks (the 7-row stat tables bugcheck once a peer equips a hand cannon /
// sniper / machine gun without them).
export function stubGearCf(character: CharacterRecord): GearCfValue {
  const ids = equipSlotIds();
  return {
    unknown0: levelForXp(character.progressionXp),
    unknown1: {
      unknown0: abilityBindings(character).map((index) => ({
        unknown0: index,
        unknown1: {
          unknown0: Array.from({ length: 8 }, () => k_empty_name_hash),
        },
      })),
    },
    unknown2: {
      unknown0: Array.from({ length: 32 }, () => k_empty_name_hash),
    },
    unknown3: { unknown0: equipSlots(character) },
    unknown4: {
      unknown0: Array.from({ length: 8 }, () => ({
        unknown0: -1,
        soid: 0n,
      })),
    },
    unknown5: {
      unknown0: Array.from(
        { length: 26 },
        (_, slot) => CHARACTER_PERKS[slot] ?? -1
      ),
    },
    unknown6: { unknown0: pad16([]) },
    unknown7: { unknown0: pad16(GEAR_CF_BFB1) },
    unknown8: { unknown0: pad16(GEAR_CF_BFB2) },
    unknown9: {
      unknown0: bfcSlots([
        characterPowerStat(character),
        ...GEAR_CF_CHARACTER_STATS,
      ]),
    },
    unknown10: {
      unknown0: bfcSlots(character.loadout.weaponStats(ids.primary)),
    },
    unknown11: {
      unknown0: bfcSlots(character.loadout.weaponStats(ids.special)),
    },
    unknown12: {
      unknown0: bfcSlots(character.loadout.weaponStats(ids.heavy)),
    },
  };
}

export function stubPeerCharacter(
  character: CharacterRecord
): PeerCharacterValue {
  return {
    soid: character.soid,
    unknown1: appearanceEc(character),
    unknown2: appearanceF0(character),
    unknown3: stubGearCf(character),
  };
}

export function stubInspectionCharacter(
  character: CharacterRecord
): InspectionCharacterValue {
  return {
    soid: character.soid,
    unknown1: appearanceEc(character),
    unknown2: appearanceF0(character),
    // The progression rows must be present, level row included: sent empty,
    // the roster has no level to show for the character.
    unknown3: progressionRows(character),
    unknown4: undefined,
    unknown5: undefined,
    unknown6: undefined,
    unknown7: undefined,
    unknown8: undefined,
    unknown9: undefined,
    unknown10: stubGearCf(character),
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

// Every item (equipped or not) sits in its bucket's bag range. Stacks
// (currency / materials) carry no item object, so the bag entry's soid is 0
// and unknown2 is the stack size.
function bagSlots(character: CharacterRecord) {
  const slots = Array.from({ length: BAG_SLOTS }, () => emptyBagEntry());
  const used = new Map<number, number>();
  for (const item of character.loadout.items) {
    const start = bagIndexForBucket(item.bucket);
    if (start < 0) {
      continue;
    }
    const bagIndex = start + (used.get(item.bucket) ?? 0);
    used.set(item.bucket, bagIndex - start + 1);
    slots[bagIndex] = {
      defIndex: item.defIndex,
      soid: item.instanced ? item.soid : 0n,
      unknown2: item.quantity,
      unknown3: 0,
    };
  }
  return slots;
}

// The equipped soid per equip slot; the inventory UI marks an item equipped
// when its soid is in here.
function equippedSoids(character: CharacterRecord) {
  return Array.from(
    { length: 20 },
    (_, slot) => character.loadout.equipped(slot)?.soid ?? 0n
  );
}

// The character's progression rows. The client derives the Guardian's level
// from the level progression's row, and a change there raises the XP toast and
// level-up. The ability rows are kept so nothing that depends on them changes.
function progressionRows(character: CharacterRecord) {
  return {
    unknown0: [
      ...ABILITY_PROGRESSION_SLOTS.map((slot) => ({
        unknown0: slot,
        unknown1: 0,
        unknown2: 0,
        unknown3: 0,
      })),
      {
        unknown0: levelProgression().index,
        unknown1: character.progressionXp,
        unknown2: 0,
        unknown3: 0,
      },
    ],
  };
}

// The profile the client last uploaded (702), else a fresh one: full
// magazine + reserve on every weapon slot (0 / absent spawned the guardian
// with "NO AMMO") and no orbit destination key (orbit shows Earth).
function characterProfile(character: CharacterRecord) {
  const stored = character.profile
    ? parseCharacterProfile(character.profile)
    : null;
  if (!stored) {
    return {
      unknown0: {
        unknown0: { unknown0: 1, unknown1: 1, unknown2: 1 },
        unknown1: undefined,
      },
      unknown1: undefined,
    };
  }
  // The guest zeroes heavy ammo on scripted respawns and in crate-only
  // activities, then writes the 0.0 fraction back; echoing that would
  // spawn every later session without heavy ammo.
  const fractions = stored.unknown0?.unknown0;
  if (!fractions) {
    return stored;
  }
  return {
    ...stored,
    unknown0: {
      ...stored.unknown0,
      unknown0: { ...fractions, unknown2: 1 },
    },
  };
}

function wireLootSlot(slot: LootSlot | undefined): Unknown8080195FValue {
  if (!slot) {
    return {
      unknown0: undefined,
      unknown1: undefined,
      unknown2: undefined,
      unknown3: undefined,
      unknown4: undefined,
    };
  }
  return {
    unknown0: slot.itemDef,
    unknown1: slot.quantity,
    unknown2: slot.state,
    unknown3: {
      unknown0: {
        unknown0: slot.nonce.incidentNumber,
        unknown1: slot.nonce.submitterSoid,
      },
      unknown1: slot.nonce.ordinal,
    },
    // The bauble cosmetic nest is copied client-side but never read by the
    // loot/pickup code: always send it absent.
    unknown4: undefined,
  };
}

// Absent unless the character's loot table has something to say (an active
// drop or a one-shot pickup clear).
function lootSlots(
  character: CharacterRecord
): Unknown80801966Value | undefined {
  const table = lootTableForCharacter(character.soid);
  if (!table.hasPendingWire) {
    return;
  }
  const slots = Array.from({ length: LOOT_SLOT_COUNT }, (_, i) => {
    const slot = table.at(i);
    if (slot) {
      return wireLootSlot(slot);
    }
    if (table.isPendingClear(i)) {
      table.consumePendingClear(i);
      return wireLootSlot({
        itemDef: -1,
        quantity: 0,
        state: 0,
        nonce: { incidentNumber: 0, submitterSoid: 0n, ordinal: 0 },
      });
    }
    return wireLootSlot(undefined);
  });
  return {
    unknown0: undefined,
    unknown1: { unknown0: slots },
    unknown2: undefined,
  };
}

// The character object of the self family. Its activity and its finish are
// not on it: this build's client chains no activity from the self character.
export function stubSelfCharacter(
  character: CharacterRecord
): SelfCharacterValue {
  // Field 5 leads with the helmet's art arrangement, 316 with none.
  const helmetArt =
    character.loadout.equipped(equipSlotIds().helmet)?.artArrangement ?? 316;
  return {
    soid: character.soid,
    unknown1: appearanceEc(character),
    unknown2: appearanceF0(character),
    unknown3: {
      unknown0: BAG_SLOTS,
      unknown1: { unknown0: bagSlots(character) },
    },
    unknown4: { unknown0: equippedSoids(character) },
    unknown5: {
      unknown0: helmetArt,
      unknown1: 0,
      unknown2: 0,
      unknown3: false,
    },
    unknown6: characterProfile(character),
    unknown7: progressionRows(character),
    unknown8: {
      unknown0: 1,
      unknown1: 1,
      unknown2: 0,
      unknown3: 5,
      unknown4: undefined,
      // Shared dirty idx 6 is set by inventory bag; sent as 0.
      unknown5: 0n,
      unknown6: undefined,
      unknown7: undefined,
    },
    unknown9: lootSlots(character),
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

// Sparse slots of the self primary's account offers: shared dirty {0} or
// {0,2}, plus the account-offer PoO unlock at index 14.
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
  // Index 14 is account-offer mapping entry 14 (hash 8B60FEFB, true name
  // unknown), global unlock flag slot 556. Activities 0..9
  // (city_tower_default1, action_mock, venus_chapter_2, venus_bounty_1,
  // venus_portal_1, the pvp maps) gate their director dialog on `[push 556]`,
  // which only passes when the flag byte == 2. Set it so the director never
  // raises the PoO/DLC dialog.
  slots[14] = 2;
  return slots;
}

// -1/-1 ability-binding sentinel: every step of both extracted grids has
// abilityIndex 0xFF, so the ability bindings come from the gear block instead.
const EMPTY_ABILITY_BINDING = { unknown0: -1, unknown1: -1 };

// The talent grid instance is a property of the ITEM, addressed by its own
// soid: an unequipped bag item has one like an equipped one. Without it the
// client builds the talent panel from a zeroed instance (bogus level, blank
// tree) instead of the real empty-but-valid grid.
export function stubInventoryItem(
  soid: bigint,
  defIndex: number,
  talentXp = 0,
  talentNodes: readonly number[] = emptyTalentNodes(),
  power = 0
): InventoryItemValue {
  const grid = gridIndexForDef(defIndex);
  const unknown4 = {
    unknown0: grid,
    // The item's own progression row - the talent tree's level comes from
    // this, not from the character.
    unknown1: {
      unknown0: talentGridProgression(defIndex),
      unknown1: talentXp,
      unknown2: 0,
      // Shared dirty idx 3 is not set on item stubs.
      unknown3: undefined,
    },
    // Grid tier and the random-material step index (always 0 - we never
    // seed a multi-material grid).
    unknown2: TALENT_GRID_INSTANCE_TIER,
    unknown3: 0,
    // Activated-step array (persisted per item, mutated by 801/802) and
    // ability bindings (never granted by a grid in this build).
    unknown4: { unknown0: [...talentNodes] },
    unknown5: {
      unknown0: Array.from({ length: 5 }, () => EMPTY_ABILITY_BINDING),
    },
  };
  return {
    soid,
    defIndex,
    unknown2: {
      unknown0: -1,
      unknown1: 0n,
    },
    // The item's power block. An owned item's power is copied verbatim from
    // here (no merge with the item definition), so leaving it out reads as
    // power 0 and every weapon and armour piece sits at the curve's floor
    // (10). The key-0 slot is the one the stat code reads; displayed as
    // 10 + 10 * power.
    unknown3: {
      unknown0: {
        unknown0: [{ unknown0: 0, unknown1: power }],
      },
      unknown1: 0,
    },
    unknown4,
  };
}
