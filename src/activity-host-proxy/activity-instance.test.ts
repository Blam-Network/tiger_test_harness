import { type ScriptSource } from "@blamnetwork/bullshcript/destiny1/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { characterPowerLevel } from "../bungie-access-protocol/queuez/power-level";
import { contentBuild } from "../content/versions";
import { MemoryCharacterStore } from "../investment/character-store";
import { STUB_APPEARANCE } from "../investment/stubs/stub-account";
import {
  powerLevelOf,
  registerPlayer,
  type SelfFamilyPublisher,
  setPlayerCharacter,
  unregisterPlayer,
} from "../players/registry";
import { hasPackages } from "../test-support/build";
import {
  type ActivityInstance,
  activityInstanceFor,
  endActivityInstance,
  MAX_INSTANCE_MEMBERS,
  resetActivityInstances,
} from "./activity-instance";
import type { AhClientIdentity } from "./join";
import type { ScriptHost } from "./script-host/runtime";

// Stands in for a built script host: activity-instance.ts only ever stores and
// hands the reference back, so identity is all a test needs to check.
function fakeScriptHost(): ScriptHost {
  return {} as ScriptHost;
}

function identity(machine: string): AhClientIdentity {
  return {
    account: 1n,
    character: 0x200000002n,
    machine: Buffer.from(machine, "hex"),
    player: Buffer.from("7081b90432aa3b8a", "hex"),
  };
}

// Whose instance: the session passes the player's PlayerHosts.
const OWNER = {};

describe("ActivityInstance", () => {
  beforeEach(() => {
    resetActivityInstances();
  });

  it("gives each console its own stable slot", () => {
    const instance = activityInstanceFor("act_cosmo_m0_highway", OWNER);
    const first = instance.join(identity("7c1e52a389ce"));
    const second = instance.join(identity("7ced8da3e108"));
    expect(first?.slot).toBe(0);
    expect(second?.slot).toBe(1);
    // A slot is baked into PAH peerMask bits and marker positions, so a
    // rejoin must take the same one back rather than a new one.
    expect(instance.join(identity("7c1e52a389ce"))?.slot).toBe(0);
    expect(instance.size).toBe(2);
  });

  it("reuses a slot only once its member has left", () => {
    const instance = activityInstanceFor("act_cosmo_m0_highway", OWNER);
    instance.join(identity("7c1e52a389ce"));
    instance.join(identity("7ced8da3e108"));
    instance.leave(identity("7c1e52a389ce"));
    expect(instance.join(identity("aabbccddeeff"))?.slot).toBe(0);
  });

  // Every player has their own instance, so one player's script host is never
  // shared with another's.
  it("gives every player their own instance of an activity", () => {
    const other = {};
    const mine = activityInstanceFor("act_venus_m01_engineering", OWNER);
    const theirs = activityInstanceFor("act_venus_m01_engineering", other);
    expect(theirs).not.toBe(mine);
    expect(activityInstanceFor("act_venus_m01_engineering", OWNER)).toBe(mine);
    mine.phaseProgress().write(2);
    expect(theirs.phaseProgress().read()).toBe(0);
    endActivityInstance("act_venus_m01_engineering", other);
    expect(activityInstanceFor("act_venus_m01_engineering", OWNER)).toBe(mine);
  });

  it("keeps activities apart", () => {
    const highway = activityInstanceFor("act_cosmo_m0_highway", OWNER);
    const tower = activityInstanceFor("city_tower_default1", OWNER);
    highway.join(identity("7c1e52a389ce"));
    expect(tower.size).toBe(0);
  });

  it("refuses a member past the slot table", () => {
    const instance = activityInstanceFor("act_cosmo_m1_dome_a", OWNER);
    for (let i = 0; i < MAX_INSTANCE_MEMBERS; i++) {
      expect(
        instance.join(identity(i.toString(16).padStart(12, "0")))
      ).toBeDefined();
    }
    // The guest's own slot walk asserts on "slot < 20"; we must not hand
    // out a 21st.
    expect(instance.join(identity("ffffffffffff"))).toBeUndefined();
  });
});

describe("activity instance clock", () => {
  beforeEach(() => {
    resetActivityInstances();
  });

  it("counts 30 ticks a second from 1", () => {
    const instance = activityInstanceFor("venus_portal_1", OWNER);
    expect(instance.activityTicks(10_000)).toBe(1);
    expect(instance.activityTicks(11_010)).toBe(31);
    expect(instance.clock.activityTicks()).toBeGreaterThan(31);
  });

  // The client keeps the larger activity time, so the start only ever
  // moves earlier: a jump forward is safe, a step back freezes a world.
  it("keeps the earliest start it is handed", () => {
    const instance = activityInstanceFor("venus_portal_1", OWNER);
    expect(instance.noteClockStart(5000)).toBe(5000);
    expect(instance.noteClockStart(8000)).toBe(5000);
    expect(instance.activityTicks(8000)).toBe(91);
    expect(instance.noteClockStart(2000)).toBe(2000);
    expect(instance.activityTicks(8000)).toBe(181);
  });
});

