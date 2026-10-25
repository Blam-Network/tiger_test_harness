import type { HardWipePhase, HardWipeRules } from "../activity-host-build";

// The host's state in each phase of a wipe. The client only checks for 3,
// complete (it closes its wipe screen and force-spawns its dead players); what
// the host held in the others is not known, 1 is ours.
const STATE: Record<HardWipePhase, number> = {
  complete: 3,
  idle: 0,
  wiping: 1,
};

// The client's state once it has shown its wipe screen for good and waits on
// the host.
const CLIENT_WAITING = 2;

const MAX_COOKIE = 255;

// The alpha's wipe handshake (docs/hard-wipe.md, sections 2-4): the host
// states the cookie of the wipe it runs and the last one it completed. The
// client opens its screen for a cookie it has not completed, reports 0..2 as
// it shows it, 3 once the host says complete, and its last cookie catches up
// with the host's: the host is idle when its completed cookie does too.
export const hardWipeRules: HardWipeRules = {
  completed: (report, cookie) =>
    "lastCookie" in report && report.lastCookie === cookie,

  // Cookies count up from 1 (0 is a fresh activity client's own) and go round
  // past 255, or the client's last cookie would never meet it.
  nextCookie: (cookie) => (cookie === MAX_COOKIE ? 1 : cookie + 1),

  nest: (phase, cookie, completed) => ({
    completedCookie: completed,
    cookie,
    state: STATE[phase],
  }),

  screenUp: (report, cookie) =>
    report.currentCookie === cookie && report.state === CLIENT_WAITING,
};
