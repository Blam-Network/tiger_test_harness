import { event_warning } from "@blamnetwork/datamine";
import { activityBundles } from "../content";
import { PAH_AMBASSADOR_ASSIGN } from "./pah-policy";
import { SCRIPT_TICK_MS } from "./script-host/session-host";
import type { SessionContext } from "./session-context";
import type { MembershipPushes } from "./session-membership";
import type { SensorAuthPushes } from "./session-sensor-auth";

// Keepalive beat: the idle sensor-auth tick.
const KEEPALIVE_INTERVAL_MS = 3000;
// The beats after a bubble swap that republish its full tables; instances
// appear late after a swap.
const SETTLE_REPUBLISH_BEATS: readonly number[] = [2, 4];
const MILLISECONDS_PER_SECOND = 1000;

// The session's timers: the keepalive beat and the activity scripts' own,
// faster one.
export class Keepalive {
  private beat: ReturnType<typeof setInterval> | undefined;
  private scriptBeat: ReturnType<typeof setInterval> | undefined;
  // Beats since the last bubble swap, while its settle republishes are due.
  private settleBeats: number | undefined;

  constructor(
    private readonly session: SessionContext,
    private readonly sensorAuth: SensorAuthPushes,
    private readonly membership: MembershipPushes
  ) {}

  // A bubble swap landed: the next beats republish the new bubble's tables.
  settleAfterSwap(): void {
    this.settleBeats = 0;
  }

  start(sessionId: bigint): void {
    this.stop();
    this.beat = setInterval(() => this.tick(sessionId), KEEPALIVE_INTERVAL_MS);
    this.scriptBeat = setInterval(() => {
      const activityName = this.session.activityName();
      if (
        !this.session.closed &&
        activityName &&
        activityBundles(activityName)
      ) {
        this.session.scripts.tick();
      }
    }, SCRIPT_TICK_MS);
  }

  stop(): void {
    if (this.beat) {
      clearInterval(this.beat);
      this.beat = undefined;
    }
    if (this.scriptBeat) {
      clearInterval(this.scriptBeat);
      this.scriptBeat = undefined;
    }
  }

  private tick(sessionId: bigint): void {
    const started = Date.now();
    if (this.session.closed) {
      this.stop();
      return;
    }
    this.sensorAuth.pushTick(sessionId);
    // The new bubble's full tables go out again on the settle beats after a
    // swap: the client builds some sensor instances after the swap's apply has
    // landed, and one that never sees a full state never reconciles ("unable
    // to reconcile without full network state"), e.g. a Venus mission's
    // objective and enter trigger.
    if (this.settleBeats !== undefined && !this.sensorAuth.tablesHeld) {
      this.settleBeats += 1;
      if (SETTLE_REPUBLISH_BEATS.includes(this.settleBeats)) {
        this.sensorAuth.republishTables("settle after swap");
      }
      if (this.settleBeats >= Math.max(...SETTLE_REPUBLISH_BEATS)) {
        this.settleBeats = undefined;
      }
    }
    // Re-push PAH while ASSIGN so the bind can land after pending is armed;
    // the guest ignores a membership table until its generation changes.
    if (
      this.session.kind === "FAH" &&
      this.session.hosts.pah.currentAmbassador() === PAH_AMBASSADOR_ASSIGN
    ) {
      this.membership.push(sessionId, true);
    }
    // A blocked tick stalls every AH message on this socket; a slow one is
    // flagged here instead of showing up only as a crossing that times out.
    const elapsed = Date.now() - started;
    if (elapsed > MILLISECONDS_PER_SECOND) {
      event_warning(
        "activities:host: %s keepalive tick took %dms, over budget",
        this.session.kind,
        elapsed
      );
    }
  }
}
