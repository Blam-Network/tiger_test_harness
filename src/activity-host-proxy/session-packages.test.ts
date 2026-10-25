import { e_event_level, events_dispose } from "@blamnetwork/datamine";
import { BitReader, BitWriter, decode } from "@blamnetwork/rsat";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { activityBinder } from "../content";
import { setDebugTogglesForTest } from "../dev-config/debug-toggles";
import {
  registerPlayer,
  type SelfFamilyPublisher,
  setPlayerCharacter,
  unregisterPlayer,
} from "../players/registry";
import {
  IDENTITY,
  makeSession,
  startRequest,
} from "../test-support/activity-host-session";
import { describeWithPackages } from "../test-support/build";
import { ActivityHostManager } from "./activity-host-manager";
import {
  activityInstanceFor,
  resetActivityInstances,
} from "./activity-instance";
import { ActivityHostMessageType } from "./messages";
import {
  PAH_AMBASSADOR_ASSIGN,
  PAH_AMBASSADOR_REVOKE,
  PAH_REVOKE_AFTER_SEARCH_MS,
} from "./pah-policy";
import { PlayerHosts } from "./player-hosts";
import type { FinishedBits } from "./rsat/sensor-auth-fields";
import { sensorAuthReader } from "./rsat/sensor-auth-fields";
import type { ScriptHost } from "./script-host/runtime";
import { liveAh } from "./versions/v41375_14_07_03_1501_live/live-ah";

afterEach(() => events_dispose());

