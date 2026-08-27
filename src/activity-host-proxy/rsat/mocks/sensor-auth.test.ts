import { BitReader, decode } from "@blamnetwork/rsat";
import { describe, expect, it } from "vitest";
import { activityBundleForSlice } from "../../../tags/activity_bundle";
import { tag as towerPlaza } from "../../../tags/activity_bundle/809E200B_city_tower_default1_8cc31436";
import { tag as towerUnderwatch } from "../../../tags/activity_bundle/809E200C_city_tower_default1_aa891b91";
import { tag as towerStory } from "../../../tags/activity_bundle/809E2008_city_tower_default1_4786c0e0";
import { tag as towerFah } from "../../../tags/scenario_fah/809E2004_city_tower_default1_scenario_fah";
import { ActivityBundleItemType } from "../../../tags/types";
import {
  HardWipeGlobalsAuth,
  LifetimeAuth,
  PlayerAuth,
  SensorClientRef,
} from "../schemas/sensor";
import {
  buildSensorAuthTickRsat,
  buildTowerApplySenseEntries,
  buildTowerBinderSenseEntries,
  buildTowerLeftoverSenseEntries,
  buildTowerSensorAuthRsat,
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
  playerKeyFromCharacter,
  senseEntryPayloadBits,
} from "./sensor-auth";

const storyPlayers = towerStory.rows.filter(
  (row) => row.typeId === ActivityBundleItemType.Player
);
const storyLifetime = towerStory.rows.find(
  (row) => row.typeId === ActivityBundleItemType.Lifetime
)!;
const plazaSquads = towerPlaza.rows.filter(
  (row) => row.typeId === ActivityBundleItemType.Squad
);
const plazaActors = towerPlaza.rows.filter(
  (row) => row.typeId === ActivityBundleItemType.Actor
);
const occupiedPlayer = storyPlayers[0]!;

describe("SensorAuth RSAT", () => {
  it("encodes 8080046B as 54 bits", () => {
    const bits = encodeSensorClientRef({
      bundle: towerStory.bundle,
      typeId: ActivityBundleItemType.Player,
      typeIndex: occupiedPlayer.typeIndex,
    });
    expect(bits.bitCount).toBe(54);
    const parsed = decode(SensorClientRef, bits.bytes);
    expect(parsed.bundle >>> 0).toBe(towerStory.bundle);
    expect(parsed.typeId).toBe(ActivityBundleItemType.Player);
    expect(parsed.typeIndex).toBe(occupiedPlayer.typeIndex);
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
    expect(parsed.state).toBe(2);
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
    const entries = buildTowerApplySenseEntries(
      playerKeyFromCharacter(),
      towerFah.initialBubble
    );
    const postmaster = entries.find(
      (entry) =>
        entry.clientRef.typeId === ActivityBundleItemType.Squad &&
        entry.clientRef.typeIndex === 2
    );
    expect(postmaster?.authBits).toBe(encodeSquadAuth(2).bitCount);
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

  it("join grant is Lifetime + Player on 4786 only", () => {
    const key = playerKeyFromCharacter(0x200000002n);
    const entries = buildTowerBinderSenseEntries(key);
    expect(entries[0]?.clientRef).toEqual({
      bundle: towerStory.bundle,
      typeId: ActivityBundleItemType.Lifetime,
      typeIndex: storyLifetime.typeIndex,
    });
    expect(senseEntryPayloadBits(entries[0]!).length).toBe(2 + 106);
    expect(entries).toHaveLength(1 + storyPlayers.length);
    expect(entries.every((e) => e.clientRef.bundle === towerStory.bundle)).toBe(
      true
    );
    expect(
      entries.some((e) => e.clientRef.typeId === ActivityBundleItemType.Squad)
    ).toBe(false);
    expect(
      entries.some((e) => e.clientRef.typeId === ActivityBundleItemType.Actor)
    ).toBe(false);
  });

  it("looks up Tower slices in scenario order", () => {
    const name = towerFah.activityName;
    expect(activityBundleForSlice(name, 0)?.bundle).toBe(0x8d3f1166);
    expect(activityBundleForSlice(name, 1)).toBeUndefined();
    expect(activityBundleForSlice(name, 2)?.bundle).toBe(0x19d43443);
    expect(activityBundleForSlice(name, 3)?.bundle).toBe(towerPlaza.bundle);
    expect(activityBundleForSlice(name, 4)?.bundle).toBe(0xaa891b91);
  });

  it("apply is identity + current-slice squads + leftover Some", () => {
    const key = playerKeyFromCharacter(0x200000002n);
    const leftovers = buildTowerLeftoverSenseEntries(towerPlaza);
    const entries = buildTowerApplySenseEntries(key, towerFah.initialBubble);
    expect(entries[0]?.clientRef).toEqual({
      bundle: towerStory.bundle,
      typeId: ActivityBundleItemType.Lifetime,
      typeIndex: storyLifetime.typeIndex,
    });
    expect(entries).toHaveLength(
      1 + storyPlayers.length + plazaSquads.length + leftovers.length
    );
    const type1Bundles = new Set(
      entries
        .filter((e) => e.clientRef.typeId === ActivityBundleItemType.Squad)
        .map((e) => e.clientRef.bundle)
    );
    expect([...type1Bundles]).toEqual([towerPlaza.bundle]);
    expect(
      entries.some(
        (e) => e.clientRef.typeId === ActivityBundleItemType.Scoreboard
      )
    ).toBe(true);
    const type2 = entries.filter(
      (e) => e.clientRef.typeId === ActivityBundleItemType.Actor
    );
    expect(type2).toHaveLength(plazaActors.length);
    expect(type2.every((e) => (e.authBits ?? 0) === 0)).toBe(true);
  });

  it("underwatch #8 talkers use definition count 3", () => {
    const entries = buildTowerApplySenseEntries(playerKeyFromCharacter(), 4);
    const talkers = entries.find(
      (e) =>
        e.clientRef.bundle === towerUnderwatch.bundle &&
        e.clientRef.typeId === ActivityBundleItemType.Squad &&
        e.clientRef.typeIndex === 8
    );
    expect(talkers?.authBits).toBe(encodeSquadAuth(3).bitCount);
  });

  it("unmapped slice sends identity leftovers without type-1", () => {
    const key = playerKeyFromCharacter(0x200000002n);
    const entries = buildTowerApplySenseEntries(key, 1);
    expect(
      entries.some((e) => e.clientRef.typeId === ActivityBundleItemType.Squad)
    ).toBe(false);
    expect(
      entries.some((e) => e.clientRef.typeId === ActivityBundleItemType.Actor)
    ).toBe(false);
  });

  it("leftover-only packet has no type-1 and no identity", () => {
    const leftovers = buildTowerLeftoverSenseEntries(towerPlaza);
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
    expect(type2).toHaveLength(plazaActors.length);
    expect(type2.every((e) => (e.authBits ?? 0) === 0)).toBe(true);
    const payload = buildTowerSensorAuthRsat({
      grantTable: false,
      scenario: {
        activityName: "city_tower_default1",
        bubbleCount: 5,
        familyChecksum: 0,
        initialBubble: towerFah.initialBubble,
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
        initialBubble: towerFah.initialBubble,
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
