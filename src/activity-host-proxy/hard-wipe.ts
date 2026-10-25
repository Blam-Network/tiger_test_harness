import type { HostHardWipe } from "./rsat";
import type { ClientHardWipe, HardWipePhase, HardWipeRules } from "./versions";

// The host's side of a hard wipe, one per activity host connection. The client
// starts with a clean hard wipe and only opens its wipe screen when the host's
// nest says so, so the state lives with the connection: a new connection (a
// reconnect, a fresh public host) starts idle again, and a wipe only starts on
// the connections that should show one. Members are the membership slots whose
// clients take part.
//
//   start     the clients open their wipe screens
//   resetDue  every client has its screen up and waits: the world is reset
//             behind it (noteWorldReset), and once everyone is where the reset
//             put them, noteReset() states it done
//   finishDue every client has completed the wipe: finish() is the host idle
//
// What the clients and the host's nest say at each step is the build's own
// (HardWipeRules): the alpha counts a cookie and a completed cookie, TU0's
// client does neither.
export class HardWipe {
  private cookie = 0;
  private completedCookie = 0;
  private phase: HardWipePhase = "idle";
  // The world is reset behind the screens and the clients wait there to be
  // brought back.
  private worldReset = false;
  private readonly members = new Set<number>();
  private readonly reports = new Map<number, ClientHardWipe>();

  constructor(private readonly rules: HardWipeRules) {}

  // The membership's hard wipe nest.
  get host(): HostHardWipe {
    return this.rules.nest(this.phase, this.cookie, this.completedCookie);
  }

  // A wipe is running from start until finish.
  get active(): boolean {
    return this.phase !== "idle";
  }

  start(members: Iterable<number>): void {
    if (this.active) {
      throw new Error("a hard wipe is already running");
    }
    const taking = new Set(members);
    if (taking.size === 0) {
      throw new Error("a hard wipe needs a member to show it to");
    }
    this.members.clear();
    this.reports.clear();
    for (const member of taking) {
      this.members.add(member);
    }
    this.cookie = this.rules.nextCookie(this.cookie);
    this.phase = "wiping";
    this.worldReset = false;
  }

  // A member's client-reported hard wipe, the latest of it. A member the wipe
  // is not waiting on is not heard.
  report(member: number, report: ClientHardWipe): void {
    if (this.active && this.members.has(member)) {
      this.reports.set(member, report);
    }
  }

  // A member left. The wipe stops waiting on its client, and ends with its
  // last member.
  leave(member: number): void {
    if (!this.active) {
      return;
    }
    this.members.delete(member);
    this.reports.delete(member);
    if (this.members.size === 0) {
      this.finish();
    }
  }

  // Every member's client has its screen up for this wipe and waits on the
  // host.
  resetDue(): boolean {
    return (
      this.phase === "wiping" &&
      !this.worldReset &&
      this.everyMember((report) => this.rules.screenUp(report, this.cookie))
    );
  }

  // The world is reset behind the screens; the clients stay on them while
  // they are moved to where it put them.
  noteWorldReset(): void {
    if (!this.resetDue()) {
      throw new Error("no hard wipe is waiting to be reset");
    }
    this.worldReset = true;
  }

  // The world is reset and the clients wait on their screens to come back.
  returnDue(): boolean {
    return this.phase === "wiping" && this.worldReset;
  }

  // The world is reset: the clients close their screens and respawn.
  noteReset(): void {
    if (this.phase !== "wiping") {
      throw new Error("no hard wipe is waiting to be reset");
    }
    this.phase = "complete";
    this.worldReset = false;
  }

  // Every member's client has completed this wipe.
  finishDue(): boolean {
    return (
      this.phase === "complete" &&
      this.everyMember((report) => this.rules.completed(report, this.cookie))
    );
  }

  // The host is idle again; without this the clients stay in their wipe
  // state.
  finish(): void {
    this.completedCookie = this.cookie;
    this.phase = "idle";
    this.worldReset = false;
    this.members.clear();
    this.reports.clear();
  }

  private everyMember(test: (report: ClientHardWipe) => boolean): boolean {
    for (const member of this.members) {
      const report = this.reports.get(member);
      if (!(report && test(report))) {
        return false;
      }
    }
    return this.members.size > 0;
  }
}