describeWithPackages("activity host session sensor identity", () => {
  // A load zone does not go through a state refresh, so currentSlice keeps
  // naming the bubble the player was in a crossing ago. Keying the crossing
  // apply on it would swallow every walk back (the Tower's load zones all
  // lead back to the spawn slice, so 3 -> 2 -> 3 must serve both).
  it("applies a bubble again every time a crossing leads back into it", () => {
    const { session, pushes, close } = makeSession();
    const hosts = new PlayerHosts();
    // activity id 0 is city_tower_default1, which serves bubbles 0, 2, 3, 4.
    hosts.setStartRequest({ activityId: 0 } as never);
    session["bound"] = { host: hosts.fah, hosts, kind: "FAH" };
    const appliedSlices = () => {
      const slices = pushes
        .map((p) => /apply .* slice=(\d+)/.exec(p.label ?? "")?.[1])
        .filter((slice) => slice !== undefined);
      pushes.length = 0;
      return slices;
    };
    // A crossing's apply waits for the slot handoff to complete (abdicate,
    // then the client's purge request), so drive that too and keep this a
    // test about which bubbles get applied. A re-announced crossing is not a
    // new one, so the client does not hand anything back for it.
    const cross = (region: number, token: number, handoff = true) => {
      session["crossing"].applyPendingRegion(1n, region, token);
      if (!handoff) {
        return;
      }
      session["entitySlots"].handle(
        1n,
        ActivityHostMessageType.AbdicateAuthority,
        Buffer.alloc(8)
      );
      session["entitySlots"].handle(
        1n,
        ActivityHostMessageType.RequestPurgeEntitySlots,
        Buffer.alloc(8)
      );
    };
    try {
      session["handleStateRefresh"](1n, Buffer.from("0000000880000003", "hex"));
      expect(appliedSlices()).toEqual(["3"]);
      // Region handles pack the bubble in the high bits (bubble << 3).
      cross(2 << 3, 3);
      expect(appliedSlices()).toEqual(["2"]);
      cross(3 << 3, 4);
      expect(appliedSlices()).toEqual(["3"]);
      cross(2 << 3, 5);
      expect(appliedSlices()).toEqual(["2"]);
      cross(3 << 3, 6);
      expect(appliedSlices()).toEqual(["3"]);
      // A crossing re-announced unchanged is the same crossing, not a new
      // one: that pair still applies once.
      cross(3 << 3, 6, false);
      expect(appliedSlices()).toEqual([]);
      // A retry after a crossing that did not commit carries a new token.
      cross(3 << 3, 7);
      expect(appliedSlices()).toEqual(["3"]);
    } finally {
      close();
    }
  });

  // After a public load-zone swap the client keeps the old public record open
  // and sends it the same state refresh as the others. Anything that host
  // answers - applies, promotes, membership, globals - lands in a world being
  // torn down.
  it("sends nothing from a public host the client has swapped away from", () => {
    const { session, pushes, close } = makeSession();
    const hosts = new PlayerHosts();
    hosts.setStartRequest({ activityId: 0 } as never);
    hosts.bind();
    const current = hosts.bindHost();
    hosts.bindHost();
    hosts.promotePendingGah();
    session["bound"] = { host: current.host, hosts, kind: "GAH" };
    try {
      session["handleStateRefresh"](1n, Buffer.from("0000000880000002", "hex"));
      expect(pushes).toEqual([]);
    } finally {
      close();
    }
  });

  // The pending host is promoted by the swap, not by joining: its first
  // refresh (from=none) arrives long before the client swaps records, and
  // promoting on it would retire the real public host early.
  it("does not promote a pending public host on its first refresh", () => {
    const { session, close } = makeSession();
    const hosts = new PlayerHosts();
    hosts.setStartRequest({ activityId: 0 } as never);
    hosts.bind();
    const current = hosts.bindHost();
    const pending = hosts.bindHost();
    session["bound"] = { host: pending.host, hosts, kind: "GAH" };
    try {
      session["handleStateRefresh"](1n, Buffer.from("0000000880000003", "hex"));
      expect(hosts.gah).toBe(current.host);
      expect(hosts.pendingGah).toBe(pending.host);
      session["handleStateRefresh"](1n, Buffer.from("0000000880000002", "hex"));
      expect(hosts.gah).toBe(pending.host);
      expect(hosts.isRetiredHost(current.host)).toBe(true);
    } finally {
      close();
    }
  });

  // The swap's refresh reaches the pending host before the old one's, and a
  // host that has not been in a bubble reports it as from=none (its first
  // refresh had membership 0). That refresh is the swap: left pending, the
  // host got no apply and the client never built its bubble's squads.
  it("promotes and applies on a pending public host's first refresh with a membership", () => {
    const { session, pushes, close } = makeSession();
    const hosts = new PlayerHosts();
    hosts.setStartRequest({ activityId: 0 } as never);
    hosts.bind();
    const current = hosts.bindHost();
    const pending = hosts.bindHost();
    session["bound"] = { host: pending.host, hosts, kind: "GAH" };
    try {
      session["handleStateRefresh"](1n, Buffer.from("0000000080000003", "hex"));
      expect(hosts.pendingGah).toBe(pending.host);
      pushes.length = 0;
      session["handleStateRefresh"](1n, Buffer.from("0000000280000002", "hex"));
      expect(hosts.gah).toBe(pending.host);
      expect(hosts.isRetiredHost(current.host)).toBe(true);
      expect(
        pushes.filter((p) => /apply .* slice=2/.test(p.label ?? "")).length
      ).toBeGreaterThan(0);
    } finally {
      close();
    }
  });

  // The destination is applied while the region is still pending and the swap
  // only flips it; a second apply after the swap lands in a rebuilt sensor
  // array and asserts.
  it("does not re-apply a bubble on the swap into it after a crossing", () => {
    const { session, pushes, close } = makeSession();
    const hosts = new PlayerHosts();
    hosts.setStartRequest({ activityId: 0 } as never);
    session["bound"] = { host: hosts.fah, hosts, kind: "FAH" };
    const applies = () =>
      pushes.filter((p) => /apply .* slice=\d+/.test(p.label ?? "")).length;
    try {
      // In world at bubble 3, then a crossing into bubble 2 applies it.
      session["handleStateRefresh"](1n, Buffer.from("0000000880000003", "hex"));
      session["crossing"].applyPendingRegion(1n, 2 << 3, 3);
      session["entitySlots"].handle(
        1n,
        ActivityHostMessageType.AbdicateAuthority,
        Buffer.alloc(8)
      );
      pushes.length = 0;
      session["handleStateRefresh"](1n, Buffer.from("0000000880000002", "hex"));
      expect(applies()).toBe(0);
    } finally {
      close();
    }
  });

  // currentSlice follows a crossing's announcement; a crossing the client
  // abandons leaves it naming a bubble the player never entered. A
  // republish there would send 23's table into the unloaded bubble while the
  // player stood in 14, and the client asserts.
  it("republishes the bubble the client is in, not an abandoned crossing's", () => {
    const { session, pushes, close } = makeSession();
    const hosts = new PlayerHosts();
    hosts.setStartRequest({ activityId: 0 } as never);
    session["bound"] = { host: hosts.fah, hosts, kind: "FAH" };
    try {
      session["boundSessionId"] = 1n;
      session["sensorAuth"].appliedSlices.add(2);
      session["sensorAuth"].appliedSlices.add(3);
      session["handleStateRefresh"](1n, Buffer.from("0000000880000002", "hex"));
      session["crossing"].currentSlice = 3;
      pushes.length = 0;
      session.republishTables("test");
      const slices = pushes
        .map((p) => /apply .* slice=(\d+)/.exec(p.label ?? "")?.[1])
        .filter((slice) => slice !== undefined);
      expect(slices).toEqual(["2"]);
    } finally {
      close();
    }
  });

  // The client stops a crossing it turned back from with phase 0 and
  // nothing else - no pending, no current. The player is still in the bubble
  // they were in, so the slice follows them back.
  it("comes back to the client's bubble when a crossing is abandoned", () => {
    const { session, close } = makeSession();
    const hosts = new PlayerHosts();
    hosts.setStartRequest({ activityId: 0 } as never);
    session["bound"] = { host: hosts.fah, hosts, kind: "FAH" };
    try {
      session["handleStateRefresh"](1n, Buffer.from("0000000880000002", "hex"));
      session["crossing"].currentSlice = 3;
      session["crossing"].crossingInFlight = true;
      // Class 21: the "any update" bit, then 80800C56 whose transition
      // 80800D9F carries only the phase (member 4).
      const bw = new BitWriter();
      bw.writeBit(1);
      liveAh().ClientAuthoritativeData.encode(bw, {
        identity: undefined,
        transition: {
          unknown0: undefined,
          unknown1: undefined,
          unknown2: undefined,
          unknown3: undefined,
          unknown4: 0,
        },
        hardWipe: undefined,
        teleport: undefined,
      });
      const stop = bw.finish();
      session["crossing"].handleClientAuth(1n, stop);
      expect(session["crossing"].currentSlice).toBe(2);
      expect(session["crossing"].crossingInFlight).toBe(false);
    } finally {
      close();
    }
  });

  // The guest enqueues a SensorAuth and applies it on a later simulation-queue
  // drain, so a table republished just before a swap is applied AFTER it,
  // into the rebuilt sensor array.
  it("holds republishes near the commit line until the swap lands", () => {
    const { session, pushes, close } = makeSession();
    const hosts = new PlayerHosts();
    hosts.setStartRequest({ activityId: 0 } as never);
    session["bound"] = { host: hosts.fah, hosts, kind: "FAH" };
    const applies = () =>
      pushes.filter((p) => /apply .* slice=\d+/.test(p.label ?? "")).length;
    try {
      session["handleStateRefresh"](1n, Buffer.from("0000000880000003", "hex"));
      session["crossing"].applyPendingRegion(1n, 2 << 3, 3);
      session["entitySlots"].handle(
        1n,
        ActivityHostMessageType.AbdicateAuthority,
        Buffer.alloc(8)
      );
      session["entitySlots"].handle(
        1n,
        ActivityHostMessageType.RequestPurgeEntitySlots,
        Buffer.alloc(8)
      );
      // Far from the line (hysteresis band): republishing continues.
      session["crossing"].transitionPhase = 1;
      pushes.length = 0;
      session.republishTables("test");
      expect(applies()).toBe(1);
      // At the commit-line approach: held.
      session["crossing"].transitionPhase = 3;
      pushes.length = 0;
      session.republishTables("test");
      expect(applies()).toBe(0);
      // The swap lands: republishing resumes.
      session["handleStateRefresh"](1n, Buffer.from("0000000880000002", "hex"));
      pushes.length = 0;
      session.republishTables("test");
      expect(applies()).toBe(1);
    } finally {
      close();
    }
  });

  // Sense reaches the shared script host from any socket, but events take one
  // route: a GAH hands a kill or a trigger to the FAH, which delivers it once.
  // The scripts write into the FAH's row state, so the FAH drives the shared
  // script host: a tick won by the GAH's beat leaves mission rows unpushed.
  // The host is up long before anyone is in the world; scripts ticking from
  // the start would play chapter 2's opening dialogue during the load screen.
  // Some of a bubble's sensor instances are built after the swap's apply
  // lands, and never reconcile without a later full state: chapter 2
  // mission 3's objective and trigger in bubble 23.
  it("republishes the new bubble's tables twice after a swap", () => {
    vi.useFakeTimers();
    const { session, pushes, close } = makeSession();
    const hosts = new PlayerHosts();
    hosts.setStartRequest({ activityId: 0 } as never);
    session["bound"] = { host: hosts.fah, hosts, kind: "FAH" };
    const settles = () =>
      pushes.filter((p) => (p.label ?? "").includes("settle after swap"))
        .length;
    try {
      session["handleStateRefresh"](1n, Buffer.from("0000000880000003", "hex"));
      session["handleStateRefresh"](1n, Buffer.from("0000000880000002", "hex"));
      vi.advanceTimersByTime(3000);
      expect(settles()).toBe(0);
      vi.advanceTimersByTime(3000);
      expect(settles()).toBe(1);
      vi.advanceTimersByTime(9000);
      expect(settles()).toBe(2);
    } finally {
      vi.useRealTimers();
      close();
    }
  });

  it("holds the scripts until a player has spawned", () => {
    const { session, close } = makeSession();
    const hosts = new PlayerHosts();
    hosts.setStartRequest({ activityId: 0 } as never);
    session["bound"] = { host: hosts.fah, hosts, kind: "FAH" };
    const scriptHost = {
      notePlayerSpawned() {
        this.playerSpawned = true;
      },
      playerSpawned: false,
      itemSink: {
        hasDirty: () => false,
        holdRespawns: vi.fn(),
        setDebugToggles: vi.fn(),
      },
      tickIfDue: vi.fn(),
    };
    session["scripts"]["ownHost"] = scriptHost as never;
    session["scripts"].markMissionLive();
    // Activity 0 is the Tower, whose incidents name themselves by
    // registry index: the client's own spawn incident (player_spawned 214).
    const spawned = Buffer.from(
      "31ad3f568860b6dd997880000000800000021000000010000000406b64157d9e9f786804800000000000000004000000000000000028",
      "hex"
    );
    try {
      session["scripts"].tick();
      expect(scriptHost.tickIfDue).not.toHaveBeenCalled();
      session["scripts"].handleIncident(1n, spawned);
      session["scripts"].tick();
      expect(scriptHost.tickIfDue).toHaveBeenCalledTimes(1);
    } finally {
      close();
    }
  });

  it("lets only the FAH tick the shared script host", () => {
    const { session, close } = makeSession();
    const hosts = new PlayerHosts();
    hosts.setStartRequest({ activityId: 0 } as never);
    hosts.bind();
    const gah = hosts.bindHost();
    session["bound"] = { host: gah.host, hosts, kind: "GAH" };
    const scriptHost = {
      playerSpawned: true,
      itemSink: {
        hasDirty: () => false,
        holdRespawns: vi.fn(),
        setDebugToggles: vi.fn(),
      },
      tickIfDue: vi.fn(),
    };
    session["scripts"]["ownHost"] = scriptHost as never;
    session["scripts"].markMissionLive();
    try {
      hosts.setSession("FAH", {} as never);
      session["scripts"].tick();
      expect(scriptHost.tickIfDue).not.toHaveBeenCalled();
      // With no FAH bound the GAH drives it.
      hosts.setSession("FAH", undefined);
      session["scripts"].tick();
      expect(scriptHost.tickIfDue).toHaveBeenCalledTimes(1);
    } finally {
      close();
    }
  });

  it("hands GAH kills and triggers to the FAH exactly once", () => {
    const { session, close } = makeSession();
    const hosts = new PlayerHosts();
    hosts.setStartRequest({ activityId: 0 } as never);
    hosts.bind();
    const gah = hosts.bindHost();
    session["bound"] = { host: gah.host, hosts, kind: "GAH" };
    const fah = { noteKill: vi.fn(), notePlayerTrigger: vi.fn() };
    hosts.setSession("FAH", fah as never);
    try {
      session.noteKill({ assists: [], killer: {}, victim: {} });
      session.notePlayerTrigger(0x1234, 5);
      expect(fah.noteKill).toHaveBeenCalledTimes(1);
      expect(fah.notePlayerTrigger).toHaveBeenCalledTimes(1);
      expect(fah.notePlayerTrigger).toHaveBeenCalledWith(0x1234, 5);
    } finally {
      close();
    }
  });

  // A pending-region client-auth is never answered with the dest apply in the
  // same breath: the guest hands its entity slots back first, and the apply
  // follows that (2.3.1 capture).
  it("holds a crossing's apply until the slot handoff completes", () => {
    const { session, pushes, close } = makeSession();
    const hosts = new PlayerHosts();
    hosts.setStartRequest({ activityId: 0 } as never);
    session["bound"] = { host: hosts.fah, hosts, kind: "FAH" };
    const applies = () =>
      pushes.filter((p) => /apply .* slice=\d+/.test(p.label ?? "")).length;
    vi.useFakeTimers();
    try {
      session["handleStateRefresh"](1n, Buffer.from("0000000880000003", "hex"));
      pushes.length = 0;
      session["crossing"].applyPendingRegion(1n, 2 << 3, 3);
      expect(applies()).toBe(0);
      session["entitySlots"].handle(
        1n,
        ActivityHostMessageType.AbdicateAuthority,
        Buffer.alloc(8)
      );
      // The dest apply goes out alongside purge-abandoned, after the
      // client's purge request - not on the abdicate (2.3.1 capture).
      expect(applies()).toBe(0);
      session["entitySlots"].handle(
        1n,
        ActivityHostMessageType.RequestPurgeEntitySlots,
        Buffer.alloc(8)
      );
      expect(applies()).toBe(1);
      // Neither fallback timer may fire a second apply afterwards. (The 3s
      // keepalive republish is a separate, intended apply; stop it here so
      // this counts only the crossing and purge fallbacks.)
      session["keepalive"].stop();
      vi.advanceTimersByTime(6000);
      expect(applies()).toBe(1);
    } finally {
      vi.useRealTimers();
      close();
    }
  });

  // Which host gets the abandon (and after it the purge request) cannot be told
  // in advance. An abandon can trail its abdicate by 300ms, and some crossings
  // send none to a host, where a 5s hold stalled the client's transition. So:
  // 1s for an abandon, then the purge; no abandon, release at 1s.
  it("holds tables for an abandon up to 1s, and then for the purge", () => {
    const { session, pushes, close } = makeSession();
    const hosts = new PlayerHosts();
    hosts.setStartRequest({ activityId: 0 } as never);
    session["bound"] = { host: hosts.fah, hosts, kind: "GAH" };
    const applies = () =>
      pushes.filter((p) => /apply .* slice=\d+/.test(p.label ?? "")).length;
    const abdicate = () =>
      session["entitySlots"].handle(
        1n,
        ActivityHostMessageType.AbdicateAuthority,
        Buffer.alloc(8)
      );
    vi.useFakeTimers();
    try {
      session["handleStateRefresh"](1n, Buffer.from("0000000480000003", "hex"));
      session["keepalive"].stop();
      pushes.length = 0;
      session["crossing"].applyPendingRegion(1n, 2 << 3, 4);
      abdicate();
      vi.advanceTimersByTime(900);
      expect(applies()).toBe(0);
      vi.advanceTimersByTime(200);
      expect(applies()).toBe(1);
      // An abandon 300ms in: held past the grace, released by the purge.
      pushes.length = 0;
      session["crossing"].applyPendingRegion(1n, 4 << 3, 5);
      abdicate();
      vi.advanceTimersByTime(300);
      session["entitySlots"].handle(
        1n,
        ActivityHostMessageType.AbandonEntitySlots,
        Buffer.alloc(8)
      );
      vi.advanceTimersByTime(1500);
      expect(applies()).toBe(0);
      session["entitySlots"].handle(
        1n,
        ActivityHostMessageType.RequestPurgeEntitySlots,
        Buffer.alloc(8)
      );
      expect(applies()).toBe(1);
    } finally {
      vi.useRealTimers();
      close();
    }
  });

  // Phase 1 (the crossing's own class-21 open) gets only the promote and the
  // PAH row, never the dest apply or startMission for the target.
  it("sends only the promote and the PAH row when a crossing opens", () => {
    const { session, pushes, close } = makeSession();
    const hosts = new PlayerHosts();
    hosts.setStartRequest({ activityId: 0 } as never);
    session["bound"] = { host: hosts.fah, hosts, kind: "FAH" };
    const applies = () =>
      pushes.filter((p) => /apply .* slice=\d+/.test(p.label ?? "")).length;
    vi.useFakeTimers();
    try {
      session["handleStateRefresh"](1n, Buffer.from("0000000880000003", "hex"));
      session["keepalive"].stop();
      pushes.length = 0;
      session["crossing"].pendingRegion = { regionId: 2 << 3, token: 3 };
      session["crossing"].applyPendingRegion(1n, 2 << 3, 3);
      session["membership"].push(1n, true);
      expect(applies()).toBe(0);
      const promoted = pushes.some((p) => (p.label ?? "").includes("promote"));
      expect(promoted).toBe(true);
      const membership = pushes.find(
        (p) => p.kind === ActivityHostMessageType.ReplicateMembership
      );
      expect(membership?.label).toContain("pending=16 token=3");
      // No timer is left running to force the apply out on its own later.
      vi.advanceTimersByTime(20_000);
      expect(applies()).toBe(0);
    } finally {
      vi.useRealTimers();
      close();
    }
  });

  // The dest apply goes out exactly once, gated on the swap's own slot handoff,
  // no matter how long the crossing sat open first.
  it("applies the destination once, after the swap and its handoff, even when the crossing sat open a long time first", () => {
    const { session, pushes, close } = makeSession();
    const hosts = new PlayerHosts();
    hosts.setStartRequest({ activityId: 0 } as never);
    session["bound"] = { host: hosts.fah, hosts, kind: "FAH" };
    const applies = () =>
      pushes.filter((p) => /apply .* slice=\d+/.test(p.label ?? "")).length;
    vi.useFakeTimers();
    try {
      session["handleStateRefresh"](1n, Buffer.from("0000000880000003", "hex"));
      session["keepalive"].stop();
      pushes.length = 0;
      session["crossing"].applyPendingRegion(1n, 2 << 3, 3);
      vi.advanceTimersByTime(17_000);
      expect(applies()).toBe(0);
      // Commit: abdicate, the swap's own refresh, then the purge request.
      session["entitySlots"].handle(
        1n,
        ActivityHostMessageType.AbdicateAuthority,
        Buffer.alloc(8)
      );
      expect(applies()).toBe(0);
      session["handleStateRefresh"](1n, Buffer.from("0000000880000002", "hex"));
      expect(applies()).toBe(0);
      session["entitySlots"].handle(
        1n,
        ActivityHostMessageType.RequestPurgeEntitySlots,
        Buffer.alloc(8)
      );
      expect(applies()).toBe(1);
      vi.advanceTimersByTime(10_000);
      expect(applies()).toBe(1);
    } finally {
      vi.useRealTimers();
      close();
    }
  });

  // A pending public host (PUBLIC TARGET) only ever gets membership, GAS and
  // WGS (the switch task's own gate for it), never a promote or an apply for
  // the bubble it has not been told to enter yet.
  it("sends only membership, GAS and WGS to a pending public host, never a promote or an apply", () => {
    const { session, pushes, close } = makeSession();
    const hosts = new PlayerHosts();
    hosts.setStartRequest({ activityId: 0 } as never);
    hosts.bind();
    hosts.bindHost();
    const pending = hosts.bindHost();
    session["bound"] = { host: pending.host, hosts, kind: "GAH" };
    try {
      session["handleStateRefresh"](1n, Buffer.from("0000000880000003", "hex"));
      const kinds = pushes.map((p) => p.kind);
      expect(kinds).toContain(ActivityHostMessageType.ReplicateMembership);
      expect(kinds).toContain(ActivityHostMessageType.GlobalActivityState);
      expect(kinds).toContain(ActivityHostMessageType.WorldGlobalsState);
      expect(
        pushes.filter((p) => /apply .* slice=\d+/.test(p.label ?? ""))
      ).toEqual([]);
      expect(pushes.filter((p) => (p.label ?? "").includes("promote"))).toEqual(
        []
      );
    } finally {
      close();
    }
  });
});

