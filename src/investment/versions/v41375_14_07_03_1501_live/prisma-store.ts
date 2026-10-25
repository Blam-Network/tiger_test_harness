import { readDebugToggles } from "../../../dev-config/debug-toggles";
import { readItemGrants } from "../../../dev-config/item-grants";
import {
  type character,
  type character_item,
  PrismaClient,
} from "../../../generated/prisma/v41375_14_07_03_1501_live";
import { levelForXp, xpForLevel } from "../../character-level";
import {
  type AccountRecord,
  type CharacterAppearance,
  type CharacterRecord,
  type CharacterStore,
  SOID_TYPE_ACCOUNT,
  SOID_TYPE_CHARACTER,
  SOID_TYPE_ITEM,
  soidFor,
  soidRowId,
} from "../../character-store";
import { planItemGrants } from "../../item-grants";
import {
  CharacterLoadout,
  emptyTalentNodes,
  type LoadoutItem,
  type LoadoutSeed,
  starterItems,
  TALENT_NODE_COUNT,
  weaponStatsFor,
} from "../../loadout";
import { planLoadoutRepair } from "../../loadout-repair";

// character_item.talent_nodes is raw bytes (80801BF3's own wire shape, one
// u8 per node); null reads as untouched.
function decodeTalentNodes(bytes: Buffer | Uint8Array | null): number[] {
  const nodes = emptyTalentNodes();
  if (!bytes) {
    return nodes;
  }
  for (let i = 0; i < Math.min(bytes.length, TALENT_NODE_COUNT); i++) {
    nodes[i] = bytes[i] ?? 0;
  }
  return nodes;
}

function encodeTalentNodes(nodes: readonly number[]): Buffer {
  const bytes = Buffer.alloc(TALENT_NODE_COUNT);
  for (let i = 0; i < TALENT_NODE_COUNT; i++) {
    bytes[i] = nodes[i] ?? 0;
  }
  return bytes;
}

// SQLite-backed store (prisma/v41375_14_07_03_1501_live/schema.prisma).
export class PrismaCharacterStore implements CharacterStore {
  constructor(private readonly prisma: PrismaClient) {}

  private readRows(characterId: number): Promise<character_item[]> {
    return this.prisma.character_item.findMany({
      where: { character_id: characterId },
      orderBy: { id: "asc" },
    });
  }

  // Items live in character_item. A character without rows gets the starter
  // kit on first read. Stored rows are repaired (loadout-repair.ts): stale
  // stub items leave the equip slots, the class kit and starting currency
  // are added and equipped. Dev grants (item-grants.json) the character is
  // still missing come last.
  private async loadoutFor(
    characterId: number,
    classIndex: number
  ): Promise<CharacterLoadout> {
    const read = () => this.readRows(characterId);
    let rows = await read();
    if (rows.length === 0) {
      await this.seedItems(characterId, classIndex);
      rows = await read();
    } else {
      // Kit items a pass adds are equipped by the next one.
      for (let pass = 0; pass < 3; pass++) {
        const { creates, updates } = planLoadoutRepair(
          rows,
          classIndex,
          readDebugToggles().toggles
        );
        if (creates.length === 0 && updates.length === 0) {
          break;
        }
        for (const { id, data } of updates) {
          await this.prisma.character_item.update({ where: { id }, data });
        }
        if (creates.length > 0) {
          await this.prisma.character_item.createMany({
            data: creates.map((seed) => this.itemRow(characterId, seed)),
          });
        }
        rows = await read();
      }
      // Top a stored starter stack up to the current amount (never down) so
      // vendor prices are affordable.
      const starters = new Map(
        starterItems(classIndex)
          .filter((seed) => !seed.instanced)
          .map((seed) => [seed.defIndex, seed.quantity])
      );
      const short = rows.filter(
        (row) =>
          !row.instanced && (starters.get(row.def_index) ?? 0) > row.quantity
      );
      for (const row of short) {
        await this.prisma.character_item.update({
          where: { id: row.id },
          data: { quantity: starters.get(row.def_index) },
        });
      }
      if (short.length > 0) {
        rows = await read();
      }
    }
    rows = await this.applyGrants(characterId, classIndex, rows);
    return CharacterLoadout.fromItems(
      rows.map((row) => ({
        soid: soidFor(SOID_TYPE_ITEM, row.id),
        defIndex: row.def_index,
        bucket: row.bucket,
        sandboxPattern: row.sandbox_pattern,
        artArrangement: row.art_arrangement,
        equipSlot: row.equip_slot,
        instanced: row.instanced,
        quantity: row.quantity,
        power: row.power,
        level: row.level,
        quality: row.quality,
        talentXp: row.talent_xp,
        talentNodes: decodeTalentNodes(
          row.talent_nodes ? Buffer.from(row.talent_nodes) : null
        ),
      }))
    );
  }

