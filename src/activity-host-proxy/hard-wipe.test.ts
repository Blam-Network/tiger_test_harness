import { describe, expect, it } from "vitest";
import { HardWipe } from "./hard-wipe";
import type { HostHardWipe } from "./rsat";
import type { ClientHardWipe, HardWipeRules } from "./versions";
import { hardWipeRules as alphaRules } from "./versions/v36735_13_12_02_1953_alpha/hard-wipe";
import { hardWipeRules as liveRules } from "./versions/v41375_14_07_03_1501_live/hard-wipe";

// An activity client's hard wipe as the build's runs it (docs/hard-wipe.md):
// each update does one step against the host's nest, and it reports its
// struct after every one.
interface FakeClient {
  update(host: HostHardWipe): ClientHardWipe;
}

// The alpha's: a cookie it has not completed opens the screen, the host
// saying complete closes it, and its last cookie catches up.
class AlphaClient implements FakeClient {
  current = 0;
  last = 0;
  state = 0;
  // Updates it takes to show its screen for long enough.
  private readonly screenUpdates = 2;
  private shown = 0;

  update(host: HostHardWipe): ClientHardWipe {
    if (this.last !== host.cookie) {
      if (this.current !== host.cookie) {
        this.current = host.cookie;
        this.state = 0;
        this.shown = 0;
      } else if (this.state === 0) {
        this.state = 1;
      } else if (this.state === 1) {
        this.shown += 1;
        if (this.shown >= this.screenUpdates) {
          this.state = 2;
        }
      } else if (this.state === 2 && host.state === 3) {
        this.state = 3;
      } else if (this.state === 3) {
        this.last = this.last === 255 ? 1 : this.last + 1;
      }
    }
    return {
      currentCookie: this.current,
      lastCookie: this.last,
      startTime: 0,
      state: this.state,
    };
  }
}

// TU0's: a host state that is not 0 or 4 starts it, it fades to black
// (1 -> 2 -> 3 -> 4) and comes back to 0 once the host says 4. It copies the
// cookie and keeps no last one.
class LiveClient implements FakeClient {
  cookie = 0;
  state = 0;

  update(host: HostHardWipe): ClientHardWipe {
    if (this.state === 0) {
      if (host.state !== 0 && host.state !== 4) {
        this.state = 1;
        this.cookie = host.cookie;
      }
    } else if (this.state < 4) {
      this.state += 1;
    } else if (host.state === 4) {
      this.state = 0;
    }
    return { currentCookie: this.cookie, startTime: 0, state: this.state };
  }
}

// Updates every client until the wipe is idle again, the way a session
// drives it; the world resets once, and how often is counted.
function run(wipe: HardWipe, clients: ReadonlyMap<number, FakeClient>) {
  let resets = 0;
  const nests: HostHardWipe[] = [wipe.host];
  for (let step = 0; step < 50 && wipe.active; step++) {
    for (const [member, client] of clients) {
      wipe.report(member, client.update(wipe.host));
    }
    if (wipe.resetDue()) {
      resets += 1;
      wipe.noteReset();
    }
    if (wipe.finishDue()) {
      wipe.finish();
    }
    if (wipe.host.state !== nests.at(-1)?.state) {
      nests.push(wipe.host);
    }
  }
  return { nests, resets };
}

interface Case {
  client(): FakeClient;
  // A client that has completed the wipe of the cookie.
  done(cookie: number): ClientHardWipe;
  name: string;
  rules: HardWipeRules;
  // A client that has not seen the wipe.
  unaware: ClientHardWipe;
  // A client with its screen up and waiting on the host, for the cookie.
  waiting(cookie: number): ClientHardWipe;
}

const CASES: Case[] = [
  {
    client: () => new AlphaClient(),
    done: (cookie) => ({
      currentCookie: cookie,
      lastCookie: cookie,
      startTime: 0,
      state: 3,
    }),
    name: "the alpha's",
    rules: alphaRules,
    unaware: { currentCookie: 0, lastCookie: 0, startTime: 0, state: 0 },
    waiting: (cookie) => ({
      currentCookie: cookie,
      lastCookie: cookie - 1,
      startTime: 0,
      state: 2,
    }),
  },
  {
    client: () => new LiveClient(),
    done: (cookie) => ({ currentCookie: cookie, startTime: 0, state: 0 }),
    name: "TU0's",
    rules: liveRules,
    unaware: { currentCookie: 0, startTime: 0, state: 0 },
    waiting: (cookie) => ({ currentCookie: cookie, startTime: 0, state: 4 }),
  },
];