describeWithPackages("two players on one activity host manager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("binds each AH session to its own player's hosts with independent PAH timers", () => {
    const a: SelfFamilyPublisher = { dropLoot: vi.fn(), grantXp: vi.fn() };
    const b: SelfFamilyPublisher = { dropLoot: vi.fn(), grantXp: vi.fn() };
    const playerA = registerPlayer(a, 0x11n, 0x100000001n);
    const playerB = registerPlayer(b, 0x22n, 0x100000002n);
    setPlayerCharacter(a, 0x200000001n);
    setPlayerCharacter(b, 0x200000002n);
    const manager = new ActivityHostManager();
    const one = makeSession(manager);
    const two = makeSession(manager);
    one.session["bound"] = undefined;
    two.session["bound"] = undefined;
    try {
      // Before the start request nothing is bound; notifications drop.
      one.session["handleActivityHostNotification"]({
        msgType: 5,
        sequence: 0,
        body: Buffer.alloc(32),
      });
      expect(one.captured.at(e_event_level.warning)).toHaveLength(1);
      expect(one.pushes).toEqual([]);

      one.session["handleActivityHostManager"](
        startRequest(0x100000001n, 0x200000001n)
      );
      two.session["handleActivityHostManager"](
        startRequest(0x100000002n, 0x200000002n)
      );
      expect(one.session["hosts"]).toBe(playerA.hosts);
      expect(two.session["hosts"]).toBe(playerB.hosts);
      expect(one.session["kind"]).toBe("FAH");
      expect(two.session["kind"]).toBe("FAH");
      expect(playerA.hosts.getStartRequest()?.stream.length).toBe(1068);

      // FAH join arms only this player's ASSIGN->REVOKE timer. The start
      // request's activity 0 is the Tower, all-private, which never
      // arms it: the timer is for an activity with public bubbles.
      playerA.hosts.setStartRequest({
        ...playerA.hosts.getStartRequest(),
        activityId: 16,
      } as never);
      one.session["pushJoinState"](playerA.hosts.fah.id);
      vi.advanceTimersByTime(PAH_REVOKE_AFTER_SEARCH_MS);
      expect(playerA.hosts.pah.currentAmbassador()).toBe(PAH_AMBASSADOR_REVOKE);
      expect(playerB.hosts.pah.currentAmbassador()).toBe(PAH_AMBASSADOR_ASSIGN);

      two.close();
      expect(playerA.hosts.pah.currentAmbassador()).toBe(PAH_AMBASSADOR_REVOKE);
      expect(playerB.hosts.isGahBound()).toBe(false);
      expect(playerB.hosts.bind()).toBe("FAH");
    } finally {
      one.close();
      unregisterPlayer(a);
      unregisterPlayer(b);
    }
  });
});

