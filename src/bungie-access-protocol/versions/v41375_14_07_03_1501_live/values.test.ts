import { fnv1 } from "@blamnetwork/bullshcript/destiny1/common";
import { BitReader, decode } from "@blamnetwork/rsat";
import { describe, expect, it } from "vitest";
import { abilityNameHashes, abilityNames } from "../../../content/abilities";
import { equipSlotIds } from "../../../content/inventory";
import { itemDef } from "../../../content/items";
import { levelProgression } from "../../../content/progressions";
import { subclassBuilds } from "../../../content/talent-grids";
import { setDebugTogglesForTest } from "../../../dev-config/debug-toggles";
import {
  characterLevel,
  effectiveLevel,
  levelCap,
  levelForXp,
  progressionRows,
} from "../../../investment/character-level";
import {
  type CharacterRecord,
  MemoryCharacterStore,
} from "../../../investment/character-store";
import {
  CharacterLoadout,
  starterSubclassDef,
} from "../../../investment/loadout";
import { serverPicks } from "../../../investment/stubs/starter-kit";
import { STUB_APPEARANCE } from "../../../investment/stubs/stub-account";
import { describeWithPackages } from "../../../test-support/build";
import {
  buildInspectionBaselineBody,
  buildPeerBaselineBody,
  buildPeerUpdateBody,
  buildRosterBaselineBody,
  buildSelectCharacterBaselineBody,
  buildSelfBaselineBody,
} from "./baselines";
import { characterStats, weaponStats } from "./character-stats";
import { DEFAULT_ORBIT_KEY } from "./character-values";
import { liveBap } from "./live-bap";
import { peerCharacter } from "./values";

