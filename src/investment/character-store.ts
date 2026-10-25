// Accounts and characters behind the login flow. The server uses the SQLite
// store of each build (versions/<build>/prisma-store.ts); the in-memory store
// here backs the tests.

import { levelForXp, xpForLevel } from "./character-level";
import {
  CharacterLoadout,
  emptyTalentNodes,
  type LoadoutItem,
  type LoadoutSeed,
  weaponStatsFor,
} from "./loadout";

// Server object ids: top 32 bits = object type, low 32 bits = row id.
export const SOID_TYPE_ACCOUNT = 1n;
export const SOID_TYPE_CHARACTER = 2n;
export const SOID_TYPE_ITEM = 3n;

export function soidFor(type: bigint, id: number | bigint): bigint {
  return (type << 32n) | (BigInt(id) & 0xffffffffn);
}

export function soidRowId(soid: bigint): number {
  return Number(soid & 0xffffffffn);
}

// 808018EC + 808018F0 as the client sends them in login_create_character.
// Indices are investment globals option indices; classIndex is the wire value
// (0 titan, 1 hunter, 2 warlock).
export interface CharacterAppearance {
  classIndex: number;
  decalColor: number;
  decalIndex: number;
  eyeColor: number;
  faceIndex: number;
  featureColor: number;
  featureIndex: number;
  gender: number;
  hairColor: number;
  hairIndex: number;
  helmetPreference: number;
  lipColor: number;
  personalityId: number;
  race: number;
  skinColor: number;
}

export interface AccountRecord {
  name: string;
  platformId: bigint;
  soid: bigint;
}

export interface CharacterRecord {
  accountSoid: bigint;
  appearance: CharacterAppearance;
  // The last activity this character finished, and whether it finished it,
  // as the self character tells the client (808017B9). Not persisted: only
  // the chain to the next activity reads it.
  lastActivity?: { completed: boolean; index: number };
  level: number;
  // Equipped items and bag.
  loadout: CharacterLoadout;
  name: string;
  // 808019F3 body from profile_set_character_profile (702), if ever sent.
  profile: Buffer | null;
  // XP of the level progression; `level` is derived from it.
  progressionXp: number;
  // Points of progression 0, a one-time item reward (BapBuild.progressionZero).
  // Zero in a build that doesn't grant it.
  progressionZeroXp: number;
  // New character that hasn't finished the Cosmodrome prologue yet.
  prologuePending: boolean;
  soid: bigint;
}

export interface CharacterStore {
  account(soid: bigint): Promise<AccountRecord | null>;
  // Upsert by platform id (Xbox XUID); name is the gamertag.
  accountForPlatformId(
    platformId: bigint,
    name: string
  ): Promise<AccountRecord>;
  // Vendor purchase / sale: insert a new row (instanced item or a fresh
  // stack) and return it with the soid the store minted.
  addItem(characterSoid: bigint, item: LoadoutSeed): Promise<LoadoutItem>;
  // Add XP to the level progression and return the character's new total.
  addProgressionXp(soid: bigint, amount: number): Promise<number>;
  // Add points to progression 0 and return the character's new total.
  addProgressionZeroXp(soid: bigint, amount: number): Promise<number>;
  character(soid: bigint): Promise<CharacterRecord | null>;
  // The character finished the prologue mission (act_cosmo_m0_highway).
  completePrologue(soid: bigint): Promise<void>;
  createCharacter(
    accountSoid: bigint,
    name: string,
    appearance: CharacterAppearance
  ): Promise<CharacterRecord>;
  deleteCharacter(soid: bigint): Promise<boolean>;
  listCharacters(accountSoid: bigint): Promise<CharacterRecord[]>;
  // Delete a row entirely (a sold-out stack or a sold instanced item).
  removeItem(soid: bigint): Promise<void>;
  setCharacterProfile(soid: bigint, profile: Buffer): Promise<void>;
  // Persist equip slot changes made on a CharacterRecord.loadout.
  setItemEquipSlots(
    changes: readonly { equipSlot: number | null; soid: bigint }[]
  ): Promise<void>;
  // Update a stack's quantity in place (purchase merge, currency credit/debit).
  setItemQuantity(soid: bigint, quantity: number): Promise<void>;
  // Persist one 80801BF3 activated-step count (talent_grid_activate_step /
  // talent_grid_binary_swap).
  setItemTalentNode(soid: bigint, node: number, value: number): Promise<void>;
}

