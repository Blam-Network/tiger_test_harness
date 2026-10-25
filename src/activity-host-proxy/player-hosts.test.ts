import { describe, expect, it } from "vitest";
import { PlayerHosts } from "./player-hosts";

describe("PlayerHosts", () => {
  it("starts with a FAH and no GAH", () => {
    const hosts = new PlayerHosts();
    expect(hosts.fah.id).not.toBe(0n);
    expect(hosts.gah).toBeUndefined();
    expect(hosts.isGahBound()).toBe(false);
  });

  it("binds the first session as FAH and the next as a distinct GAH", () => {
    const hosts = new PlayerHosts();
    expect(hosts.bind()).toBe("FAH");
    expect(hosts.bind()).toBe("GAH");
    expect(hosts.isGahBound()).toBe(true);
    expect(hosts.gah?.id).toBeDefined();
    expect(hosts.gah?.id).not.toBe(hosts.fah.id);
    expect(hosts.host("GAH")).toBe(hosts.gah);
    expect(hosts.host("FAH")).toBe(hosts.fah);
  });

  it("rebinds FAH after the FAH session unbinds", () => {
    const hosts = new PlayerHosts();
    expect(hosts.bind()).toBe("FAH");
    hosts.unbind("FAH");
    expect(hosts.bind()).toBe("FAH");
  });

  it("re-grants entity indices after FAH unbind so a reconnect is not ENUM(26)", () => {
    const hosts = new PlayerHosts();
    expect(hosts.fah.takeFirstEntityIndexGrant()).not.toBeNull();
    expect(hosts.fah.takeFirstEntityIndexGrant()).toBeNull();
    hosts.unbind("FAH");
    expect(hosts.fah.takeFirstEntityIndexGrant()).not.toBeNull();
  });

  // A public load-zone crossing arrives as one more start request while a GAH
  // is already bound. The client fills its pending public record itself with a
  // full join on a new socket, and routes AH notifications to the first record
  // whose id matches - so it needs a distinct host, never the current one.
  it("binds a start request during a public crossing to a new pending GAH", () => {
    const hosts = new PlayerHosts();
    hosts.bind();
    const current = hosts.bindHost();
    const pending = hosts.bindHost();
    expect(pending.kind).toBe("GAH");
    expect(pending.host).toBe(hosts.pendingGah);
    expect(pending.host).not.toBe(current.host);
    // Low 32 bits: the guest's AH-id compare reads only those.
    expect(pending.host.id & 0xff_ff_ff_ffn).not.toBe(
      current.host.id & 0xff_ff_ff_ffn
    );
    expect(hosts.gah).toBe(current.host);
  });

  it("promotes the pending GAH when the old public host's socket closes", () => {
    const hosts = new PlayerHosts();
    hosts.bind();
    hosts.bindHost();
    const pending = hosts.bindHost();
    hosts.unbind("GAH", hosts.gah);
    expect(hosts.gah).toBe(pending.host);
    expect(hosts.pendingGah).toBeUndefined();
    expect(hosts.isGahBound()).toBe(true);
  });

  it("drops the pending GAH when an aborted crossing closes its socket", () => {
    const hosts = new PlayerHosts();
    hosts.bind();
    const current = hosts.bindHost();
    const pending = hosts.bindHost();
    hosts.unbind("GAH", pending.host);
    expect(hosts.gah).toBe(current.host);
    expect(hosts.pendingGah).toBeUndefined();
    expect(hosts.isGahBound()).toBe(true);
  });

  // The swap reaches every socket in no fixed order, and the client keeps the
  // old public record open (as PUBLIC TARGET) until the transition stops, so
  // promotion happens on the refresh and the old host is retired at once.
  it("retires the old public host when the pending one is promoted", () => {
    const hosts = new PlayerHosts();
    hosts.bind();
    const current = hosts.bindHost();
    const pending = hosts.bindHost();
    expect(hosts.isRetiredHost(current.host)).toBe(false);
    hosts.promotePendingGah();
    expect(hosts.gah).toBe(pending.host);
    expect(hosts.isRetiredHost(current.host)).toBe(true);
    expect(hosts.isRetiredHost(pending.host)).toBe(false);
    expect(hosts.isRetiredHost(hosts.fah)).toBe(false);
    // Promoting twice - once per socket's refresh - is harmless.
    hosts.promotePendingGah();
    expect(hosts.gah).toBe(pending.host);
  });

  it("keeps the new public session when the retired host's socket closes", () => {
    const hosts = new PlayerHosts();
    const oldSession = { tag: "old" } as never;
    const newSession = { tag: "new" } as never;
    hosts.bind();
    const current = hosts.bindHost();
    hosts.setSession("GAH", oldSession, current.host);
    const pending = hosts.bindHost();
    hosts.setSession("GAH", newSession, pending.host);
    hosts.promotePendingGah();
    expect(hosts.session("GAH")).toBe(newSession);
    // The client disposes of the old record: its socket closes.
    hosts.setSession("GAH", undefined, current.host);
    hosts.unbind("GAH", current.host);
    expect(hosts.session("GAH")).toBe(newSession);
    expect(hosts.gah).toBe(pending.host);
    expect(hosts.isGahBound()).toBe(true);
  });

  // The client can dispose of its only public record at a swap. The next
  // public region it enters still needs a live ambassador, and the public
  // host it then asks for is a new instance with a new id.
  it("remembers a public host existed after its socket closes", () => {
    const hosts = new PlayerHosts();
    hosts.bind();
    expect(hosts.hasHadGah()).toBe(false);
    const first = hosts.bindHost();
    expect(hosts.hasHadGah()).toBe(true);
    hosts.unbind("GAH", first.host);
    expect(hosts.isGahBound()).toBe(false);
    expect(hosts.hasHadGah()).toBe(true);
    const second = hosts.bindHost();
    expect(second.kind).toBe("GAH");
    expect(second.host).not.toBe(first.host);
    expect(second.host.id).not.toBe(first.host.id);
    // Leaving the activity forgets it.
    hosts.unbind("FAH");
    expect(hosts.hasHadGah()).toBe(false);
  });

  it("keeps hosts, start request and PAH policy per instance", () => {
    const a = new PlayerHosts();
    const b = new PlayerHosts();
    a.setStartRequest({
      activityId: 5,
      ipValid: false,
      unknown1: false,
      options: Buffer.alloc(0),
      stream: Buffer.alloc(0),
    });
    expect(a.getStartRequest()?.activityId).toBe(5);
    expect(b.getStartRequest()).toBeUndefined();
    expect(a.fah.id).not.toBe(b.fah.id);
    expect(a.pah).not.toBe(b.pah);
  });
});
