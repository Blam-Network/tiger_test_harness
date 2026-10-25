import { Socket } from "node:net";
import { events_dispose } from "@blamnetwork/datamine";
import { afterEach, describe, expect, it } from "vitest";
import {
  makeSession,
  startRequest,
} from "../test-support/activity-host-session";
import { ActivityHostManager } from "./activity-host-manager";
import { ActivityHostMessageType } from "./messages";
import { anonymousHosts, PlayerHosts } from "./player-hosts";
import { isLeftBehindRegion } from "./region-crossing";
import { sensorAuthReader } from "./rsat/sensor-auth-fields";
import { ActivityHostProxySession } from "./session";

afterEach(() => events_dispose());

describe("activity host session sensor identity", () => {
  it("keys SensorAuth on the character id (Tower-proven; the captured grant carries no join identity)", () => {
    const socket = new Socket();
    const session = new ActivityHostProxySession(
      socket,
      new ActivityHostManager()
    );
    const boundHosts = new PlayerHosts();
    session["bound"] = { host: boundHosts.fah, hosts: boundHosts, kind: "FAH" };
    try {
      // Distinct values. The key semantics are still open: neither the player
      // id nor the character id shows in the 2.3.1 grant capture; the
      // character id is the value the Tower spawns with.
      session["joinIdentity"] = {
        account: 0x100000001n,
        character: 0x200000002n,
        machine: Buffer.from("7c1e52a389ce0000", "hex"),
        player: Buffer.from("91aa24169863498d", "hex"),
      };
      // Both join grant and destination apply consume these options.
      expect(session["sensorAuth"].opts().playerKey).toBe(0x200000002n);
    } finally {
      socket.emit("close");
      socket.destroy();
    }
  });

  it("promotes the authority table after every state-refresh", () => {
    const { session, pushes, close } = makeSession();
    try {
      session["handleStateRefresh"](1n, Buffer.alloc(8));
      pushes.length = 0;
      session["handleStateRefresh"](1n, Buffer.alloc(8));
      const kinds = pushes.map((p) => p.kind);
      const gas = kinds.indexOf(ActivityHostMessageType.GlobalActivityState);
      const wgs = kinds.indexOf(ActivityHostMessageType.WorldGlobalsState);
      const promote = kinds.indexOf(
        ActivityHostMessageType.SensorAuthUpdate,
        wgs
      );
      expect(gas).toBeGreaterThanOrEqual(0);
      expect(wgs).toBe(gas + 1);
      expect(promote).toBe(wgs + 1);
      // Table bit set: this is what re-initialises the guest's sensor client.
      expect(sensorAuthReader(pushes[promote].payload).readBit()).toBe(1);
      // Identical table each time: a dropped or re-sequenced held slot
      // asserts in the guest.
      const first = pushes[promote].payload;
      pushes.length = 0;
      session["handleStateRefresh"](1n, Buffer.alloc(8));
      const again = pushes.find(
        (p) => p.kind === ActivityHostMessageType.SensorAuthUpdate
      );
      // Only the activity-time field may differ.
      expect(again?.payload.length).toBe(first.length);
      expect(again?.payload.subarray(0, 8)).toEqual(first.subarray(0, 8));
    } finally {
      close();
    }
  });
});

describe("an unknown player on an activity host manager", () => {
  it("answers an unknown player from the anonymous hosts", () => {
    const { session, close } = makeSession();
    session["bound"] = undefined;
    try {
      session["handleActivityHostManager"](
        startRequest(0x100000099n, 0x200000099n)
      );
      expect(session["hosts"]).toBe(anonymousHosts);
    } finally {
      close();
    }
  });
});

// After the swap into bubble 10 committed, the client reported
// current=80 pending=168 token=- : bubble 21, the region it had just left,
// parked in the pending slot. Borrowing the last crossing's token for it
// opened a crossing back into 21, and its apply hit the torn-down world.
describe("isLeftBehindRegion", () => {
  it("does not treat a token-less pending region as a new crossing", () => {
    expect(isLeftBehindRegion(168, undefined, { regionId: 80 })).toBe(true);
  });

  it("opens a crossing when the client names its own token", () => {
    expect(isLeftBehindRegion(168, 3, { regionId: 80 })).toBe(false);
    expect(isLeftBehindRegion(80, 2, undefined)).toBe(false);
  });

  it("lets a token-less follow-up for the crossing under way through", () => {
    expect(isLeftBehindRegion(80, undefined, { regionId: 80 })).toBe(false);
  });
});
