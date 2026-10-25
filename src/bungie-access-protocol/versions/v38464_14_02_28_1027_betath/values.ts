import type { rsat } from "@blamnetwork/rsat";
import { equipSlotIds } from "../../../content/inventory";
import {
  type SubclassBuild,
  subclassBuilds,
} from "../../../content/talent-grids";
import {
  levelCap,
  progressionRows,
  statOverride,
} from "../../../investment/character-level";
import type { CharacterRecord } from "../../../investment/character-store";
import { bagIndexForBucket } from "../../../investment/inventory-layout";
import type { LoadoutItem, StatPair } from "../../../investment/loadout";
import { starterSubclassDef } from "../../../investment/loadout";
import {
  LOOT_SLOT_COUNT,
  type LootSlot,
  lootTableForCharacter,
} from "../../../investment/loot";
import type { ItemPrimaryStat } from "../../../investment/primary-stat";
import { k_empty_name_hash } from "../../../utils/name-hash";
import {
  characterLevelOf,
  characterStats,
  weaponStats,
} from "./character-stats";
import {
  DEFAULT_ORBIT_KEY,
  DEFAULT_PROFILE_AMMO,
  EMPTY_ORBIT_KEY,
  GEAR_LIST_7,
  GEAR_LIST_8,
  PEER_PRIMARY_UNKNOWN2_COUNT,
  PEER_PRIMARY_UNKNOWN3_COUNT,
  SELF_CHARACTER_UNKNOWN5,
  SELF_CHARACTER_UNKNOWN8,
} from "./character-values";
import {
  DIRECTOR_DEBUG_UNLOCK,
  directorAccountSlotValues,
  directorCharacterSlotValues,
  directorOfferSlotValues,
} from "./director-policy";
import { type CharacterProfileValue, parseCharacterProfile } from "./messages";
import type {
  InspectionCharacterValue,
  InspectionPrimaryValue,
} from "./queuez/inspection";
import type { PeerCharacterValue, PeerPrimaryValue } from "./queuez/peer";
import type { RosterMemberValue } from "./queuez/roster";
import type {
  SelectCharacterCharacterValue,
  SelectCharacterPrimaryValue,
  SelectCharacterSchemas,
} from "./queuez/select-character";
import type {
  InventoryItemValue,
  SelfCharacterValue,
  SelfPrimaryValue,
  SelfSchemas,
} from "./queuez/self";

type LootSlotValue = rsat.Infer<SelfSchemas["Unknown80801804"]>;
type AppearanceF0Value = rsat.Infer<SelfSchemas["Unknown808017F4"]>;
type GearValue = rsat.Infer<SelectCharacterSchemas["Unknown808016EE"]>;

// Values for the self, select_character, peer, roster and inspection families.
// Fields without a value of ours are absent.

function appearanceEc(character: CharacterRecord) {
  const a = character.appearance;
  return { unknown0: a.race, unknown1: a.gender, unknown2: a.classIndex };
}

// Hair and feature colour are a group of three each (true meaning unknown);
// every slot of a group gets the character's one colour.
function appearanceF0(character: CharacterRecord): AppearanceF0Value {
  const a = character.appearance;
  const group = (color: number) => ({
    unknown0: color,
    unknown1: color,
    unknown2: color,
  });
  return {
    unknown0: a.faceIndex,
    unknown1: a.hairIndex,
    unknown2: a.featureIndex,
    unknown3: a.decalIndex,
    unknown4: a.skinColor,
    unknown5: a.lipColor,
    unknown6: a.eyeColor,
    unknown7: group(a.hairColor),
    unknown8: group(a.featureColor),
    unknown9: a.decalColor,
    unknown10: a.personalityId,
    unknown11: a.helmetPreference,
  };
}

// Roster soid array size (self and select primaries).
const SELF_ROSTER_MAX = 10;

// The self primary. investment_signin waits until this object, with soid ==
// accountSoid, is in the object store. The roster is every character on the
// account (max 10); the select list walks it, not family 3's.
export function selfPrimary(
  accountSoid: bigint,
  characterSoid: bigint | null,
  rosterSoids: readonly bigint[] = characterSoid === null ? [] : [characterSoid]
): SelfPrimaryValue {
  const roster = rosterSoids.slice(0, SELF_ROSTER_MAX);
  // Member 7 is the account unlock flags and member 8 the account offers
  // (storage types 4 / 3). Only the slots the policy picks are set
  // (unlock-policy.ts).
  const offerSlots = directorOfferSlotValues();
  return {
    unknown0: {
      soid: accountSoid,
      roster: roster.length ? { soids: roster } : undefined,
      characterSoid: characterSoid ?? undefined,
      unknown3: undefined,
      unknown4: undefined,
      unknown5: undefined,
      unknown6: undefined,
      unknown7: { unknown0: directorAccountSlotValues() },
      unknown8: { unknown0: false, unknown1: { unknown0: offerSlots } },
      unknown9: undefined,
      unknown10: undefined,
      unknown11: undefined,
    },
  };
}