  // item-grants.json: insert the grants the character is missing (an equip
  // grant also frees its slot) and re-read. No file, or nothing missing, is
  // a no-op.
  private async applyGrants(
    characterId: number,
    classIndex: number,
    rows: character_item[]
  ): Promise<character_item[]> {
    const plan = planItemGrants(
      rows,
      classIndex,
      soidFor(SOID_TYPE_CHARACTER, characterId),
      readItemGrants().grants
    );
    if (plan.creates.length === 0 && plan.updates.length === 0) {
      return rows;
    }
    for (const { id, data } of plan.updates) {
      await this.prisma.character_item.update({ where: { id }, data });
    }
    if (plan.creates.length > 0) {
      await this.prisma.character_item.createMany({
        data: plan.creates.map((seed) => this.itemRow(characterId, seed)),
      });
    }
    return this.readRows(characterId);
  }

  private async seedItems(
    characterId: number,
    classIndex: number
  ): Promise<void> {
    await this.prisma.character_item.createMany({
      data: starterItems(classIndex).map((seed) =>
        this.itemRow(characterId, seed)
      ),
    });
  }

  private itemRow(characterId: number, seed: LoadoutSeed) {
    return {
      character_id: characterId,
      def_index: seed.defIndex,
      bucket: seed.bucket,
      equip_slot: seed.equipSlot,
      sandbox_pattern: seed.sandboxPattern,
      art_arrangement: seed.artArrangement,
      instanced: seed.instanced,
      quantity: seed.quantity,
      power: seed.power,
      level: seed.level ?? 0,
      quality: seed.quality ?? 0,
    };
  }

  async setItemEquipSlots(
    changes: readonly { equipSlot: number | null; soid: bigint }[]
  ): Promise<void> {
    for (const change of changes) {
      await this.prisma.character_item.update({
        where: { id: soidRowId(change.soid) },
        data: { equip_slot: change.equipSlot },
      });
    }
  }

  async addItem(
    characterSoid: bigint,
    item: LoadoutSeed
  ): Promise<LoadoutItem> {
    const row = await this.prisma.character_item.create({
      data: this.itemRow(soidRowId(characterSoid), item),
    });
    return {
      ...item,
      soid: soidFor(SOID_TYPE_ITEM, row.id),
      stats: weaponStatsFor(item.defIndex),
      talentXp: 0,
      talentNodes: emptyTalentNodes(),
    };
  }

  async setItemQuantity(soid: bigint, quantity: number): Promise<void> {
    await this.prisma.character_item.update({
      where: { id: soidRowId(soid) },
      data: { quantity },
    });
  }

  async setItemTalentNode(
    soid: bigint,
    node: number,
    value: number
  ): Promise<void> {
    const id = soidRowId(soid);
    const row = await this.prisma.character_item.findUnique({
      where: { id },
    });
    const nodes = decodeTalentNodes(
      row?.talent_nodes ? Buffer.from(row.talent_nodes) : null
    );
    nodes[node] = value;
    await this.prisma.character_item.update({
      where: { id },
      data: { talent_nodes: encodeTalentNodes(nodes) },
    });
  }

  async removeItem(soid: bigint): Promise<void> {
    await this.prisma.character_item.delete({
      where: { id: soidRowId(soid) },
    });
  }

  static connect(url: string): PrismaCharacterStore {
    return new PrismaCharacterStore(
      new PrismaClient({ datasources: { db: { url } } })
    );
  }

  disconnect(): Promise<void> {
    return this.prisma.$disconnect();
  }

  async accountForPlatformId(
    platformId: bigint,
    name: string
  ): Promise<AccountRecord> {
    const row = await this.prisma.account.upsert({
      where: { platform_id: platformId.toString() },
      update: {},
      create: { platform_id: platformId.toString(), name },
    });
    return {
      soid: soidFor(SOID_TYPE_ACCOUNT, row.id),
      platformId,
      name: row.name,
    };
  }

  async account(soid: bigint): Promise<AccountRecord | null> {
    const row = await this.prisma.account.findUnique({
      where: { id: soidRowId(soid) },
    });
    return row
      ? {
          soid,
          platformId: BigInt(row.platform_id),
          name: row.name,
        }
      : null;
  }

