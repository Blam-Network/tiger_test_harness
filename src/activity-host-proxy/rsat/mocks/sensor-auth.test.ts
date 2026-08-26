import { BitReader, decode } from "@blamnetwork/rsat";
import { describe, expect, it } from "vitest";
import { ActivityBundleItemType } from "../../../tags/types";
import {
  HardWipeGlobalsAuth,
  LifetimeAuth,
  PlayerAuth,
  SensorClientRef,
} from "../schemas/sensor";
import {
  buildSensorAuthTickRsat,
  buildTowerLeftoverSenseEntries,
  buildTowerSensorAuthRsat,
  buildTowerSpawnSenseEntries,
  encodeFireteamAuth,
  encodeHardWipeGlobalsAuth,
  encodeLifetimeAuth,
  encodeObjectAuth,
  encodeObjectFilterAuth,
  encodePlayerAuth,
  encodePlayerObjectiveAuth,
  encodeSafeZoneAuth,
  encodeScoreboardAuth,
  encodeSensorClientRef,
  encodeSquadAuth,
  encodeSquadSense,
  encodeTimerAuth,
  LIFETIME_STATE_SPAWN_READY,
  playerKeyFromCharacter,
  SLICE_BUNDLE,
  SPAWN_BUNDLE,
  SPAWN_LIFETIME_INDEX,
  SPAWN_OCCUPIED_PLAYER_INDEX,
  senseEntryPayloadBits,
  TOWER_TYPE1_COUNTS,
  TOWER_TYPE1_ROW_COUNT,
} from "./sensor-auth";