describe.each(CASES)("hard wipe, $name rules", (build) => {
  const wipeOf = () => new HardWipe(build.rules);

  it("starts idle, as a fresh activity client is", () => {
    const wipe = wipeOf();
    expect(wipe.host.cookie).toBe(0);
    expect(wipe.host.state).toBe(0);
    expect(wipe.active).toBe(false);
    expect(wipe.resetDue()).toBe(false);
    expect(wipe.finishDue()).toBe(false);
  });

  it("resets the world once the screens are up, then completes", () => {
    const wipe = wipeOf();
    const client = build.client();
    wipe.start([0]);
    expect(wipe.active).toBe(true);
    expect(wipe.host.cookie).toBe(1);
    expect(wipe.host.state).not.toBe(0);
    expect(run(wipe, new Map([[0, client]])).resets).toBe(1);
    expect(wipe.active).toBe(false);
    expect(wipe.host.state).toBe(0);
  });

  it("holds the world until a client has its screen up", () => {
    const wipe = wipeOf();
    wipe.start([0]);
    wipe.report(0, build.unaware);
    expect(wipe.resetDue()).toBe(false);
    wipe.report(0, build.waiting(1));
    expect(wipe.resetDue()).toBe(true);
  });

  it("waits on every member", () => {
    const wipe = wipeOf();
    wipe.start([0, 1]);
    wipe.report(0, build.waiting(1));
    expect(wipe.resetDue()).toBe(false);
    wipe.report(1, build.unaware);
    expect(wipe.resetDue()).toBe(false);
    wipe.report(1, build.waiting(1));
    expect(wipe.resetDue()).toBe(true);
    wipe.noteReset();
    wipe.report(0, build.done(1));
    expect(wipe.finishDue()).toBe(false);
    wipe.report(1, build.done(1));
    expect(wipe.finishDue()).toBe(true);
  });

  it("runs two clients through together", () => {
    const wipe = wipeOf();
    const clients = new Map([
      [0, build.client()],
      [3, build.client()],
    ]);
    wipe.start(clients.keys());
    expect(run(wipe, clients).resets).toBe(1);
    expect(wipe.active).toBe(false);
  });

  it("stops waiting on a member that leaves", () => {
    const wipe = wipeOf();
    wipe.start([0, 1]);
    wipe.report(0, build.waiting(1));
    wipe.leave(1);
    expect(wipe.resetDue()).toBe(true);
  });

  it("stops waiting on a member that leaves while the clients complete", () => {
    const wipe = wipeOf();
    wipe.start([0, 1]);
    wipe.report(0, build.waiting(1));
    wipe.report(1, build.waiting(1));
    wipe.noteReset();
    wipe.report(0, build.done(1));
    expect(wipe.finishDue()).toBe(false);
    wipe.leave(1);
    expect(wipe.finishDue()).toBe(true);
  });

  it("ends with its last member", () => {
    const wipe = wipeOf();
    wipe.start([0, 1]);
    wipe.leave(0);
    expect(wipe.active).toBe(true);
    wipe.leave(1);
    expect(wipe.active).toBe(false);
    expect(wipe.host.state).toBe(0);
  });

  it("does not hear a client that is not part of the wipe", () => {
    const wipe = wipeOf();
    wipe.start([0]);
    wipe.report(5, build.waiting(1));
    expect(wipe.resetDue()).toBe(false);
    wipe.report(0, build.waiting(1));
    wipe.finish();
    wipe.report(0, build.waiting(2));
    wipe.start([0]);
    expect(wipe.resetDue()).toBe(false);
  });

  it("is a new connection's own: it starts again idle", () => {
    const first = wipeOf();
    first.start([0]);
    run(first, new Map([[0, build.client()]]));
    expect(first.host.cookie).toBe(1);
    expect(wipeOf().host.cookie).toBe(0);
  });

  it("refuses a second wipe while one runs, one with nobody, and a reset with none", () => {
    const wipe = wipeOf();
    expect(() => wipe.start([])).toThrow(/member/);
    expect(() => wipe.noteReset()).toThrow(/no hard wipe/);
    wipe.start([0]);
    expect(() => wipe.start([0])).toThrow(/already running/);
  });
});