  async listCharacters(accountSoid: bigint): Promise<CharacterRecord[]> {
    const rows = await this.prisma.character.findMany({
      where: { account_id: soidRowId(accountSoid), deleted_at: null },
      orderBy: { id: "asc" },
    });
    return Promise.all(rows.map((row) => this.toRecord(row)));
  }

  async character(soid: bigint): Promise<CharacterRecord | null> {
    const row = await this.prisma.character.findUnique({
      where: { id: soidRowId(soid) },
    });
    return row && !row.deleted_at ? await this.toRecord(row) : null;
  }

  async createCharacter(
    accountSoid: bigint,
    name: string,
    appearance: CharacterAppearance
  ): Promise<CharacterRecord> {
    const row = await this.prisma.character.create({
      data: {
        account_id: soidRowId(accountSoid),
        name,
        class_index: appearance.classIndex,
        race_index: appearance.race,
        gender_index: appearance.gender,
        face_index: appearance.faceIndex,
        hair_index: appearance.hairIndex,
        feature_index: appearance.featureIndex,
        decal_index: appearance.decalIndex,
        skin_color_index: appearance.skinColor,
        lip_color_index: appearance.lipColor,
        eye_color_index: appearance.eyeColor,
        hair_color_index: appearance.hairColor,
        feature_color_index: appearance.featureColor,
        decal_color_index: appearance.decalColor,
        personality_id: appearance.personalityId,
        helmet_preference: appearance.helmetPreference,
        // A new guardian starts at level 1. The client derives level from
        // XP, so this seeds XP-to-level-1; the `level` column is unread
        // (toRecord always recomputes from XP).
        progression_xp: xpForLevel(1),
        prologue_pending: true,
      },
    });
    await this.seedItems(row.id, appearance.classIndex);
    return this.toRecord(row);
  }

  async completePrologue(soid: bigint): Promise<void> {
    await this.prisma.character.updateMany({
      where: { id: soidRowId(soid) },
      data: { prologue_pending: false },
    });
  }

  async deleteCharacter(soid: bigint): Promise<boolean> {
    const result = await this.prisma.character.updateMany({
      where: { id: soidRowId(soid), deleted_at: null },
      data: { deleted_at: new Date() },
    });
    return result.count > 0;
  }

  async addProgressionXp(soid: bigint, amount: number): Promise<number> {
    const row = await this.prisma.character.update({
      where: { id: soidRowId(soid) },
      data: { progression_xp: { increment: amount } },
    });
    const xp = Math.max(0, row.progression_xp);
    await this.prisma.character.update({
      where: { id: row.id },
      data: { level: levelForXp(xp) },
    });
    return xp;
  }

  async addProgressionZeroXp(soid: bigint, amount: number): Promise<number> {
    const row = await this.prisma.character.update({
      where: { id: soidRowId(soid) },
      data: { progression_zero_xp: { increment: amount } },
    });
    return Math.max(0, row.progression_zero_xp);
  }

  async setCharacterProfile(soid: bigint, profile: Buffer): Promise<void> {
    await this.prisma.character.update({
      where: { id: soidRowId(soid) },
      data: { profile, last_played_at: new Date() },
    });
  }

  private async toRecord(row: character): Promise<CharacterRecord> {
    return {
      soid: soidFor(SOID_TYPE_CHARACTER, row.id),
      accountSoid: soidFor(SOID_TYPE_ACCOUNT, row.account_id),
      name: row.name,
      level: levelForXp(row.progression_xp),
      progressionXp: row.progression_xp,
      progressionZeroXp: row.progression_zero_xp,
      prologuePending: row.prologue_pending,
      loadout: await this.loadoutFor(row.id, row.class_index),
      profile: row.profile ? Buffer.from(row.profile) : null,
      appearance: {
        race: row.race_index,
        gender: row.gender_index,
        classIndex: row.class_index,
        faceIndex: row.face_index,
        hairIndex: row.hair_index,
        featureIndex: row.feature_index,
        decalIndex: row.decal_index,
        skinColor: row.skin_color_index,
        lipColor: row.lip_color_index,
        eyeColor: row.eye_color_index,
        hairColor: row.hair_color_index,
        featureColor: row.feature_color_index,
        decalColor: row.decal_color_index,
        personalityId: row.personality_id,
        helmetPreference: row.helmet_preference,
      },
    };
  }
}