describe("SensorAuth RSAT", () => {
  it("encodes 8080046B as 54 bits", () => {
    const bits = encodeSensorClientRef({
      bundle: SPAWN_BUNDLE,
      typeId: ActivityBundleItemType.Player,
      typeIndex: SPAWN_OCCUPIED_PLAYER_INDEX,
    });
    expect(bits.bitCount).toBe(54);
    const parsed = decode(SensorClientRef, bits.bytes);
    expect(parsed.bundle >>> 0).toBe(SPAWN_BUNDLE);
    expect(parsed.typeId).toBe(ActivityBundleItemType.Player);
    expect(parsed.typeIndex).toBe(SPAWN_OCCUPIED_PLAYER_INDEX);
  });

  it("encodes type-12 auth as 174 bits with the identity key", () => {
    const key = 0x0000_0002_0000_0002n;
    const bits = encodePlayerAuth(key);
    expect(bits.bitCount).toBe(174);
    const parsed = decode(PlayerAuth, bits.bytes);
    expect(parsed.key).toBe(key);
  });

  it("encodes lifetime auth as 106 bits with spawn-ready state 2", () => {
    const bits = encodeLifetimeAuth();
    expect(bits.bitCount).toBe(106);
    const parsed = decode(LifetimeAuth, bits.bytes);
    expect(parsed.state).toBe(LIFETIME_STATE_SPAWN_READY);
    expect(parsed.flag1).toBe(true);
    expect(parsed.phaseIndex).toBe(3);
    expect(parsed.phaseHash >>> 0).toBe(0x45bc13ac);
    expect(parsed.field4).toBe(21);
  });

  it("encodes type-1 roster count 1 as 50 body bits", () => {
    const bits = encodeSquadAuth(1);
    expect(bits.bitCount).toBe(50);
  });

  it("plaza #2 postmaster is definition count 2", () => {
    expect(TOWER_TYPE1_COUNTS.get(2)).toBe(2);
    expect(encodeSquadAuth(2).bitCount).toBe(82);
  });

  it("encodes type-1 roster count 0 as 18 body bits", () => {
    const bits = encodeSquadAuth(0);
    expect(bits.bitCount).toBe(18);
  });

  it("encodes type-1 Phase A sense count 1 as 48 body bits", () => {
    const bits = encodeSquadSense(1, false);
    expect(bits.bitCount).toBe(48);
  });

  it("encodes leftover dirty-0 Some at XWS widths", () => {
    expect(encodeScoreboardAuth().bitCount).toBe(19);
    expect(encodeHardWipeGlobalsAuth().bitCount).toBe(193);
    decode(HardWipeGlobalsAuth, encodeHardWipeGlobalsAuth().bytes);
    expect(encodeTimerAuth().bitCount).toBe(226);
    expect(encodeFireteamAuth().bitCount).toBe(101);
    expect(encodeObjectAuth().bitCount).toBe(91);
    expect(encodeSafeZoneAuth().bitCount).toBe(86);
    expect(encodeObjectFilterAuth().bitCount).toBe(4);
    expect(encodePlayerObjectiveAuth().bitCount).toBe(2617);
  });

  it("grant packet is identity + every social type-1 bank", () => {
    const key = playerKeyFromCharacter(0x200000002n);
    const entries = buildTowerSpawnSenseEntries(key);
    expect(entries[0]?.clientRef).toEqual({
      bundle: SPAWN_BUNDLE,
      typeId: ActivityBundleItemType.Lifetime,
      typeIndex: SPAWN_LIFETIME_INDEX,
    });
    expect(senseEntryPayloadBits(entries[0]!).length).toBe(2 + 106);
    expect(entries).toHaveLength(17 + TOWER_TYPE1_ROW_COUNT);
    expect(TOWER_TYPE1_COUNTS.get(2)).toBe(2);
    const type1Bundles = new Set(
      entries
        .filter((e) => e.clientRef.typeId === ActivityBundleItemType.Squad)
        .map((e) => e.clientRef.bundle)
    );
    expect([...type1Bundles].sort()).toEqual(
      [0x19d43443, 0x8cc31436, 0x8d3f1166, 0xaa891b91].sort()
    );
    expect(
      entries.some((e) => e.clientRef.typeId === ActivityBundleItemType.Actor)
    ).toBe(false);
  });

  it("full bank puts type-1 before leftover Some", () => {
    const key = playerKeyFromCharacter(0x200000002n);
    const entries = buildTowerSpawnSenseEntries(key, true);
    const firstSquad = entries.findIndex(
      (e) => e.clientRef.typeId === ActivityBundleItemType.Squad
    );
    const firstLeftover = entries.findIndex(
      (e) =>
        e.clientRef.typeId === ActivityBundleItemType.Scoreboard ||
        e.clientRef.typeId === ActivityBundleItemType.HardWipeGlobals
    );
    expect(firstSquad).toBeGreaterThanOrEqual(0);
    expect(firstLeftover).toBeGreaterThan(firstSquad);
    expect(entries).toHaveLength(17 + TOWER_TYPE1_ROW_COUNT + 43);
    const type2 = entries.filter(
      (e) => e.clientRef.typeId === ActivityBundleItemType.Actor
    );
    expect(type2).toHaveLength(30);
    expect(type2.every((e) => (e.authBits ?? 0) === 0)).toBe(true);
  });

  it("hub leftover packet is 4786/F2D Some plus type-2 None", () => {
    const key = playerKeyFromCharacter(0x200000002n);
    const entries = buildTowerSpawnSenseEntries(key, "hub", true);
    const leftovers = entries.filter(
      (e) =>
        e.clientRef.typeId !== ActivityBundleItemType.Lifetime &&
        e.clientRef.typeId !== ActivityBundleItemType.Player &&
        e.clientRef.typeId !== ActivityBundleItemType.Squad
    );
    expect(leftovers).toHaveLength(5 + 30);
    const some = leftovers.filter((e) => (e.authBits ?? 0) > 0);
    const type2 = leftovers.filter(
      (e) => e.clientRef.typeId === ActivityBundleItemType.Actor
    );
    expect(some).toHaveLength(5);
    expect(some.every((e) => e.clientRef.bundle !== SLICE_BUNDLE)).toBe(true);
    expect(type2).toHaveLength(30);
    expect(type2.every((e) => (e.authBits ?? 0) === 0)).toBe(true);
  });

  it("binder leftover packet has no type-1", () => {
    const key = playerKeyFromCharacter(0x200000002n);
    const entries = buildTowerSpawnSenseEntries(key, true, false);
    expect(
      entries.some((e) => e.clientRef.typeId === ActivityBundleItemType.Squad)
    ).toBe(false);
    expect(entries).toHaveLength(17 + 43);
  });

  it("leftover-only packet has no type-1 and no identity", () => {
    const leftovers = buildTowerLeftoverSenseEntries();
    expect(leftovers).toHaveLength(43);
    expect(
      leftovers.some((e) => e.clientRef.typeId === ActivityBundleItemType.Squad)
    ).toBe(false);
    expect(
      leftovers.some(
        (e) => e.clientRef.typeId === ActivityBundleItemType.Lifetime
      )
    ).toBe(false);
    expect(
      leftovers.some(
        (e) => e.clientRef.typeId === ActivityBundleItemType.Player
      )
    ).toBe(false);
    const type2 = leftovers.filter(
      (e) => e.clientRef.typeId === ActivityBundleItemType.Actor
    );
    expect(type2).toHaveLength(30);
    expect(type2.every((e) => (e.authBits ?? 0) === 0)).toBe(true);
    const payload = buildTowerSensorAuthRsat({
      leftoversOnly: true,
      scenario: {
        activityName: "city_tower_default1",
        bubbleCount: 5,
        familyChecksum: 0,
        initialBubble: 3,
        privateChecksum: 0,
        publicChecksum: 0,
        tag: 0,
      },
    });
    const br = new BitReader(payload);
    expect(br.readBit()).toBe(0);
  });

  it("grants every non-empty Tower bubble plus domain", () => {
    const machine = Buffer.from("7c1e52a389ce", "hex");
    const payload = buildTowerSensorAuthRsat({
      activityTime: 30,
      authorityMachine: machine,
      playerKey: 0x200000002n,
      grantTable: true,
      scenario: {
        activityName: "city_tower_default1",
        bubbleCount: 5,
        familyChecksum: 0,
        initialBubble: 3,
        privateChecksum: 0,
        publicChecksum: 0,
        tag: 0,
      },
    });
    const br = new BitReader(payload);
    expect(br.readBit()).toBe(1);
    const slots: number[] = [];
    for (let i = 0; i < 65; i++) {
      if (br.readBit()) {
        slots.push(i);
      }
    }
    expect(slots).toEqual([0, 1, 2, 3, 4, 64]);
    expect(br.readBit()).toBe(1);
  });

  it("frames keepalive class-5 as time-only", () => {
    const payload = buildSensorAuthTickRsat(44);
    expect(payload.length).toBeLessThanOrEqual(6);
    const br = new BitReader(payload);
    expect(br.readBit()).toBe(0);
    expect(br.readNumber(32)).toBe(44);
    expect(br.readBit()).toBe(0);
  });
});