describeWithPackages("activity instance lifecycle across AH sessions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetActivityInstances();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  // startRequest(...)'s fixed stream carries activityId 0, city_tower_default1
  // (see "applies a bubble again..." above).
  const ACTIVITY_NAME = "city_tower_default1";

  it("keeps the instance alive while either of a player's two sessions is open, ends it once both are", () => {
    const player: SelfFamilyPublisher = { dropLoot: vi.fn(), grantXp: vi.fn() };
    const registered = registerPlayer(player, 0x33n, 0x100000003n);
    setPlayerCharacter(player, 0x200000003n);
    const manager = new ActivityHostManager();
    const fah = makeSession(manager);
    const gah = makeSession(manager);
    fah.session["bound"] = undefined;
    gah.session["bound"] = undefined;
    try {
      fah.session["handleActivityHostManager"](
        startRequest(0x100000003n, 0x200000003n)
      );
      gah.session["handleActivityHostManager"](
        startRequest(0x100000003n, 0x200000003n)
      );
      expect(fah.session["hosts"]).toBe(registered.hosts);
      expect(gah.session["hosts"]).toBe(registered.hosts);
      expect(fah.session["kind"]).toBe("FAH");
      expect(gah.session["kind"]).toBe("GAH");

      // One console, two sockets: the instance join keys on the machine, so both
      // sessions land on the same membership slot.
      fah.session["joinIdentity"] = { ...IDENTITY };
      gah.session["joinIdentity"] = { ...IDENTITY };
      fah.session["membership"].join();
      gah.session["membership"].join();
      const instance = activityInstanceFor(ACTIVITY_NAME, registered.hosts);
      expect(instance.size).toBe(1);

      // The FAH closing first must not end the activity - the GAH session
      // for the same player is still live.
      fah.close();
      expect(activityInstanceFor(ACTIVITY_NAME, registered.hosts)).toBe(
        instance
      );
      expect(instance.size).toBe(1);

      gah.close();
      expect(activityInstanceFor(ACTIVITY_NAME, registered.hosts)).not.toBe(
        instance
      );
    } finally {
      unregisterPlayer(player);
    }
  });
});

// One activity clock per instance. With a clock per socket the host's
// FAH-based stamps run ahead of the public world, which pins the event
// countdown and re-fires a public PlayerTrigger every frame.
describeWithPackages("activity clock across AH sessions", () => {
  const ACTIVITY_NAME = "city_tower_default1";
  const GAH_LATE_MS = 228_000;
  let player: SelfFamilyPublisher;
  let registered: ReturnType<typeof registerPlayer>;
  let manager: ActivityHostManager;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    resetActivityInstances();
    player = { dropLoot: vi.fn(), grantXp: vi.fn() };
    registered = registerPlayer(player, 0x44n, 0x100000004n);
    setPlayerCharacter(player, 0x200000004n);
    manager = new ActivityHostManager();
  });
  afterEach(() => {
    unregisterPlayer(player);
    vi.useRealTimers();
  });

  function bind(made: ReturnType<typeof makeSession>) {
    made.session["bound"] = undefined;
    made.session["handleActivityHostManager"](
      startRequest(0x100000004n, 0x200000004n)
    );
  }

  it("gives a FAH and a later GAH the same activity ticks", () => {
    const fah = makeSession(manager);
    const gah = makeSession(manager);
    try {
      bind(fah);
      expect(fah.session["activityTicks"]()).toBe(1);
      vi.advanceTimersByTime(GAH_LATE_MS);
      bind(gah);
      expect(gah.session["kind"]).toBe("GAH");
      const ticks = gah.session["activityTicks"]();
      expect(ticks).toBe(1 + Math.floor(GAH_LATE_MS / (1000 / 30)));
      expect(fah.session["activityTicks"]()).toBe(ticks);
      expect(
        activityInstanceFor(ACTIVITY_NAME, registered.hosts).activityTicks()
      ).toBe(ticks);
    } finally {
      fah.close();
      gah.close();
    }
  });

  // A socket that sent ticks from its own clock before the activity was
  // known must not be sent fewer once it switches to the instance's: the
  // client keeps the larger activity time, so its world would freeze.
  it("never sends a late-joining session fewer ticks than it has seen", () => {
    const early = makeSession(manager);
    const fah = makeSession(manager);
    try {
      const seen = [early.session["activityTicks"]()];
      vi.advanceTimersByTime(3000);
      bind(fah);
      const fahSeen = [fah.session["activityTicks"]()];
      vi.advanceTimersByTime(2000);
      seen.push(early.session["activityTicks"]());
      bind(early);
      expect(early.session["kind"]).toBe("GAH");
      vi.advanceTimersByTime(1);
      seen.push(early.session["activityTicks"]());
      fahSeen.push(fah.session["activityTicks"]());
      for (let i = 1; i < seen.length; i++) {
        expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]);
      }
      // The instance clock moved back to the earlier start; for the FAH's
      // world that is a jump forward, which the client takes.
      expect(fahSeen[1]).toBeGreaterThanOrEqual(fahSeen[0]);
      expect(fahSeen[1]).toBe(seen[2]);
    } finally {
      early.close();
      fah.close();
    }
  });
});

// The rows of a SensorAuth apply (no authority table), in order, each
// with its payload bits.
function applyRows(payload: Buffer) {
  const br = sensorAuthReader(payload);
  if (br.readBit() !== 0) {
    throw new Error("sensor auth apply has its full-state bit set");
  }
  br.readNumber(32);
  const rows: { bits: number; key: string; payload: Buffer }[] = [];
  if (br.readBit() === 0) {
    return rows;
  }
  while (br.readBit() === 1) {
    const ref = liveAh().SensorClientRef.decode(br);
    const bits = br.readNumber(32);
    const body = new BitWriter();
    for (let i = 0; i < bits; i++) {
      body.writeBit(br.readBit());
    }
    rows.push({
      bits,
      key: `${(ref.bundle >>> 0).toString(16)}:t${ref.typeId}#${ref.typeIndex}`,
      payload: body.finish(),
    });
  }
  return rows;
}

// A row's auth body in an apply: the auth is bound (1) and present (1), then
// the schema (sensor-auth-fields.ts senseEntryPayloadBits).
function applyAuth<T>(
  rows: ReturnType<typeof applyRows>,
  key: string,
  schema: { decode(br: BitReader): T }
): T {
  return schema.decode(applyBody(rows, key));
}

function applyBody(rows: ReturnType<typeof applyRows>, key: string): BitReader {
  const row = rows.find((r) => r.key === key);
  if (!row) {
    throw new Error(`no row ${key} in the apply`);
  }
  const br = new BitReader(row.payload);
  if (br.readBit() !== 1 || br.readBit() !== 1) {
    throw new Error(`row ${key} carries no auth`);
  }
  return br;
}

describeWithPackages("act_cosmo_m0_highway world entry", () => {
  // The world entry in the intro (2.3.1 capture 00-02-34#1): 151 rows.
  it("sends the intro world's 151 rows once each, as captured", () => {
    const { session, pushes, close } = makeSession();
    const hosts = new PlayerHosts();
    hosts.setStartRequest({ activityId: 126 } as never);
    session["bound"] = { host: hosts.fah, hosts, kind: "FAH" };
    session["crossing"].currentSlice = 14;
    session["crossing"].currentBubbleState = 1;
    try {
      session["sensorAuth"].pushApply(1n, "act_cosmo_m0_highway", 14, true);
      const apply = pushes.find((p) => p.label?.includes("world entry"));
      expect(apply).toBeDefined();
      const rows = applyRows(apply?.payload ?? Buffer.alloc(0));
      const keys = rows.map((row) => row.key);
      expect(new Set(keys).size).toBe(keys.length);
      const byBundle = new Map<string, number>();
      for (const key of keys) {
        const bundle = key.split(":")[0] ?? "";
        byBundle.set(bundle, (byBundle.get(bundle) ?? 0) + 1);
      }
      expect(byBundle).toEqual(
        new Map([
          ["4786c0e0", 21],
          ["992bb471", 35],
          ["3c2f5ed5", 52],
          ["ecf574b5", 35],
          ["fc0e45a3", 6],
          ["9243dffb", 1],
          ["62dd95d", 1],
        ])
      );
      expect(keys).toHaveLength(151);
    } finally {
      close();
    }
  });
});

// A new character straight from the Tower. Its pre-world refresh names bubble
// 3, where it last was; its world entry is the refresh with membership 7 in
// bubble 14. The 2.3.1 capture's order: the world entry (14.1, 151 rows),
// then pregame, then the intro cinematic.
describeWithPackages(
  "act_cosmo_m0_highway from join to the intro cinematic",
  () => {
    it("enters 14.1 first, then sends pregame, then the cinematic", () => {
      vi.useFakeTimers();
      const { session, pushes, close } = makeSession();
      const hosts = new PlayerHosts();
      hosts.setStartRequest({ activityId: 126 } as never);
      hosts.setSession("FAH", session as never);
      session["bound"] = { host: hosts.fah, hosts, kind: "FAH" };
      const hex = (h: string) => Buffer.from(h, "hex");
      try {
        session["handleStateRefresh"](1n, hex("0000000080000003"));
        session["crossing"].handleClientAuth(
          1n,
          hex("ac0000038f576119ac0000038a901580")
        );
        session["crossing"].handleClientAuth(1n, hex("a1a0"));
        // Loading: the scripts must not run yet.
        for (let i = 0; i < 5; i++) {
          vi.advanceTimersByTime(1000);
          session["scripts"].tick();
        }
        const worldRows = (label: string) =>
          label.includes("apply rows") || label.includes("script rows");
        expect(pushes.map((p) => p.label ?? "").filter(worldRows)).toEqual([]);
        session["handleStateRefresh"](1n, hex("000000078000000e"));
        session["crossing"].handleClientAuth(
          1n,
          hex("b80000071eaec23358000007152ffffffff02393b8afffffffea1200")
        );
        for (let i = 0; i < 5; i++) {
          vi.advanceTimersByTime(1000);
          session["scripts"].tick();
        }
        const worldPushes = pushes.map((p) => p.label ?? "").filter(worldRows);
        expect(worldPushes[0]).toContain("bubble=14.1 world entry rows=151");
        expect(worldPushes.some((label) => label.includes("bubble=3"))).toBe(
          false
        );
        const scripted = worldPushes.filter((label) =>
          label.includes("script rows")
        );
        const cinematic = scripted.findIndex((label) => label.includes("t6#1"));
        expect(cinematic).toBeGreaterThan(0);
        expect(scripted[0]).toContain("t16#3");
        expect(scripted[0]).not.toContain("t6#1");
      } finally {
        close();
        vi.useRealTimers();
      }
    });
  }
);