export const CharacterStoreToken = Symbol("CharacterStore");

export class MemoryCharacterStore implements CharacterStore {
  private readonly accounts = new Map<bigint, AccountRecord>();
  private readonly characters = new Map<bigint, CharacterRecord>();
  private nextAccountId = 1;
  private nextCharacterId = 1;
  // Far past the stub's fixed item soids (loadout.ts ITEM_SOID_BASE +
  // slot/bag-item indices) so minted items never collide with them.
  private nextItemId = 1_000_000;

  async accountForPlatformId(
    platformId: bigint,
    name: string
  ): Promise<AccountRecord> {
    for (const account of this.accounts.values()) {
      if (account.platformId === platformId) {
        return account;
      }
    }
    const account: AccountRecord = {
      soid: soidFor(SOID_TYPE_ACCOUNT, this.nextAccountId++),
      platformId,
      name,
    };
    this.accounts.set(account.soid, account);
    return account;
  }

  async account(soid: bigint): Promise<AccountRecord | null> {
    return this.accounts.get(soid) ?? null;
  }

  async listCharacters(accountSoid: bigint): Promise<CharacterRecord[]> {
    return [...this.characters.values()].filter(
      (c) => c.accountSoid === accountSoid
    );
  }

  async character(soid: bigint): Promise<CharacterRecord | null> {
    return this.characters.get(soid) ?? null;
  }

  async createCharacter(
    accountSoid: bigint,
    name: string,
    appearance: CharacterAppearance
  ): Promise<CharacterRecord> {
    const progressionXp = xpForLevel(1);
    const record: CharacterRecord = {
      soid: soidFor(SOID_TYPE_CHARACTER, this.nextCharacterId++),
      accountSoid,
      name,
      appearance,
      level: levelForXp(progressionXp),
      progressionXp,
      progressionZeroXp: 0,
      prologuePending: true,
      loadout: CharacterLoadout.stub(appearance.classIndex),
      profile: null,
    };
    this.characters.set(record.soid, record);
    return record;
  }

  async deleteCharacter(soid: bigint): Promise<boolean> {
    return this.characters.delete(soid);
  }

  async completePrologue(soid: bigint): Promise<void> {
    const record = this.characters.get(soid);
    if (record) {
      record.prologuePending = false;
    }
  }

  async addProgressionXp(soid: bigint, amount: number): Promise<number> {
    const record = this.characters.get(soid);
    if (!record) {
      return 0;
    }
    record.progressionXp = Math.max(0, record.progressionXp + amount);
    record.level = levelForXp(record.progressionXp);
    return record.progressionXp;
  }

  async addProgressionZeroXp(soid: bigint, amount: number): Promise<number> {
    const record = this.characters.get(soid);
    if (!record) {
      return 0;
    }
    record.progressionZeroXp = Math.max(0, record.progressionZeroXp + amount);
    return record.progressionZeroXp;
  }

  async setCharacterProfile(soid: bigint, profile: Buffer): Promise<void> {
    const record = this.characters.get(soid);
    if (record) {
      record.profile = profile;
    }
  }

  async setItemEquipSlots(): Promise<void> {}

  async addItem(
    _characterSoid: bigint,
    item: LoadoutSeed
  ): Promise<LoadoutItem> {
    // Callers (vendor.ts, loot.ts) already push the returned row onto
    // character.loadout themselves, so it must not be pushed here too.
    return {
      ...item,
      soid: soidFor(SOID_TYPE_ITEM, this.nextItemId++),
      stats: weaponStatsFor(item.defIndex),
      talentXp: 0,
      talentNodes: emptyTalentNodes(),
    };
  }

  async setItemQuantity(soid: bigint, quantity: number): Promise<void> {
    for (const record of this.characters.values()) {
      const item = record.loadout.item(soid);
      if (item) {
        item.quantity = quantity;
        return;
      }
    }
  }

  async setItemTalentNode(
    soid: bigint,
    node: number,
    value: number
  ): Promise<void> {
    for (const record of this.characters.values()) {
      if (record.loadout.setTalentNode(soid, node, value)) {
        return;
      }
    }
  }

  async removeItem(soid: bigint): Promise<void> {
    for (const record of this.characters.values()) {
      record.loadout.removeItem(soid);
    }
  }
}