describe("activity instance lifecycle", () => {
  beforeEach(() => {
    resetActivityInstances();
  });

  it("survives one of two members leaving, host and phase progress intact", () => {
    const instance = activityInstanceFor("venus_portal_1", OWNER);
    const host = instance.ensureHost(fakeScriptHost);
    instance.phaseProgress().write(2);
    instance.join(identity("7c1e52a389ce"));
    instance.join(identity("7ced8da3e108"));
    instance.leave(identity("7ced8da3e108"));
    expect(instance.size).toBe(1);
    expect(instance.host()).toBe(host);
    expect(instance.phaseProgress().read()).toBe(2);
  });

  it("ends the instance once its last member leaves", () => {
    const instance = activityInstanceFor("venus_portal_1", OWNER);
    instance.ensureHost(fakeScriptHost);
    instance.phaseProgress().write(2);
    instance.join(identity("7c1e52a389ce"));
    instance.leave(identity("7c1e52a389ce"));
    expect(instance.size).toBe(0);
    endActivityInstance("venus_portal_1", OWNER);
    // A fresh lookup after the end is a new instance, not the old one:
    // fresh row state, no carried-over script host, phase reset.
    const restarted = activityInstanceFor("venus_portal_1", OWNER);
    expect(restarted).not.toBe(instance);
    expect(restarted.host()).toBeUndefined();
    expect(restarted.phaseProgress().read()).toBe(0);
  });

  it("starts a re-run at mission one after everyone leaves mid-mission", () => {
    const first = activityInstanceFor("venus_portal_1", OWNER);
    first.join(identity("7c1e52a389ce"));
    first.phaseProgress().write(3);
    first.leave(identity("7c1e52a389ce"));
    endActivityInstance("venus_portal_1", OWNER);
    const second = activityInstanceFor("venus_portal_1", OWNER);
    expect(second.phaseProgress().read()).toBe(0);
    expect(second.size).toBe(0);
  });
});

// What the session hands the script runtime: each member's character power
// level through the player registry, ready once its client spawned.
describe("ActivityInstance players", () => {
  const noScripts: ScriptSource = { read: () => undefined, tags: () => [] };
  const signedIn: SelfFamilyPublisher[] = [];
  let store = new MemoryCharacterStore();

  beforeEach(() => {
    resetActivityInstances();
    store = new MemoryCharacterStore();
  });
  afterEach(() => {
    for (const publisher of signedIn.splice(0)) {
      unregisterPlayer(publisher);
    }
  });

  async function guardian(platformId: bigint, power: number) {
    const account = await store.accountForPlatformId(platformId, "guardian");
    const character = await store.createCharacter(
      account.soid,
      "guardian",
      STUB_APPEARANCE
    );
    for (const item of character.loadout.items) {
      item.power = power;
    }
    // The BAP session's own answer (BungieAccessProtocolSession.powerLevel).
    const publisher: SelfFamilyPublisher = {
      dropLoot: vi.fn(),
      grantXp: vi.fn(),
      powerLevel: () => characterPowerLevel(character),
    };
    registerPlayer(publisher, platformId, account.soid);
    setPlayerCharacter(publisher, character.soid);
    signedIn.push(publisher);
    return character;
  }

  function member(machine: string, character: bigint): AhClientIdentity {
    return { ...identity(machine), character };
  }

  function utilities(instance: ActivityInstance) {
    const { ScriptRuntime } = contentBuild().bullshcript;
    const runtime = new ScriptRuntime({
      bundles: [{ bundle: 0x1234_5678, rows: [], tag: 0x809b_800d }],
      clock: { activityTicks: () => 0 },
      players: () => instance.players(powerLevelOf),
      scriptFor: () => undefined,
      scripts: noScripts,
      tickSeconds: 1,
    });
    return (method: string) =>
      runtime["libraryCall"]("c_player_script_utilities", method, [])[0];
  }

  it.skipIf(!hasPackages())(
    "answers get_minimum_power_level with the lower of two characters",
    async () => {
      const strong = await guardian(0x11n, 16);
      const weak = await guardian(0x22n, 9);
      const instance = activityInstanceFor("act_cosmo_m0_highway", OWNER);
      instance.join(member("7c1e52a389ce", strong.soid));
      instance.join(member("7ced8da3e108", weak.soid));
      const call = utilities(instance);
      expect(call("get_minimum_power_level")).toBe(9);
      // Read live: re-equipping moves it without rebuilding anything.
      for (const item of weak.loadout.items) {
        item.power = 20;
      }
      expect(call("get_minimum_power_level")).toBe(16);
    }
  );

  it.skipIf(!hasPackages())(
    "counts members, and the spawned ones as ready",
    async () => {
      const strong = await guardian(0x11n, 16);
      const weak = await guardian(0x22n, 9);
      const instance = activityInstanceFor("act_cosmo_m0_highway", OWNER);
      instance.join(member("7c1e52a389ce", strong.soid));
      instance.join(member("7ced8da3e108", weak.soid));
      const call = utilities(instance);
      expect(call("get_player_count")).toBe(2);
      expect(call("get_ready_player_count")).toBe(0);
      instance.noteSpawned(member("7ced8da3e108", weak.soid));
      expect(call("get_ready_player_count")).toBe(1);
      expect(call("all_players_are_ready")).toBe(false);
      instance.noteSpawned(member("7c1e52a389ce", strong.soid));
      expect(call("all_players_are_ready")).toBe(true);
    }
  );

  it.skipIf(!hasPackages())(
    "answers nil for a member with no signed-in character",
    async () => {
      const strong = await guardian(0x11n, 16);
      const instance = activityInstanceFor("act_cosmo_m0_highway", OWNER);
      const call = utilities(instance);
      expect(call("get_minimum_power_level")).toBeUndefined();
      instance.join(member("7c1e52a389ce", strong.soid));
      instance.join(member("7ced8da3e108", 0x200000099n));
      expect(call("get_minimum_power_level")).toBeUndefined();
    }
  );
});