function membershipTeleport(payload: Buffer) {
  const br = new BitReader(payload);
  br.readBit();
  const teleport = liveAh().ReplicateMembership.decode(br).pahRegions?.unknown2;
  return (
    teleport && {
      id: teleport.unknown1.unknown0,
      region: teleport.unknown1.unknown1,
      state: teleport.unknown0,
    }
  );
}

function slotTransition(payload: Buffer | undefined) {
  if (!payload) {
    return;
  }
  const br = new BitReader(payload);
  br.readBit();
  return liveAh().ReplicateMembership.decode(br).clients.unknown0[0]?.auth
    ?.transition;
}

// The region a GAS names (initialSlice) and its spawn transition hash.
function gasRegion(payload: Buffer | undefined) {
  const gas = decode(
    liveAh().GlobalActivityState,
    payload ?? Buffer.alloc(0)
  ).state;
  return {
    slice: gas.initialSlice,
    transition: gas.spawnTransitionName >>> 0,
  };
}

function pahRows(payload: Buffer | undefined) {
  if (!payload) {
    return [];
  }
  const br = new BitReader(payload);
  br.readBit();
  return (
    liveAh().ReplicateMembership.decode(br).pahRegions?.unknown0.unknown0 ?? []
  )
    .filter((row) => row.unknown0 !== -1)
    .map((row) => ({
      flag: row.unknown2.unknown3,
      marker: row.unknown4.unknown2.unknown0[0],
      opcode: row.unknown2.unknown1,
      region: row.unknown0,
      slot: row.unknown2.unknown2,
      token: row.unknown2.unknown0,
    }));
}

function pahRow(payload: Buffer | undefined, region: number) {
  const row = pahRows(payload).find((r) => r.region === region);
  return (
    row && {
      flag: row.flag,
      marker: row.marker,
      opcode: row.opcode,
      slot: row.slot,
    }
  );
}

function clientTeleport(state: number, id: number, region: number): Buffer {
  const bw = new BitWriter();
  bw.writeBit(1);
  liveAh().ClientAuthoritativeData.encode(bw, {
    hardWipe: undefined,
    identity: undefined,
    teleport: {
      unknown0: state,
      unknown1: { unknown0: id, unknown1: region, unknown2: 0xea_ec_23_35 },
      unknown2: 0,
    },
    transition: undefined,
  });
  return bw.finish();
}

// A class-21 update carrying only the client's transition: its current and
// pending regions (-1 for none, with the empty hash) and its phase.
function clientTransition(fields: {
  current?: number;
  pending?: number;
  phase?: number;
  token?: number;
}): Buffer {
  const region = (id: number) => ({
    unknown0: id,
    unknown1: id < 0 ? 0x81_1c_9d_c5 : 0x68_93_54_72,
    unknown2: id,
    unknown3: 0,
    unknown4: 0,
    unknown5: undefined,
    unknown6: undefined,
  });
  const bw = new BitWriter();
  bw.writeBit(1);
  liveAh().ClientAuthoritativeData.encode(bw, {
    hardWipe: undefined,
    identity: undefined,
    teleport: undefined,
    transition: {
      unknown0:
        fields.current === undefined ? undefined : region(fields.current),
      unknown1:
        fields.pending === undefined ? undefined : region(fields.pending),
      unknown2: fields.token,
      unknown3: undefined,
      unknown4: fields.phase,
    },
  });
  return bw.finish();
}