// The profile the client last uploaded (702), else a fresh one: full
// magazine + reserve on every weapon slot (0 / absent spawns the guardian with
// "NO AMMO"). Either way the orbit key is set (Earth when the client has none).
function characterProfile(character: CharacterRecord) {
  const stored = character.profile
    ? parseCharacterProfile(character.profile)
    : null;
  if (!stored) {
    return {
      unknown0: {
        unknown0: DEFAULT_PROFILE_AMMO,
        unknown1: undefined,
        unknown2: undefined,
      },
      unknown1: withOrbitKey(undefined),
    };
  }
  // The guest zeroes heavy ammo on scripted respawns and in crate-only
  // activities, then writes the 0.0 fraction back; echoing that would spawn
  // every later session without heavy ammo.
  const fractions = stored.unknown0?.unknown0;
  return {
    ...stored,
    unknown0:
      fractions && stored.unknown0
        ? { ...stored.unknown0, unknown0: { ...fractions, unknown2: 1 } }
        : stored.unknown0,
    unknown1: withOrbitKey(stored.unknown1),
  };
}

type ProfileBody = NonNullable<CharacterProfileValue["unknown1"]>;

function withOrbitKey(body: ProfileBody | undefined): ProfileBody {
  const key = body?.unknown3;
  const orbit =
    key === undefined || key >>> 0 === EMPTY_ORBIT_KEY
      ? DEFAULT_ORBIT_KEY
      : key;
  return {
    unknown0: body?.unknown0,
    unknown1: body?.unknown1,
    unknown2: body?.unknown2,
    unknown3: orbit,
    unknown4: body?.unknown4,
  };
}

// Bag entries: every item (equipped or not) sits in its bucket's
// bag range. Stacks (currency / materials) carry no item object, so the bag
// entry's soid is 0 and unknown2 is the stack size.
function emptyBagEntry() {
  return { unknown0: -1, unknown1: 0n, unknown2: 0, unknown3: 0 };
}