describeWithPackages("v41375 values", () => {
  const ACCOUNT = 0x40000000047c6c8dn;
  const CHAR: CharacterRecord = {
    soid: 0x200000000ef5cf7bn,
    accountSoid: ACCOUNT,
    name: "codie",
    appearance: STUB_APPEARANCE,
    level: 1,
    progressionXp: 0,
    progressionZeroXp: 0,
    prologuePending: false,
    loadout: CharacterLoadout.stub(),
    profile: null,
  };

  // type-123 family body (rsat encodeQueuezFamily).
  function readFamily(body: Buffer) {
    const br = new BitReader(body);
    const transactions = br.readNumber(32);
    const familyType = br.readNumber(32);
    const rootSoid = br.read(64);
    const version = br.readNumber(32);
    const flags = br.readNumber(8);
    const count = br.readNumber(32);
    const objects = Array.from({ length: count }, () => {
      const headerChecksum = br.readNumber(32) >>> 0;
      const soid = br.read(64);
      const payload = Buffer.alloc(br.readNumber(32));
      for (let i = 0; i < payload.length; i++) {
        payload[i] = br.readNumber(8);
      }
      return { headerChecksum, soid, payload };
    });
    return { transactions, familyType, rootSoid, version, flags, objects };
  }

  describe("self family", () => {
    it("baseline carries the self primary with soid == accountSoid", () => {
      const family = readFamily(buildSelfBaselineBody(ACCOUNT, ACCOUNT, 1));
      expect(family.familyType).toBe(4);
      expect(family.flags).toBe(1);
      expect(family.objects).toHaveLength(1);
      const [primary] = family.objects;
      expect(primary?.headerChecksum).toBe(0x88190fe1);
      expect(liveBap().queuez.self.SELF_CHECKSUM_PRIMARY).toBe(0x88190fe1);
      expect(primary?.soid).toBe(ACCOUNT);
      const value = decode(
        liveBap().queuez.self.SelfPrimary,
        primary?.payload ?? Buffer.alloc(0)
      );
      expect(value.unknown0.soid).toBe(ACCOUNT);
      expect(value.unknown0.characterSoid).toBeUndefined();
      expect(value.unknown0.unknown8.unknown1.unknown0).toHaveLength(256);
    });

    it("baseline with a character decodes with the schemas", () => {
      const family = readFamily(
        buildSelfBaselineBody(ACCOUNT, ACCOUNT, 2, undefined, CHAR)
      );
      const [primary, character, ...items] = family.objects;
      const p = decode(
        liveBap().queuez.self.SelfPrimary,
        primary?.payload ?? Buffer.alloc(0)
      );
      expect(p.unknown0.characterSoid).toBe(CHAR.soid);
      expect(p.unknown0.roster?.soids).toEqual([CHAR.soid]);

      expect(character?.headerChecksum).toBe(
        liveBap().queuez.self.SELF_CHECKSUM_INVENTORY
      );
      const c = decode(
        liveBap().queuez.self.SelfInventory,
        character?.payload ?? Buffer.alloc(0)
      );
      expect(c.unknown0.soid).toBe(CHAR.soid);
      // Every item sits in its bucket's bag range: an instanced item with its
      // soid, a stack with none and its quantity.
      const bag = c.unknown0.unknown3?.unknown1?.unknown0 ?? [];
      expect(bag).toHaveLength(256);
      for (const item of CHAR.loadout.items) {
        const entry = bag.find(
          (e) =>
            e.unknown0 === item.defIndex &&
            e.unknown1 === (item.instanced ? item.soid : 0n)
        );
        expect(entry?.unknown2).toBe(item.quantity);
      }
      expect(c.unknown0.unknown4?.unknown0).toEqual(
        Array.from(
          { length: 20 },
          (_, slot) => CHAR.loadout.equipped(slot)?.soid ?? 0n
        )
      );

      expect(items.length).toBeGreaterThan(0);
      for (const item of items) {
        expect(item.headerChecksum).toBe(
          liveBap().queuez.self.SELF_CHECKSUM_ITEM
        );
        const v = decode(liveBap().queuez.self.InventoryItem, item.payload);
        expect(v.soid).toBe(item.soid);
        expect(v.defIndex).toBe(
          CHAR.loadout.items.find((i) => i.soid === item.soid)?.defIndex
        );
        // No talent grid / progression row index: a grid the client has not
        // streamed in fails the unlock flag rebuild.
        if (v.unknown4) {
          expect(v.unknown4.unknown2).toBe(-1);
          expect(v.unknown4.unknown0?.unknown3 ?? -1).toBe(-1);
        }
      }
    });

    it("the client reads the character level from the encoded self character", () => {
      const family = readFamily(
        buildSelfBaselineBody(ACCOUNT, ACCOUNT, 2, undefined, CHAR)
      );
      const c = decode(
        liveBap().queuez.self.SelfInventory,
        family.objects[1]?.payload ?? Buffer.alloc(0)
      ).unknown0;
      // Per progression index, the highest level over the rows.
      const levels = new Map<number, number>();
      for (const row of c.unknown7?.unknown0 ?? []) {
        const index = row.unknown3 ?? -1;
        if (index !== -1) {
          const level = levelForXp(row.unknown0 ?? 0);
          levels.set(index, Math.max(levels.get(index) ?? 0, level));
        }
      }
      const level = levels.get(levelProgression().index) ?? 0;
      // The member 16 stat pair for stat 0 wins over gear.
      const stats = c.unknown16?.unknown3;
      const light = stats?.unknown0
        ? (stats.unknown1?.unknown0.find((e) => e.unknown0 === 0)?.unknown1 ??
          0)
        : 0;
      expect(level).toBe(Math.min(characterLevel(), 20));
      expect(effectiveLevel(level, light)).toBe(characterLevel());
    });

    // The self character's 808017B9 names the activity the character last
    // finished: the client launches that activity's next one when [4] turns
    // true (act_cosmo_m0_highway -> cine_reveal).
    it("names the character's finished activity for the client to chain", () => {
      const family = readFamily(
        buildSelfBaselineBody(ACCOUNT, ACCOUNT, 2, undefined, {
          ...CHAR,
          lastActivity: { completed: true, index: 126 },
        })
      );
      const c = decode(
        liveBap().queuez.self.SelfInventory,
        family.objects[1]?.payload ?? Buffer.alloc(0)
      ).unknown0;
      expect(c.unknown5).toEqual({
        unknown0: 126,
        unknown1: -1,
        unknown2: 0,
        unknown3: 0,
        unknown4: true,
      });
    });

    it("sends the orbit_earth orbit key when the client has none", () => {
      const family = readFamily(
        buildSelfBaselineBody(ACCOUNT, ACCOUNT, 2, undefined, CHAR)
      );
      const c = decode(
        liveBap().queuez.self.SelfInventory,
        family.objects[1]?.payload ?? Buffer.alloc(0)
      ).unknown0;
      expect(c.unknown6?.unknown1?.unknown3).toBe(0x35_59_72_9a);
      expect(DEFAULT_ORBIT_KEY).toBe(0x35_59_72_9a);
    });

    it("select_character baseline uses the schemas and checksums", () => {
      const family = readFamily(
        buildSelectCharacterBaselineBody(ACCOUNT, ACCOUNT, 1, undefined, [CHAR])
      );
      expect(family.familyType).toBe(3);
      const [primary, character] = family.objects;
      expect(primary?.headerChecksum).toBe(
        liveBap().queuez.selectCharacter.SELECT_CHARACTER_CHECKSUM_PRIMARY
      );
      expect(
        liveBap().queuez.selectCharacter.SELECT_CHARACTER_CHECKSUM_PRIMARY
      ).toBe(0xa2ac2c74);
      const p = decode(
        liveBap().queuez.selectCharacter.SelectCharacterPrimary,
        primary?.payload ?? Buffer.alloc(0)
      );
      expect(p.roster?.soids).toEqual([CHAR.soid]);
      expect(character?.headerChecksum).toBe(
        liveBap().queuez.selectCharacter.SELECT_CHARACTER_CHECKSUM_CHARACTER
      );
      const c = decode(
        liveBap().queuez.selectCharacter.SelectCharacterCharacter,
        character?.payload ?? Buffer.alloc(0)
      );
      expect(c.soid).toBe(CHAR.soid);
      expect(c.unknown1?.unknown2).toBe(CHAR.appearance.classIndex);
      const slots = c.unknown4?.unknown3?.unknown0 ?? [];
      expect(slots).toHaveLength(20);
      for (const [slot, entry] of slots.entries()) {
        expect(entry.unknown0).toBe(CHAR.loadout.equipped(slot)?.soid ?? 0n);
      }
    });
  });

  // 2.3.1 capture: the peer and roster primaries are the same 81 bytes for this
  // account / character pair.
  const CAPTURED_PEER_PRIMARY =
    "a0000000023e3646c800000003bd73def000100010001000100010001000100010001000100010001000100010001000100010001000100010001000100010001000100010001800080008000800080000";

  describe("peer / roster / inspection families", () => {
    it("peer baseline: primary + character, checksums", () => {
      const family = readFamily(
        buildPeerBaselineBody(ACCOUNT, ACCOUNT, 3, undefined, CHAR)
      );
      expect(family.familyType).toBe(0);
      expect(family.flags).toBe(1);
      const [primary, character, ...rest] = family.objects;
      expect(rest).toEqual([]);
      expect(primary?.headerChecksum).toBe(
        liveBap().queuez.peer.PEER_CHECKSUM_PRIMARY
      );
      expect(liveBap().queuez.peer.PEER_CHECKSUM_PRIMARY).toBe(0x1d7bb8f6);
      expect(primary?.payload.toString("hex")).toBe(CAPTURED_PEER_PRIMARY);
      const p = decode(
        liveBap().queuez.peer.PeerPrimary,
        primary?.payload ?? Buffer.alloc(0)
      );
      expect(p.soid).toBe(ACCOUNT);
      expect(p.characterSoid).toBe(CHAR.soid);

      expect(character?.headerChecksum).toBe(
        liveBap().queuez.peer.PEER_CHECKSUM_CHARACTER
      );
      expect(character?.soid).toBe(CHAR.soid);
      const c = decode(
        liveBap().queuez.peer.PeerCharacter,
        character?.payload ?? Buffer.alloc(0)
      );
      expect(c.soid).toBe(CHAR.soid);
      expect(c.unknown1?.unknown2).toBe(CHAR.appearance.classIndex);
      const slots = c.unknown3?.unknown3?.unknown0 ?? [];
      expect(slots).toHaveLength(20);
      for (const [slot, entry] of slots.entries()) {
        expect(entry.unknown0).toBe(CHAR.loadout.equipped(slot)?.soid ?? 0n);
      }
    });

    it("equips the starter emblem in slot 12", () => {
      const family = readFamily(
        buildPeerBaselineBody(ACCOUNT, ACCOUNT, 3, undefined, CHAR)
      );
      const c = decode(
        liveBap().queuez.peer.PeerCharacter,
        family.objects[1]?.payload ?? Buffer.alloc(0)
      );
      const emblem = c.unknown3?.unknown3?.unknown0[equipSlotIds().emblem];
      expect(emblem?.unknown0).toBe(
        CHAR.loadout.equipped(equipSlotIds().emblem)?.soid
      );
      expect(emblem?.unknown1).toBe(serverPicks()[equipSlotIds().emblem]);
    });

    it("puts the equipped emblem on every character card", () => {
      const payload = (body: Buffer, index: number) =>
        readFamily(body).objects[index]?.payload ?? Buffer.alloc(0);
      const select = decode(
        liveBap().queuez.selectCharacter.SelectCharacterCharacter,
        payload(
          buildSelectCharacterBaselineBody(ACCOUNT, ACCOUNT, 1, undefined, [
            CHAR,
          ]),
          1
        )
      );
      const peer = decode(
        liveBap().queuez.peer.PeerCharacter,
        payload(buildPeerBaselineBody(ACCOUNT, ACCOUNT, 1, undefined, CHAR), 1)
      );
      const roster = decode(
        liveBap().queuez.roster.RosterMember,
        payload(
          buildRosterBaselineBody(ACCOUNT, ACCOUNT, 1, undefined, CHAR),
          1
        )
      );
      const inspection = decode(
        liveBap().queuez.inspection.InspectionCharacter,
        payload(
          buildInspectionBaselineBody(ACCOUNT, ACCOUNT, 1, undefined, CHAR),
          1
        )
      );
      for (const card of [
        select.unknown5,
        peer.unknown4,
        roster.unknown3?.unknown2,
        inspection.unknown11,
      ]) {
        expect(card?.unknown2).toBe(serverPicks()[equipSlotIds().emblem]);
      }
    });

    it("gear slots carry each def's own sandbox pattern", () => {
      const family = readFamily(
        buildPeerBaselineBody(ACCOUNT, ACCOUNT, 1, undefined, CHAR)
      );
      const peer = decode(
        liveBap().queuez.peer.PeerCharacter,
        family.objects[1]?.payload ?? Buffer.alloc(0)
      );
      const slots = peer.unknown3?.unknown3?.unknown0 ?? [];
      for (const [slot, entry] of slots.entries()) {
        const item = CHAR.loadout.equipped(slot);
        expect(entry.unknown1).toBe(item?.defIndex ?? -1);
        // Armour, subclass and emblem have none (-1), as in the 2.3.1
        // capture; so do empty slots.
        expect(entry.unknown2).toBe(
          item ? itemDef(item.defIndex)?.sandboxPattern : -1
        );
      }
      // Khvostov 7G-02's weapon pattern.
      expect(slots[equipSlotIds().primary]?.unknown2).toBe(22);
    });

    it("sends no emblem on the card when none is equipped", () => {
      const loadout = CharacterLoadout.stub();
      const emblem = loadout.equipped(equipSlotIds().emblem);
      loadout.unequip(emblem!.soid);
      const family = readFamily(
        buildPeerBaselineBody(ACCOUNT, ACCOUNT, 1, undefined, {
          ...CHAR,
          loadout,
        })
      );
      const peer = decode(
        liveBap().queuez.peer.PeerCharacter,
        family.objects[1]?.payload ?? Buffer.alloc(0)
      );
      expect(peer.unknown4?.unknown2).toBe(-1);
    });

    it("peer baseline without a character has only the primary", () => {
      const family = readFamily(buildPeerBaselineBody(ACCOUNT, ACCOUNT, 1));
      expect(family.objects).toHaveLength(1);
      const p = decode(
        liveBap().queuez.peer.PeerPrimary,
        family.objects[0]?.payload ?? Buffer.alloc(0)
      );
      expect(p.characterSoid).toBeUndefined();
    });

    it("peer delta carries the peer character", () => {
      const family = readFamily(buildPeerUpdateBody(ACCOUNT, 4, CHAR));
      expect(family.flags).toBe(0);
      const [character] = family.objects;
      expect(character?.headerChecksum).toBe(
        liveBap().queuez.peer.PEER_CHECKSUM_CHARACTER
      );
      expect(
        decode(
          liveBap().queuez.peer.PeerCharacter,
          character?.payload ?? Buffer.alloc(0)
        ).soid
      ).toBe(CHAR.soid);
    });

    it("roster baseline: primary (captured bytes) + the character's roster member", () => {
      const family = readFamily(
        buildRosterBaselineBody(ACCOUNT, ACCOUNT, 2, undefined, CHAR)
      );
      expect(family.familyType).toBe(2);
      expect(family.version).toBe(2);
      const [primary, member, ...rest] = family.objects;
      expect(rest).toEqual([]);
      expect(primary?.headerChecksum).toBe(
        liveBap().queuez.roster.ROSTER_CHECKSUM_PRIMARY
      );
      expect(liveBap().queuez.roster.ROSTER_CHECKSUM_PRIMARY).toBe(0x3e3ace74);
      expect(primary?.payload.toString("hex")).toBe(CAPTURED_PEER_PRIMARY);
      const p = decode(
        liveBap().queuez.roster.RosterPrimary,
        primary?.payload ?? Buffer.alloc(0)
      );
      expect(p.characterSoid).toBe(CHAR.soid);
      expect(member?.headerChecksum).toBe(
        liveBap().queuez.roster.ROSTER_CHECKSUM_MEMBER
      );
      expect(
        decode(
          liveBap().queuez.roster.RosterMember,
          member?.payload ?? Buffer.alloc(0)
        ).soid
      ).toBe(CHAR.soid);
    });

    it("inspection baseline: primary + character, checksums", () => {
      const family = readFamily(
        buildInspectionBaselineBody(ACCOUNT, ACCOUNT, 1, undefined, CHAR)
      );
      expect(family.familyType).toBe(1);
      const [primary, character] = family.objects;
      expect(primary?.headerChecksum).toBe(
        liveBap().queuez.inspection.INSPECTION_CHECKSUM_PRIMARY
      );
      const p = decode(
        liveBap().queuez.inspection.InspectionPrimary,
        primary?.payload ?? Buffer.alloc(0)
      );
      expect(p).toEqual({ soid: ACCOUNT, characterSoid: CHAR.soid });
      expect(character?.headerChecksum).toBe(
        liveBap().queuez.inspection.INSPECTION_CHECKSUM_CHARACTER
      );
      const c = decode(
        liveBap().queuez.inspection.InspectionCharacter,
        character?.payload ?? Buffer.alloc(0)
      );
      expect(c.soid).toBe(CHAR.soid);
      // Progression rows: the level row first, then the zero rows the
      // client dereferences unchecked (progressionRows).
      const rows = c.unknown3?.unknown0 ?? [];
      expect(rows.map((r) => r.unknown3)).toEqual(
        progressionRows().map((r) => r.unknown3)
      );
      expect(rows[0]?.unknown3).toBe(levelProgression().index);
      expect(c.unknown10?.unknown3?.unknown0).toHaveLength(20);
    });
  });

  // Grenade, super, melee, jump, movement per wire class (starter subclass).
  const STARTER_ABILITIES: Record<number, readonly string[]> = {
    // Striker
    0: [
      "ability_pulse_arc",
      "ability_fist_of_havoc",
      "ability_titan_melee",
      "ability_lift",
      "ability_sprint",
    ],
    // Gunslinger
    1: [
      "ability_pulse_thermal",
      "ability_ghost_gun",
      "ability_hunter_melee",
      "ability_double_jump",
      "ability_sprint",
    ],
    // Voidwalker
    2: [
      "ability_flare_void",
      "ability_nova_bomb",
      "ability_warlock_melee",
      "ability_glide",
      "ability_sprint",
    ],
  };

  function characterOfClass(classIndex: number): CharacterRecord {
    return {
      ...CHAR,
      appearance: { ...STUB_APPEARANCE, classIndex },
      loadout: CharacterLoadout.stub(classIndex),
    };
  }

  function peerGear(character: CharacterRecord) {
    const family = readFamily(
      buildPeerBaselineBody(ACCOUNT, ACCOUNT, 1, undefined, character)
    );
    return decode(
      liveBap().queuez.peer.PeerCharacter,
      family.objects[1]?.payload ?? Buffer.alloc(0)
    ).unknown3;
  }

  const gearAbilityNames = (gear: ReturnType<typeof peerGear>) =>
    (gear?.unknown1?.unknown0 ?? []).map(
      (entry) => abilityNames()[entry.unknown0 ?? -1]
    );

  describe("subclass abilities", () => {
    it("ability names are the table's hashes", () => {
      const hashes = abilityNameHashes();
      expect(abilityNames()).toHaveLength(hashes.length);
      for (const [index, name] of abilityNames().entries()) {
        if (name !== "unknown") {
          expect(fnv1(name)).toBe(hashes[index]);
        }
      }
      // The one ability whose name is not known.
      expect(abilityNames().indexOf("unknown")).toBe(14);
      expect(hashes[14]).toBe(0x93_13_63_77);
    });

    it("every subclass build puts each ability kind in its own slot", () => {
      // The six subclasses, in def order (Striker 774 .. Sunsinger 778 are spot
      // rows; the table need not list every def).
      const defs = [...subclassBuilds().keys()];
      expect(defs).toHaveLength(6);
      expect(defs).toEqual(expect.arrayContaining([774, 778]));
      expect(defs).toEqual([...defs].sort((a, b) => a - b));
      const melee = ["titan", "hunter", "warlock"].map(
        (c) => `ability_${c}_melee`
      );
      for (const build of subclassBuilds().values()) {
        const [grenade, , hit, , movement] = build.abilities.map(
          (i) => abilityNames()[i] ?? ""
        );
        // Element grenades are 15..32.
        expect(build.abilities[0]).toBeGreaterThanOrEqual(15);
        expect(grenade).toMatch(/_(arc|thermal|void)$/);
        expect(melee).toContain(hit);
        expect(movement).toBe("ability_sprint");
        expect(build.abilities.every((i) => i >= 0 && i < 33)).toBe(true);
        // Base perks from the auto-granted node.
        expect(build.perks).toEqual(expect.arrayContaining([45, 46, 47]));
      }
    });

    it("binds each class's starter subclass in the peer gear block", () => {
      for (const classIndex of [0, 1, 2]) {
        const character = characterOfClass(classIndex);
        expect(
          character.loadout.equipped(equipSlotIds().subclass)?.defIndex
        ).toBe(starterSubclassDef(classIndex));
        const gear = peerGear(character);
        expect(gearAbilityNames(gear)).toEqual(STARTER_ABILITIES[classIndex]);
        const build = subclassBuilds().get(starterSubclassDef(classIndex));
        const perks = gear?.unknown5?.unknown0 ?? [];
        expect(perks).toHaveLength(26);
        expect(perks.filter((p) => p !== -1)).toEqual(build?.perks);
      }
    });

    it("select and inspection carry the same bindings", () => {
      const payload = (body: Buffer) =>
        readFamily(body).objects[1]?.payload ?? Buffer.alloc(0);
      const select = decode(
        liveBap().queuez.selectCharacter.SelectCharacterCharacter,
        payload(
          buildSelectCharacterBaselineBody(ACCOUNT, ACCOUNT, 1, undefined, [
            CHAR,
          ])
        )
      );
      const inspection = decode(
        liveBap().queuez.inspection.InspectionCharacter,
        payload(
          buildInspectionBaselineBody(ACCOUNT, ACCOUNT, 1, undefined, CHAR)
        )
      );
      expect(gearAbilityNames(select.unknown4)).toEqual(STARTER_ABILITIES[2]);
      expect(gearAbilityNames(inspection.unknown10)).toEqual(
        STARTER_ABILITIES[2]
      );
    });

    it("follows the equipped subclass, else the class's starter", () => {
      const loadout = CharacterLoadout.stub(2);
      const subclass = loadout.equipped(equipSlotIds().subclass);
      loadout.unequip(subclass!.soid);
      const unequipped = peerGear({ ...CHAR, loadout });
      expect(gearAbilityNames(unequipped)).toEqual(STARTER_ABILITIES[2]);

      // Sunsinger (778) equipped on the warlock.
      const sunsinger = CharacterLoadout.stub(2);
      sunsinger.items.find((i) => i.soid === subclass!.soid)!.defIndex = 778;
      expect(
        gearAbilityNames(peerGear({ ...CHAR, loadout: sunsinger }))
      ).toEqual([
        "ability_flare_thermal",
        "ability_radiance",
        "ability_warlock_melee",
        "ability_glide",
        "ability_sprint",
      ]);
    });
  });

  describe("last activity", () => {
    // 808017B9 member 0 is an activity index the client looks up without a
    // bounds check; the equipped helmet's art arrangement must not go there
    // (art >= 468 crashes the client).
    it("sends no activity until the character ran one, whatever helmet is on", () => {
      const loadout = CharacterLoadout.stub();
      const helmet = loadout.equipped(equipSlotIds().helmet)!;
      // Light Beyond Nemesis, art 997.
      helmet.defIndex = 1256;
      helmet.artArrangement = 997;
      const read = (character: CharacterRecord) =>
        decode(
          liveBap().queuez.self.SelfInventory,
          readFamily(
            buildSelfBaselineBody(ACCOUNT, ACCOUNT, 2, undefined, character)
          ).objects[1]?.payload ?? Buffer.alloc(0)
        ).unknown0.unknown5;
      expect(read({ ...CHAR, loadout })).toEqual({
        unknown0: -1,
        unknown1: -1,
        unknown2: 0,
        unknown3: 0,
        unknown4: false,
      });
      expect(
        read({
          ...CHAR,
          loadout,
          lastActivity: { index: 125, completed: true },
        })
      ).toEqual({
        unknown0: 125,
        unknown1: -1,
        unknown2: 0,
        unknown3: 0,
        unknown4: true,
      });
    });
  });

  describe("item primary stat", () => {
    // 80801711 {i32 level, i32 required level, i16 quality}: the client's
    // Attack / Defense inputs (investment/primary-stat.ts).
    it("items replicate level, required level and quality", () => {
      const loadout = CharacterLoadout.stub();
      const heavy = loadout.heavy!;
      heavy.level = 20;
      heavy.quality = 62;
      const family = readFamily(
        buildSelfBaselineBody(ACCOUNT, ACCOUNT, 2, undefined, {
          ...CHAR,
          loadout,
        })
      );
      const item = (soid: bigint) =>
        decode(
          liveBap().queuez.self.InventoryItem,
          family.objects.find((o) => o.soid === soid)?.payload ??
            Buffer.alloc(0)
        );
      // A granted heavy: Baron RS/2's def needs no level to equip.
      expect(item(heavy.soid).unknown2).toEqual({
        unknown0: 20,
        unknown1: 0,
        unknown2: 62,
      });
      // The kit's Khvostov keeps its def's level block.
      const khvostov = itemDef(loadout.primary!.defIndex)!;
      expect(item(loadout.primary!.soid).unknown2).toEqual({
        unknown0: khvostov.level,
        unknown1: khvostov.level,
        unknown2: khvostov.quality,
      });
    });

    it("debug-toggles.json grantLevelQuality overrides every item's values", () => {
      const loadout = CharacterLoadout.stub();
      const heavy = loadout.heavy!;
      heavy.level = 20;
      heavy.quality = 62;
      const encoded = () => {
        const family = readFamily(
          buildSelfBaselineBody(ACCOUNT, ACCOUNT, 2, undefined, {
            ...CHAR,
            loadout,
          })
        );
        return decode(
          liveBap().queuez.self.InventoryItem,
          family.objects.find((o) => o.soid === heavy.soid)?.payload ??
            Buffer.alloc(0)
        ).unknown2;
      };
      try {
        setDebugTogglesForTest({ grantLevelQuality: "zero" });
        expect(encoded()).toEqual({ unknown0: 0, unknown1: 0, unknown2: 0 });
        setDebugTogglesForTest({ grantLevelQuality: "def" });
        const def = itemDef(heavy.defIndex)!;
        expect(encoded()).toEqual({
          unknown0: def.level,
          unknown1: def.level,
          unknown2: def.quality,
        });
      } finally {
        setDebugTogglesForTest(undefined);
      }
      expect(encoded()).toEqual({ unknown0: 20, unknown1: 0, unknown2: 62 });
    });
  });

  // Member 9 and the weapon blocks are character-stats.ts's, in slot order and
  // padded with {-1, 0}.
  describe("gear block stats", () => {
    it("sends the character and weapon stats", async () => {
      const store = new MemoryCharacterStore();
      const account = await store.accountForPlatformId(1n, "guardian");
      const character = await store.createCharacter(
        account.soid,
        "guardian",
        STUB_APPEARANCE
      );
      const gear = peerCharacter(character).unknown3;
      const pairs = (slots: { unknown0?: number; unknown1?: number }[] = []) =>
        slots
          .filter((slot) => slot.unknown0 !== -1)
          .map((slot) => [slot.unknown0, slot.unknown1]);
      expect(pairs(gear?.unknown9?.unknown0)).toEqual(
        characterStats(character)
      );
      expect(pairs(gear?.unknown10?.unknown0)).toEqual(
        weaponStats(character, equipSlotIds().primary)
      );
      expect(gear?.unknown9?.unknown0).toHaveLength(16);
      expect(gear?.unknown0).toBe(Math.min(characterLevel(), levelCap()));
    });
  });
});