// 2.3.1 capture (00-02-34#1): as the intro phase ends, the
// host's membership teleportation goes 1 then 2 (id 2, region 112 = 14.0);
// the client crosses into 112, reports 3 at its world entry, and the host
// answers 3, then 0 when the client goes inactive.
describeWithPackages(
  "act_cosmo_m0_highway intro -> highway teleportation",
  () => {
    it("teleports the client to 14.0 when the intro phase ends", () => {
      vi.useFakeTimers();
      const { session, pushes, close } = makeSession();
      const hosts = new PlayerHosts();
      hosts.setStartRequest({ activityId: 126 } as never);
      hosts.setSession("FAH", session as never);
      session["bound"] = { host: hosts.fah, hosts, kind: "FAH" };
      const hex = (h: string) => Buffer.from(h, "hex");
      const tick = (n: number) => {
        for (let i = 0; i < n; i++) {
          vi.advanceTimersByTime(1000);
          session["scripts"].tick();
        }
      };
      const teleports = () =>
        pushes
          .filter((p) => p.kind === ActivityHostMessageType.ReplicateMembership)
          .map((p) => membershipTeleport(p.payload))
          .filter((t) => t !== undefined && t.state !== 0);
      try {
        activityInstanceFor("act_cosmo_m0_highway", hosts).join({
          ...IDENTITY,
        });
        // The PAH policy has flipped to REVOKE long before the intro ends.
        hosts.pah.noteMatchmakingSearch();
        vi.advanceTimersByTime(11_000);
        session["handleStateRefresh"](1n, hex("0000000080000003"));
        session["handleStateRefresh"](1n, hex("000000078000000e"));
        session["crossing"].handleClientAuth(1n, clientTeleport(0, 1, 113));
        tick(4);
        // No teleportation while the intro runs.
        expect(teleports()).toEqual([]);
        const host = session["scripts"].host as {
          noteCinematicFinished(bundle: number, typeIndex: number): void;
        };
        host.noteCinematicFinished(0x99_2b_b4_71, 1);
        tick(3);
        host.noteCinematicFinished(0x99_2b_b4_71, 2);
        tick(5);
        expect(teleports().slice(0, 2)).toEqual([
          { id: 2, region: 112, state: 1 },
          { id: 2, region: 112, state: 2 },
        ]);
        // The client crossing into 112: it abdicates and
        // abandons its slots first, then pending=112 token=2 phase=2 (with its
        // teleport at 2), its current region gone (no phase), then phase 4
        // with no token. The capture claims only after the pending row.
        pushes.length = 0;
        const abdicate = Buffer.alloc(1537);
        abdicate[0] = 0x0e;
        session["entitySlots"].handle(
          1n,
          ActivityHostMessageType.AbdicateAuthority,
          abdicate
        );
        // The captured abandon: {3, slot 2 and 1 set, raw 4 (3)}.
        const abandon = Buffer.alloc(1538);
        abandon[0] = 0x03;
        abandon[4] = 0x06;
        abandon[1537] = 0x80;
        session["entitySlots"].handle(
          1n,
          ActivityHostMessageType.AbandonEntitySlots,
          abandon
        );
        session["handleStateRefresh"](1n, hex("0000000b7fffffff"));
        const claimed = () =>
          pushes.findIndex(
            (p) =>
              p.kind ===
              ActivityHostMessageType.ClaimAuthorityOverAbandonedEntitySlots
          );
        expect(claimed()).toBe(-1);
        session["crossing"].handleClientAuth(
          1n,
          hex("ac00000387576119ac0000038290280dac06000001c3abb08cd600004d90")
        );
        const pendingRow = pushes.findIndex((p) =>
          p.label?.includes("pending=112 token=2")
        );
        expect(pendingRow).toBeGreaterThanOrEqual(0);
        expect(claimed()).toBeGreaterThan(pendingRow);
        session["crossing"].handleClientAuth(
          1n,
          hex("b7fffffff811c9dc57fffffff58000")
        );
        session["crossing"].handleClientAuth(
          1n,
          hex("ac00000387576119ac00000382c04680")
        );
        // Variant: pending=112 without a phase, then phase 4 alone.
        session["crossing"].handleClientAuth(
          1n,
          hex("ac00000387576119ac00000382c040")
        );
        session["crossing"].handleClientAuth(1n, hex("a1a0"));
        // One claim, for the abandon, in the 1538-byte form, answering its
        // 3-bit value with the next one (2.3.1 capture: 3 -> 4).
        const claims = pushes.filter(
          (p) =>
            p.kind ===
            ActivityHostMessageType.ClaimAuthorityOverAbandonedEntitySlots
        );
        expect(claims).toHaveLength(1);
        expect(claims[0]?.payload.length).toBe(1538);
        expect(claims[0]?.payload[4]).toBe(0x06);
        expect(claims[0]?.payload[1537]).toBe(0xa0);
        // The crossing's pending row stays up through all three.
        session["membership"].push(1n, true);
        const memberships = pushes
          .filter((p) => p.kind === ActivityHostMessageType.ReplicateMembership)
          .map((p) => p.label ?? "");
        expect(memberships.at(-1)).toContain("pending=112 token=2");
        // Its row follows the capture: ASSIGN for our slot, matchmaking done (flag),
        // our token as the marker - even after the policy's REVOKE flip.
        const lastMembership = pushes
          .filter((p) => p.kind === ActivityHostMessageType.ReplicateMembership)
          .at(-1);
        expect(pahRow(lastMembership?.payload, 112)).toEqual({
          flag: true,
          marker: 2,
          opcode: 1,
          slot: 0,
        });
        // And our slot echoes the client's own transition, whose u8 is the
        // teleportation id its synchronize task waits to see (1 here).
        expect(slotTransition(lastMembership?.payload)).toMatchObject({
          unknown2: 2,
          unknown3: 1,
          unknown4: 4,
        });
        // The purge closes the handoff; then the client enters 14.0 and the
        // whole world goes out again.
        // The captured purge request {4, the bitmap} gets {4, epoch, the bitmap}.
        const request = Buffer.alloc(1537);
        request[0] = 0xa0;
        request[4] = 0xc0;
        session["entitySlots"].handle(
          1n,
          ActivityHostMessageType.RequestPurgeEntitySlots,
          request
        );
        const purge = pushes.find(
          (p) => p.kind === ActivityHostMessageType.PurgeAbandonedEntitySlots
        );
        expect(purge?.payload.length).toBe(1538);
        expect([purge?.payload[0], purge?.payload[5]]).toEqual([0xa0, 0xc0]);
        session["handleStateRefresh"](1n, hex("000000108000000e"));
        const entry = pushes
          .map((p) => p.label ?? "")
          .find((label) => label.includes("apply rows"));
        expect(entry).toContain("bubble=14.0 world entry");
        // The captured GAS at this refresh names 112 with the client's hash for
        // it, EAEC2335.
        const gas14 = pushes
          .filter((p) => p.kind === ActivityHostMessageType.GlobalActivityState)
          .at(-1);
        expect(gasRegion(gas14?.payload)).toEqual({
          slice: 112,
          transition: 0xea_ec_23_35,
        });
        // pt_bubble, then enc_highway_m0 sets the lifetime running: the spawn.
        const scripts = session["scripts"].host as {
          itemSink: { lifetimeBody(): FinishedBits };
          noteTriggerFired(bundle: number, typeIndex: number): void;
        };
        scripts.noteTriggerFired(0xec_f5_74_b5, 31);
        tick(2);
        expect(
          decode(liveAh().LifetimeAuth, scripts.itemSink.lifetimeBody().bytes)
            .state
        ).toBe(3);
        session["crossing"].handleClientAuth(1n, clientTeleport(3, 2, 112));
        expect(teleports().at(-1)).toEqual({ id: 2, region: 112, state: 3 });
        pushes.length = 0;
        session["crossing"].handleClientAuth(1n, clientTeleport(0, 2, 112));
        const last = pushes
          .filter((p) => p.kind === ActivityHostMessageType.ReplicateMembership)
          .at(-1);
        expect(membershipTeleport(last?.payload ?? Buffer.alloc(0))).toEqual({
          id: 2,
          region: 112,
          state: 0,
        });

        // The walk from the highway into the breach (region 24 = 3.0), the
        // client's own messages in order (2.3.1 capture):
        // pending=24 token=4 phase=1, 2, 3; abdicate {14, [32]} with the refresh
        // into bubble 3; claim [32] 0.4 s later; purge request; purge + GAS (24 /
        // 68935472) + the whole world (254 rows). Its PAH rows are ASSIGN
        // throughout, and the apply carries the binder.
        pushes.length = 0;
        session["crossing"].handleClientAuth(1n, hex("a120"));
        session["crossing"].handleClientAuth(
          1n,
          hex("ac000000c3449aa394000000c2903500")
        );
        const opened = pushes
          .filter((p) => p.kind === ActivityHostMessageType.ReplicateMembership)
          .at(-1);
        expect(opened?.label).toContain("pending=24 token=3");
        // Rows at phase 1 (7 of 7 2.3.1 captures): the region the client is
        // in, flag on; the one it is crossing into, flag off until phase 3;
        // ASSIGN with token 1 on both, and the crossing's token as marker.
        expect(pahRows(opened?.payload)).toEqual([
          { flag: true, marker: 3, opcode: 1, region: 112, slot: 0, token: 1 },
          { flag: false, marker: 3, opcode: 1, region: 24, slot: 0, token: 1 },
        ]);
        session["crossing"].handleClientAuth(
          1n,
          hex("ac000000c3449aa394000000c2c040")
        );
        session["crossing"].handleClientAuth(1n, hex("a160"));
        const latestRows = () =>
          pahRows(
            pushes
              .filter(
                (p) => p.kind === ActivityHostMessageType.ReplicateMembership
              )
              .at(-1)?.payload
          );
        expect(latestRows().find((row) => row.region === 24)?.flag).toBe(false);
        session["crossing"].handleClientAuth(1n, hex("a180"));
        expect(latestRows().find((row) => row.region === 24)?.flag).toBe(true);
        expect(latestRows().find((row) => row.region === 112)?.flag).toBe(true);
        expect(
          pushes
            .filter(
              (p) => p.kind === ActivityHostMessageType.ReplicateMembership
            )
            .at(-1)?.label
        ).toContain("pending=24 token=3");
        // The captured client abdicates slot 5 of domain 14 as it refreshes.
        const breachAbdicate = Buffer.alloc(1537);
        breachAbdicate[0] = 0x0e;
        breachAbdicate[4] = 0x20;
        session["entitySlots"].handle(
          1n,
          ActivityHostMessageType.AbdicateAuthority,
          breachAbdicate
        );
        session["handleStateRefresh"](1n, hex("0000001e80000003"));
        // The GAS names the breach with the hash the client gave it.
        const gas3 = pushes
          .filter((p) => p.kind === ActivityHostMessageType.GlobalActivityState)
          .at(-1);
        expect(gasRegion(gas3?.payload)).toEqual({
          slice: 24,
          transition: 0x68_93_54_72,
        });
        // The world waits for the handoff; the abdicate's slots are claimed
        // once the batch settles, under the next epoch (2.3.1 capture: 3).
        expect(pushes.map((p) => p.label ?? "")).not.toContainEqual(
          expect.stringContaining("apply rows")
        );
        vi.advanceTimersByTime(300);
        const breachClaims = pushes.filter(
          (p) =>
            p.kind ===
            ActivityHostMessageType.ClaimAuthorityOverAbandonedEntitySlots
        );
        expect(breachClaims).toHaveLength(1);
        expect(breachClaims[0]?.payload.length).toBe(1538);
        expect([
          breachClaims[0]?.payload[0],
          breachClaims[0]?.payload[4],
          breachClaims[0]?.payload[1537],
        ]).toEqual([3, 0x20, 0xa0]);
        // The captured purge request {4, [32]} gets {4, epoch 4, [32]}, and the
        // whole world goes out with it: 254 rows, binder included.
        const breachRequest = Buffer.alloc(1537);
        breachRequest[0] = 0xa0;
        breachRequest[3] = 0x04;
        session["entitySlots"].handle(
          1n,
          ActivityHostMessageType.RequestPurgeEntitySlots,
          breachRequest
        );
        const purgeAt = pushes.findIndex(
          (p) => p.kind === ActivityHostMessageType.PurgeAbandonedEntitySlots
        );
        expect(purgeAt).toBeGreaterThanOrEqual(0);
        expect([
          pushes[purgeAt]?.payload.length,
          pushes[purgeAt]?.payload[0],
          pushes[purgeAt]?.payload[4],
        ]).toEqual([1538, 0xa0, 0x04]);
        const breachEntry = pushes.findIndex((p) =>
          (p.label ?? "").includes("apply rows")
        );
        expect(breachEntry).toBeGreaterThan(purgeAt);
        expect(pushes[breachEntry]?.label).toContain("bubble=3.0 world entry");
        const breachRows = applyRows(
          pushes[breachEntry]?.payload ?? Buffer.alloc(0)
        );
        const byBundle = new Map<string, number>();
        for (const row of breachRows) {
          const bundle = row.key.split(":")[0] ?? "";
          byBundle.set(bundle, (byBundle.get(bundle) ?? 0) + 1);
        }
        expect(byBundle).toEqual(
          new Map([
            ["992bb471", 33],
            ["3c2f5ed5", 57],
            ["4786c0e0", 21],
            ["fc0e45a3", 141],
            ["9243dffb", 1],
            ["62dd95d", 1],
          ])
        );
        expect(breachRows).toHaveLength(254);
        // The breach's trigger group and hop-on rows carry refs to real rows,
        // not bundle 0 / type 0 / row 0: tg_m0_gating refs its bundle's
        // sv_m0_gating with state -1, and ho_ghostlight the unset ref (7 of 7
        // 2.3.1 captures).
        const gating = applyBody(breachRows, "992bb471:t30#36");
        const volume = liveAh().SensorClientRef.decode(gating);
        expect([volume.bundle >>> 0, volume.typeId, volume.typeIndex]).toEqual([
          0x99_2b_b4_71, 58, 54,
        ]);
        expect(gating.readNumber(2)).toBe(0);
        const hopOn = applyBody(breachRows, "fc0e45a3:t24#101");
        expect([hopOn.readBit(), hopOn.readNumber(32)]).toEqual([
          0, 0x80_00_00_00,
        ]);
        const filter = liveAh().SensorClientRef.decode(hopOn);
        expect([filter.bundle >>> 0, filter.typeIndex]).toEqual([
          0x81_1c_9d_c5, -1,
        ]);
        // The region left behind, parked in the pending slot without a token,
        // is not a crossing back.
        session["crossing"].handleClientAuth(
          1n,
          hex("b80000018689354728000001853000000e1d5d8466b000000e0a00")
        );
        expect(session["crossing"].pendingRegion).toEqual({
          regionId: 24,
          token: 3,
        });
        expect(session["crossing"].currentSlice).toBe(3);
        // And no PAH row of this all-private activity ever carried REVOKE.
        const opcodes = pushes
          .filter((p) => p.kind === ActivityHostMessageType.ReplicateMembership)
          .flatMap((p) => pahRows(p.payload).map((row) => row.opcode));
        expect(opcodes.length).toBeGreaterThan(0);
        expect(new Set(opcodes)).toEqual(new Set([1]));

        // The entry goes out as the captured 254 rows, carrying the nests' 14
        // actors placed (7 of 7 captures; crawler8 and the Ghost not). The
        // breach bundle's threads run as the entry is built, with the clock
        // where it is.
        const ACTOR = 2;
        const BREACH = "fc0e45a3";
        const placedActors = [
          78, 79, 81, 82, 83, 80, 84, 85, 87, 88, 89, 90, 92, 93,
        ];
        for (const index of placedActors) {
          const actor = applyAuth(
            breachRows,
            `${BREACH}:t${ACTOR}#${index}`,
            liveAh().ActorAuth
          );
          expect([actor.place, actor.killed, actor.carried]).toEqual([
            true,
            0,
            0,
          ]);
        }
        for (const index of [91, 95]) {
          expect(
            applyAuth(
              breachRows,
              `${BREACH}:t${ACTOR}#${index}`,
              liveAh().ActorAuth
            ).place
          ).toBe(false);
        }
        // The nests' rosters have one cell per member (8 and 7), all open.
        expect(
          applyAuth(breachRows, `${BREACH}:t1#77`, liveAh().SquadAuth).roster
        ).toEqual({ slots: [0, 0, 0, 0, 0, 0, 0, 0] });
        expect(
          applyAuth(breachRows, `${BREACH}:t1#86`, liveAh().SquadAuth).roster
        ).toEqual({ slots: [0, 0, 0, 0, 0, 0, 0] });
        // Nothing re-sends them: the ticks after the entry carry no nest actor.
        const sentAfter = pushes.length;
        tick(2);
        const scriptRows = pushes
          .slice(sentAfter)
          .map((p) => p.label ?? "")
          .filter((label) => label.includes("script rows"));
        expect(scriptRows.join(" ")).not.toMatch(/t2#(7[89]|8\d|9[023])\b/);
        // The table from the entry on: 24 current (flag on), 112 the region
        // left behind (flag off, the crossing's token), until the client stops
        // naming it.
        expect(latestRows()).toEqual([
          { flag: true, marker: 3, opcode: 1, region: 24, slot: 0, token: 1 },
          { flag: false, marker: 3, opcode: 1, region: 112, slot: 0, token: 1 },
        ]);
        session["crossing"].handleClientAuth(
          1n,
          clientTransition({ phase: 1 })
        );
        expect(latestRows().map((row) => row.region)).toEqual([24, 112]);
        session["crossing"].handleClientAuth(
          1n,
          clientTransition({ pending: -1, phase: 0 })
        );
        expect(latestRows()).toEqual([
          { flag: true, marker: 3, opcode: 1, region: 24, slot: 0, token: 1 },
        ]);
      } finally {
        close();
        vi.useRealTimers();
      }
    });
  }
);

describeWithPackages("debug start (debug-toggles.json startPhase)", () => {
  afterEach(() => {
    setDebugTogglesForTest(undefined);
  });

  it("starts act_cosmo_m0_highway in the breach when the toggles name phase 2", () => {
    setDebugTogglesForTest({ startPhase: { act_cosmo_m0_highway: 2 } });
    vi.useFakeTimers();
    const { session, pushes, close, captured } = makeSession();
    const hosts = new PlayerHosts();
    hosts.setStartRequest({ activityId: 126 } as never);
    hosts.setSession("FAH", session as never);
    session["bound"] = { host: hosts.fah, hosts, kind: "FAH" };
    const hex = (h: string) => Buffer.from(h, "hex");
    const lastGas = () =>
      pushes
        .filter((p) => p.kind === ActivityHostMessageType.GlobalActivityState)
        .at(-1);
    try {
      activityInstanceFor("act_cosmo_m0_highway", hosts).join({
        ...IDENTITY,
      });
      // The pre-world refresh: the GAS names the breach (region 24) with the
      // spawn transition the captured GAS gave it.
      session["handleStateRefresh"](1n, hex("0000000080000003"));
      expect(gasRegion(lastGas()?.payload)).toEqual({
        slice: 24,
        transition: 0x68_93_54_72,
      });
      // The world entry is the whole breach world, mid-mission: the lifetime
      // runs phase 2 (bubble 3) and the nests are placed, as the captured
      // breach entry has them.
      session["handleStateRefresh"](1n, hex("0000000780000003"));
      const entry = pushes.find((p) => (p.label ?? "").includes("apply rows"));
      expect(entry?.label).toContain("bubble=3.0 world entry rows=254");
      const rows = applyRows(entry?.payload ?? Buffer.alloc(0));
      const lifetime = applyAuth(rows, "4786c0e0:t16#3", liveAh().LifetimeAuth);
      expect([lifetime.state, lifetime.phaseIndex, lifetime.field4]).toEqual([
        3, 2, 3,
      ]);
      expect(applyAuth(rows, "fc0e45a3:t2#78", liveAh().ActorAuth).place).toBe(
        true
      );
      expect(
        applyAuth(rows, "fc0e45a3:t1#77", liveAh().SquadAuth).roster
      ).toEqual({
        slots: [0, 0, 0, 0, 0, 0, 0, 0],
      });
      // The player spawns and the scripts tick: the root's pregame does not
      // take the lifetime back below running.
      const scripts = session["scripts"].host as {
        itemSink: { lifetimeBody(): FinishedBits };
        notePlayerSpawned(): void;
      };
      scripts.notePlayerSpawned();
      for (let i = 0; i < 4; i++) {
        vi.advanceTimersByTime(1000);
        session["scripts"].tick();
      }
      expect(
        decode(liveAh().LifetimeAuth, scripts.itemSink.lifetimeBody().bytes)
          .state
      ).toBe(3);
      // The toggles are in the log at the join and at the world entry.
      const toggleLines = captured
        .texts()
        .filter((line) => String(line).includes("debug toggles"));
      expect(toggleLines.length).toBeGreaterThanOrEqual(2);
      expect(toggleLines[0]).toContain(
        'debug toggles {"startPhase":{"act_cosmo_m0_highway":2}}'
      );
    } finally {
      close();
      vi.useRealTimers();
    }
  });

  // The hangar's client opens a crossing into region 56 and stays at phase 2 to
  // the end (the captured one does the same, 7 of 7), which must not hold the
  // outro teleport; set_activity_complete must not push the players' BAP
  // completion with the outro cinematic just started, as the client leaves at
  // once. 2.3.1 capture (00-02-34): obj_m0_m04b clears, the lifetime names
  // the outro, the host teleports the client to 13.1 regardless of its crossing
  // (the 56 row goes), the cinematic plays, and the lifetime ends shortly
  // after it finishes.
  it("teleports to the outro past a standing crossing and completes the activity when the lifetime ends", () => {
    setDebugTogglesForTest({ startPhase: { act_cosmo_m0_highway: 5 } });
    vi.useFakeTimers();
    const { session, pushes, close, captured } = makeSession();
    const hosts = new PlayerHosts();
    hosts.setStartRequest({ activityId: 126 } as never);
    hosts.setSession("FAH", session as never);
    session["bound"] = { host: hosts.fah, hosts, kind: "FAH" };
    const hex = (h: string) => Buffer.from(h, "hex");
    const HANGAR = 0x06_2d_d9_5d;
    const MISSION = 0x99_2b_b4_71;
    const tick = (n: number) => {
      for (let i = 0; i < n; i++) {
        vi.advanceTimersByTime(1000);
        session["scripts"].tick();
      }
    };
    const teleports = () =>
      pushes
        .filter((p) => p.kind === ActivityHostMessageType.ReplicateMembership)
        .map((p) => membershipTeleport(p.payload))
        .filter((t) => t !== undefined && t.state !== 0);
    const completed = () =>
      captured.texts().filter((line) => line.includes("complete for char"))
        .length;
    try {
      activityInstanceFor("act_cosmo_m0_highway", hosts).join({
        ...IDENTITY,
      });
      session["handleStateRefresh"](1n, hex("0000000080000003"));
      session["handleStateRefresh"](1n, hex("000000078000000d"));
      const entry = pushes.find((p) => (p.label ?? "").includes("apply rows"));
      expect(entry?.label).toContain("bubble=13.0 world entry");
      // enc_hangar_m0 gave every squad its objective as the bubble came up:
      // the captured entry carries ref0 on all eight, task -1.
      const rows = applyRows(entry?.payload ?? Buffer.alloc(0));
      const gating = applyAuth(rows, "62dd95d:t1#7", liveAh().SquadAuth);
      expect(gating.ref0).toEqual({ bundle: HANGAR, typeId: 3, typeIndex: 4 });
      expect(gating.task).toBe(-1);
      const scripts = session["scripts"].host as {
        noteCinematicFinished(bundle: number, typeIndex: number): void;
        notePlayerSpawned(): void;
        noteSquadAlive(bundle: number, typeIndex: number, count: number): void;
        noteTriggerFired(bundle: number, typeIndex: number): void;
      };
      scripts.notePlayerSpawned();
      // Find the Ship, then Clear Out the Fallen: the ship objective's
      // trigger fires (its arm keeps the fire), sq_m0_fallen_2 comes up on
      // its task and goes down.
      tick(4);
      scripts.noteTriggerFired(MISSION, 41);
      scripts.noteTriggerFired(HANGAR, 18);
      tick(6);
      expect(
        captured
          .texts()
          .some((line) => line.includes("sq_m0_fallen_2:set_task"))
      ).toBe(true);
      scripts.noteSquadAlive(HANGAR, 12, 2);
      tick(2);
      scripts.noteSquadAlive(HANGAR, 12, 0);
      // The client stands in a crossing into region 56 at phase 2 as the
      // hangar clears (2.3.1 capture).
      session["crossing"].handleClientAuth(
        1n,
        clientTransition({ pending: 56, phase: 2, token: 6 })
      );
      expect(session["crossing"].pendingRegion).toEqual({
        regionId: 56,
        token: 6,
      });
      expect(teleports()).toEqual([]);
      tick(10);
      // The outro: the lifetime names it and the host teleports to 13.1 with
      // the crossing dropped, the cinematic plays, nobody is complete yet.
      const steps = teleports().filter(
        (t, i, all) => i === 0 || t?.state !== all[i - 1]?.state
      );
      expect(steps.slice(0, 2)).toEqual([
        { id: 1, region: 105, state: 1 },
        { id: 1, region: 105, state: 2 },
      ]);
      expect(session["crossing"].pendingRegion).toBeUndefined();
      tick(8);
      expect(
        captured
          .texts()
          .some((line) => line.includes("set_activity_complete()"))
      ).toBe(true);
      expect(completed()).toBe(0);
      scripts.noteCinematicFinished(MISSION, 29);
      tick(4);
      expect(completed()).toBe(1);
    } finally {
      close();
      vi.useRealTimers();
    }
  });
});

// TU0's hard wipe through a session, on act_cosmo_m0_highway's intro phase:
// the player's sense says it is dead, the host states the handshake, the
// clients go black, the phase is reset and everyone sent to its start, and the
// host returns to idle. No script says @hard_wipe(), so the test arms the
// running phase itself.
describeWithPackages("act_cosmo_m0_highway hard wipe", () => {
  function wipeNest(payload: Buffer | undefined) {
    if (!payload) {
      return;
    }
    const br = new BitReader(payload);
    br.readBit();
    const nest = liveAh().ReplicateMembership.decode(br).pahRegions?.unknown1;
    return nest && { cookie: nest.unknown0, state: nest.unknown1 };
  }

  // The sense update of the binder's first player row: dead, and asking to
  // respawn.
  function playerSense(dead: boolean) {
    const binder = activityBinder("act_cosmo_m0_highway");
    if (!binder) {
      throw new Error("no binder");
    }
    const bw = new BitWriter(256);
    bw.write(0x80, 8);
    bw.writeBit(0);
    bw.writeBit(0);
    bw.writeBit(1);
    liveAh().SensorClientRef.encode(bw, {
      bundle: binder.bundle,
      typeId: 12,
      typeIndex: binder.players[0],
    });
    bw.writeBit(1);
    liveAh().PlayerAuth.encode(bw, {
      flag: true,
      identity: {
        activityFlags: { flags: [] },
        faction: 0,
        key: 0n,
        unknown1: 0,
      },
      unknown0: {
        unknown0: 0,
        unknown1: 0,
        unknown2: false,
        unknown3: false,
        unknown4: dead,
        unknown5: 0,
        unknown6: 0,
      },
      unknown1: {
        unknown0: 0,
        unknown1: dead,
        unknown2: false,
        unknown3: false,
      },
      unknown4: 0,
    });
    bw.write(7, 32);
    bw.writeBit(0);
    return bw.finish();
  }

  // The client's hard wipe in a class 21 update.
  function wipeReport(state: number, cookie: number) {
    const bw = new BitWriter(32);
    bw.writeBit(1);
    liveAh().ClientAuthoritativeData.encode(bw, {
      hardWipe: { unknown0: state, unknown1: cookie, unknown2: 0 },
      identity: undefined,
      teleport: undefined,
      transition: undefined,
    });
    return bw.finish();
  }

  it("walks the handshake from the sense's death to the host idle again", () => {
    vi.useFakeTimers();
    const { session, pushes, close } = makeSession();
    const hosts = new PlayerHosts();
    hosts.setStartRequest({ activityId: 126 } as never);
    hosts.setSession("FAH", session as never);
    session["bound"] = { host: hosts.fah, hosts, kind: "FAH" };
    const hex = (h: string) => Buffer.from(h, "hex");
    const tick = (n: number) => {
      for (let i = 0; i < n; i++) {
        vi.advanceTimersByTime(1000);
        session["scripts"].tick();
      }
    };
    const nest = () =>
      wipeNest(
        pushes
          .filter((p) => p.kind === ActivityHostMessageType.ReplicateMembership)
          .at(-1)?.payload
      );
    const teleports = () =>
      pushes
        .filter((p) => p.kind === ActivityHostMessageType.ReplicateMembership)
        .map((p) => membershipTeleport(p.payload))
        .filter((t) => t !== undefined && t.state !== 0);
    try {
      activityInstanceFor("act_cosmo_m0_highway", hosts).join({
        ...IDENTITY,
      });
      vi.advanceTimersByTime(11_000);
      session["handleStateRefresh"](1n, hex("0000000080000003"));
      session["handleStateRefresh"](1n, hex("000000078000000e"));
      session["crossing"].handleClientAuth(1n, clientTeleport(0, 1, 113));
      const host = session["scripts"].host as ScriptHost;
      host.notePlayerSpawned();
      activityInstanceFor("act_cosmo_m0_highway", hosts).noteSpawned({
        ...IDENTITY,
      });
      tick(4);
      const phase = host.runtime.phases[host.runtime.phaseIndex];
      phase.hardWipe = true;
      const before = phase.instance;
      expect(nest()).toEqual({ cookie: 0, state: 0 });

      // alive: its sense says so, and nothing starts
      session["scripts"].handleSensorSense(
        1n,
        "act_cosmo_m0_highway",
        playerSense(false)
      );
      tick(2);
      expect(host.allPlayersDead).toBe(false);

      // dead, by the sense alone: the host states the wipe
      session["scripts"].handleSensorSense(
        1n,
        "act_cosmo_m0_highway",
        playerSense(true)
      );
      expect(host.allPlayersDead).toBe(true);
      tick(2);
      expect(nest()).toEqual({ cookie: 1, state: 1 });
      expect(phase.instance).toBe(before);

      // its screens go black one step at a time; the host waits for the last
      for (const state of [1, 2, 3]) {
        session["crossing"].handleClientAuth(1n, wipeReport(state, 1));
        tick(1);
        expect(phase.instance).toBe(before);
      }
      expect(teleports()).toEqual([]);
      session["crossing"].handleClientAuth(1n, wipeReport(4, 1));
      tick(1);

      // black: the phase is reset and everyone is sent to its start, still on
      // their screens
      expect(phase.instance).not.toBe(before);
      expect(teleports()[0]).toMatchObject({ id: 2, region: 113, state: 1 });
      expect(nest()).toEqual({ cookie: 1, state: 1 });

      // the host waits out the move: a respawn asked before the teleport is
      // lost in it, and the teleport's own end asks none while a wipe runs
      session["crossing"].handleClientAuth(1n, clientTeleport(3, 2, 113));
      tick(2);
      expect(nest()).toEqual({ cookie: 1, state: 1 });

      // moved: the host says 4, which sends the screens away and the players
      // back where they now stand
      session["crossing"].handleClientAuth(1n, clientTeleport(0, 2, 113));
      tick(1);
      expect(nest()).toEqual({ cookie: 1, state: 4 });

      // the client is back to idle, and the host with it; the player still
      // reads as dead until its respawn lands, which is no new wipe
      session["crossing"].handleClientAuth(1n, wipeReport(0, 1));
      tick(3);
      expect(nest()).toEqual({ cookie: 1, state: 0 });
      expect(session["scripts"].hardWipe.active).toBe(false);

      // it respawned; dying again is a wipe of its own
      session["scripts"].handleSensorSense(
        1n,
        "act_cosmo_m0_highway",
        playerSense(false)
      );
      tick(2);
      expect(nest()).toEqual({ cookie: 1, state: 0 });
      session["scripts"].handleSensorSense(
        1n,
        "act_cosmo_m0_highway",
        playerSense(true)
      );
      tick(2);
      expect(nest()).toEqual({ cookie: 2, state: 1 });
    } finally {
      close();
      vi.useRealTimers();
    }
  });
});