function bagSlots(character: CharacterRecord) {
  const slots = Array.from({ length: 256 }, () => emptyBagEntry());
  const used = new Map<number, number>();
  for (const item of character.loadout.items) {
    const start = bagIndexForBucket(item.bucket);
    if (start < 0) {
      continue;
    }
    const bagIndex = start + (used.get(item.bucket) ?? 0);
    used.set(item.bucket, bagIndex - start + 1);
    slots[bagIndex] = {
      unknown0: item.defIndex,
      unknown1: item.instanced ? item.soid : 0n,
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

function wireLootSlot(slot: LootSlot | undefined): LootSlotValue {
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

// The self character's loot member: its slot table is the 64
// ground-loot records the client spawns baubles from. Absent unless the
// character's loot table has something to say (an active drop or a one-shot
// pickup clear).
function lootSlots(character: CharacterRecord) {
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
    unknown3: undefined,
  };
}

export function selfCharacter(character: CharacterRecord): SelfCharacterValue {
  return {
    soid: character.soid,
    unknown1: appearanceEc(character),
    unknown2: appearanceF0(character),
    unknown3: { unknown0: 256, unknown1: { unknown0: bagSlots(character) } },
    unknown4: { unknown0: equippedSoids(character) },
    // [0] is an activity index and [4] whether it was finished: the update
    // handler launches that activity's next one when [4] turns true for the
    // activity the fireteam is in. [1] is a second activity index. Both are -1
    // (none) until an activity ran: [0] indexes the activity table unchecked,
    // so any other value crashes the client.
    unknown5: {
      unknown0: character.lastActivity?.index ?? -1,
      ...SELF_CHARACTER_UNKNOWN5,
      unknown4: character.lastActivity?.completed ?? false,
    },
    unknown6: characterProfile(character),
    // Progression rows: the level row (progression 11 here) at the character's
    // level.
    unknown7: { unknown0: characterProgressionRows(character) },
    unknown8: SELF_CHARACTER_UNKNOWN8,
    unknown9: lootSlots(character),
    // Character unlock flags (storage type 5): story / destination reveals.
    unknown10: {
      unknown0: directorCharacterSlotValues(),
    },
    unknown11: undefined,
    unknown12: undefined,
    unknown13: undefined,
    unknown14: undefined,
    unknown15: undefined,
    // Server stat totals: light (stat 0) lifts the level past the progression
    // cap. Member 5 is the debug flag list (storage type 0), sent absent: this
    // build's policy forces nothing past the universe list. Member 6 is the
    // debug unlock switch, read only with ServerObject.unknown4 bit 0
    // (director-policy.ts).
    unknown16: {
      unknown0: undefined,
      unknown1: undefined,
      unknown2: undefined,
      unknown3: statOverride(characterLevelOf(character)),
      unknown4: undefined,
      unknown5: undefined,
      unknown6: DIRECTOR_DEBUG_UNLOCK || undefined,
      unknown7: undefined,
      unknown8: undefined,
      unknown9: undefined,
    },
    unknown17: undefined,
    unknown18: undefined,
  };
}

// The character's progression rows in this build's member order: the
// progression index first (member 0, an i8), then the three i32s in the order
// the shared rows hold them. The client looks progressions up by that index
// without a null check, so a row with its index in the wrong member crashes it.
function characterProgressionRows(character: CharacterRecord) {
  return progressionRows(characterLevelOf(character)).map((row) => ({
    unknown0: row.unknown3,
    unknown1: row.unknown0,
    unknown2: row.unknown1,
    unknown3: row.unknown2,
  }));
}

// The client's "none" for a table index (an i16 grid, an i8 progression).
const NO_INDEX = -1;

// The level key of a keyed level list, as in the item definition's level block
// (levelOf in content items.ts).
const LEVEL_KEY = 0;

// A primary stat level list: up to two {i8 key, i32 value} pairs. The client
// looks each key up when it checks a requirement; a pair without its key
// stops it on character creation.
function levelList(level: number) {
  return { unknown0: [{ unknown0: LEVEL_KEY, unknown1: level }] };
}

// An item: the soid, def index and the primary stat, shaped like the item
// definition's level block: the level list, a second keyed list (empty on
// every item definition of this build) and the quality. Level and quality feed
// the stat curve of level + quality / 10 (investment/primary-stat.ts).
export function inventoryItem(
  item: LoadoutItem,
  primary: ItemPrimaryStat
): InventoryItemValue {
  return {
    soid: item.soid,
    defIndex: item.defIndex,
    unknown2: { unknown0: -1, unknown1: 0n },
    unknown3: {
      unknown0: levelList(primary.level),
      unknown1: { unknown0: [] },
      unknown2: primary.quality,
    },
    // The talent grid and the progression row index are none, the row
    // carrying only the item's talent XP. The unlock flag rebuild looks up the
    // grid tag of every bag and equipped item, and the client only streams in
    // the grids its item defs name, so any other index is never resident and
    // the rebuild clears its valid byte: no activity status is computed and
    // every director node says "Requirements Not Met".
    unknown4: {
      unknown0: NO_INDEX,
      unknown1: {
        unknown0: NO_INDEX,
        unknown1: item.talentXp,
        unknown2: 0,
        unknown3: undefined,
      },
      unknown2: undefined,
      unknown3: undefined,
      unknown4: undefined,
      unknown5: undefined,
    },
  };
}

// Select-character primary: soid and the roster. unknown2 (17 x i16)
// and unknown3 stay absent.
export function selectCharacterPrimary(
  accountSoid: bigint,
  characterSoids: readonly bigint[]
): SelectCharacterPrimaryValue {
  return {
    soid: accountSoid,
    roster: characterSoids.length ? { soids: [...characterSoids] } : undefined,
    unknown2: undefined,
    unknown3: undefined,
  };
}

// The gear block's perk list size.
const GEAR_PERK_SLOTS = 26;

// The equipped subclass's starting build, else the class's starter subclass.
function subclassBuild(character: CharacterRecord): SubclassBuild {
  const equipped = character.loadout.equipped(
    equipSlotIds().subclass
  )?.defIndex;
  return (
    subclassBuilds().get(equipped ?? -1) ??
    subclassBuilds().get(starterSubclassDef(character.appearance.classIndex))!
  );
}

const EMPTY_DYE = { unknown0: -1, unknown1: -1 };
const EMPTY_DYES = {
  unknown0: [EMPTY_DYE, EMPTY_DYE, EMPTY_DYE, EMPTY_DYE, EMPTY_DYE, EMPTY_DYE],
};

function pad16(values: readonly number[], fill = -1): number[] {
  return Array.from({ length: 16 }, (_, i) =>
    i < values.length ? values[i]! : fill
  );
}

function statSlots(pairs: readonly StatPair[]) {
  return Array.from({ length: 16 }, (_, i) => {
    const [a, b] = i < pairs.length ? pairs[i]! : ([-1, 0] as const);
    return { unknown0: a, unknown1: b };
  });
}

// An empty slot has no pattern (-1), not 0 (a retail peer character capture).
function emptyEquipSlot() {
  return {
    unknown0: 0n,
    unknown1: -1,
    unknown2: -1,
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
        unknown0: item.soid,
        unknown1: item.defIndex,
        unknown2: item.sandboxPattern,
        unknown3: item.artArrangement,
        unknown4: EMPTY_DYES,
      };
    }
  }
  return slots;
}

// The gear block the select, roster and inspection screens and the peer
// family show; the player's combat stats are read from here, its own included.
function gear(character: CharacterRecord): GearValue {
  const build = subclassBuild(character);
  return {
    // The character's level (capped at the level cap), printed lifted by the
    // light in unknown9.
    unknown0: Math.min(characterLevelOf(character), levelCap()),
    // Ability slot i (grenade, super, melee, jump, movement) -> an ability
    // table index from the subclass's grid build.
    unknown1: {
      unknown0: build.abilities.map((ability) => ({
        unknown0: ability,
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
        unknown1: 0n,
      })),
    },
    // The build's perks, void subclass node perks included.
    unknown5: {
      unknown0: Array.from(
        { length: GEAR_PERK_SLOTS },
        (_, slot) => build.perks[slot] ?? -1
      ),
    },
    unknown6: { unknown0: pad16([]) },
    unknown7: { unknown0: pad16(GEAR_LIST_7) },
    unknown8: { unknown0: pad16(GEAR_LIST_8) },
    // The character stats, then the primary / special / heavy weapon stats
    // (character-stats.ts).
    unknown9: { unknown0: statSlots(characterStats(character)) },
    unknown10: {
      unknown0: statSlots(weaponStats(character, equipSlotIds().primary)),
    },
    unknown11: {
      unknown0: statSlots(weaponStats(character, equipSlotIds().special)),
    },
    unknown12: {
      unknown0: statSlots(weaponStats(character, equipSlotIds().heavy)),
    },
  };
}

// The character card summary on the select, fireteam roster and inspection
// screens. Member 2 is the equipped emblem's item def index: the select list
// and the roster card read its row of the item display table for the emblem
// art (0xFFFF draws none). Members 0 (f32) and 1 (i32) are copied to the card
// too.
function characterCard(character: CharacterRecord) {
  return {
    unknown0: undefined,
    unknown1: undefined,
    unknown2: character.loadout.equipped(equipSlotIds().emblem)?.defIndex ?? -1,
  };
}

export function selectCharacterCharacter(
  character: CharacterRecord
): SelectCharacterCharacterValue {
  return {
    soid: character.soid,
    unknown1: appearanceEc(character),
    unknown2: appearanceF0(character),
    unknown3: undefined,
    unknown4: gear(character),
    unknown5: characterCard(character),
  };
}

// Peer and roster primaries share one layout. A retail capture sends the same
// 81 bytes for both: soid = account, the signed-in character soid, and both
// i16 tables present and zero.
export function peerPrimary(
  accountSoid: bigint,
  characterSoid: bigint | null
): PeerPrimaryValue {
  return {
    soid: accountSoid,
    characterSoid: characterSoid ?? undefined,
    unknown2: {
      unknown0: Array.from({ length: PEER_PRIMARY_UNKNOWN2_COUNT }, () => 0),
    },
    unknown3: {
      unknown0: Array.from({ length: PEER_PRIMARY_UNKNOWN3_COUNT }, () => 0),
    },
  };
}

export function peerCharacter(character: CharacterRecord): PeerCharacterValue {
  return {
    soid: character.soid,
    unknown1: appearanceEc(character),
    unknown2: appearanceF0(character),
    unknown3: gear(character),
    unknown4: characterCard(character),
  };
}

// A retail capture has one roster member, for the signed-in character, in the
// roster baseline; only the soid and the character card are sent.
export function rosterMember(character: CharacterRecord): RosterMemberValue {
  return {
    soid: character.soid,
    unknown1: undefined,
    unknown2: undefined,
    unknown3: {
      unknown0: undefined,
      unknown1: undefined,
      unknown2: characterCard(character),
    },
    unknown4: undefined,
  };
}

export function inspectionPrimary(
  accountSoid: bigint,
  characterSoid: bigint | null
): InspectionPrimaryValue {
  return { soid: accountSoid, characterSoid: characterSoid ?? 0n };
}

// Appearance, the level row in the progression rows (member 3), the gear and
// the character card (member 11). Members 4-9 are absent.
export function inspectionCharacter(
  character: CharacterRecord
): InspectionCharacterValue {
  return {
    soid: character.soid,
    unknown1: appearanceEc(character),
    unknown2: appearanceF0(character),
    unknown3: { unknown0: characterProgressionRows(character) },
    unknown4: undefined,
    unknown5: undefined,
    unknown6: undefined,
    unknown7: undefined,
    unknown8: undefined,
    unknown9: undefined,
    unknown10: gear(character),
    unknown11: characterCard(character),
  };
}