describe("hard wipe, the alpha's rules", () => {
  const alpha = () => new HardWipe(alphaRules);

  it("states the cookie and the last completed one, and the state 3 once reset", () => {
    const wipe = alpha();
    const client = new AlphaClient();
    wipe.start([0]);
    expect(wipe.host).toEqual({ completedCookie: 0, cookie: 1, state: 1 });
    const { nests } = run(wipe, new Map([[0, client]]));
    expect(nests).toEqual([
      { completedCookie: 0, cookie: 1, state: 1 },
      { completedCookie: 0, cookie: 1, state: 3 },
      { completedCookie: 1, cookie: 1, state: 0 },
    ]);
    expect(client.last).toBe(1);
  });

  it("does not take a screen up for an earlier cookie", () => {
    const wipe = alpha();
    wipe.start([0]);
    wipe.report(0, {
      currentCookie: 7,
      lastCookie: 6,
      startTime: 0,
      state: 2,
    });
    expect(wipe.resetDue()).toBe(false);
  });

  it("goes round past 255 to 1, never 0", () => {
    const wipe = alpha();
    const client = new AlphaClient();
    const clients = new Map([[0, client]]);
    const cookies: number[] = [];
    for (let i = 0; i < 257; i++) {
      wipe.start(clients.keys());
      cookies.push(wipe.host.cookie);
      expect(run(wipe, clients).resets).toBe(1);
      expect(wipe.host.completedCookie).toBe(wipe.host.cookie);
    }
    expect(cookies.slice(253, 257)).toEqual([254, 255, 1, 2]);
    expect(cookies).not.toContain(0);
    expect(client.last).toBe(2);
  });

  it("never completes for a client that reports no last cookie", () => {
    const wipe = alpha();
    wipe.start([0]);
    wipe.report(0, { currentCookie: 1, startTime: 0, state: 2 });
    expect(wipe.resetDue()).toBe(true);
    wipe.noteReset();
    wipe.report(0, { currentCookie: 1, startTime: 0, state: 3 });
    expect(wipe.finishDue()).toBe(false);
  });
});

describe("hard wipe, TU0's rules", () => {
  const live = () => new HardWipe(liveRules);

  it("walks the host's state 0, 1, 4, 0 under one cookie that went up", () => {
    const wipe = live();
    const client = new LiveClient();
    wipe.start([0]);
    expect(wipe.host).toEqual({ cookie: 1, state: 1 });
    const { nests } = run(wipe, new Map([[0, client]]));
    expect(nests).toEqual([
      { cookie: 1, state: 1 },
      { cookie: 1, state: 4 },
      { cookie: 1, state: 0 },
    ]);
    expect(client.cookie).toBe(1);
  });

  it("keeps the screens up while the reset world waits on the move", () => {
    const wipe = live();
    wipe.start([0]);
    wipe.report(0, { currentCookie: 1, startTime: 0, state: 4 });
    expect(wipe.returnDue()).toBe(false);
    wipe.noteWorldReset();
    // reset once: the clients are still black, but the world is done
    expect(wipe.resetDue()).toBe(false);
    expect(wipe.returnDue()).toBe(true);
    expect(wipe.host.state).toBe(1);
    wipe.noteReset();
    expect(wipe.returnDue()).toBe(false);
    expect(wipe.host.state).toBe(4);
    expect(() => wipe.noteWorldReset()).toThrow(/waiting to be reset/);
  });

  it("has no completed cookie to state", () => {
    const wipe = live();
    expect(wipe.host).not.toHaveProperty("completedCookie");
  });

  it("keeps the host at 4 until every client is back to 0, then idles", () => {
    const wipe = live();
    wipe.start([0, 1]);
    wipe.report(0, { currentCookie: 1, startTime: 0, state: 4 });
    wipe.report(1, { currentCookie: 1, startTime: 0, state: 4 });
    expect(wipe.resetDue()).toBe(true);
    wipe.noteReset();
    wipe.report(0, { currentCookie: 1, startTime: 0, state: 0 });
    expect(wipe.finishDue()).toBe(false);
    expect(wipe.host.state).toBe(4);
    wipe.report(1, { currentCookie: 1, startTime: 0, state: 0 });
    expect(wipe.finishDue()).toBe(true);
    wipe.finish();
    expect(wipe.host.state).toBe(0);
  });

  it("does not take a client still fading to black for one that is", () => {
    const wipe = live();
    wipe.start([0]);
    for (const state of [0, 1, 2, 3]) {
      wipe.report(0, { currentCookie: 1, startTime: 0, state });
      expect(wipe.resetDue()).toBe(false);
    }
  });

  it("counts the cookie round its byte, which the client never compares", () => {
    const wipe = live();
    const clients = new Map([[0, new LiveClient()]]);
    for (let i = 0; i < 257; i++) {
      wipe.start(clients.keys());
      expect(run(wipe, clients).resets).toBe(1);
    }
    expect(wipe.host.cookie).toBe(1);
  });
});
