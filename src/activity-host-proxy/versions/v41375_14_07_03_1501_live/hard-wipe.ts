import type { HardWipePhase, HardWipeRules } from "../activity-host-build";

// The host's state in each phase of a wipe (docs/hard-wipe.md, "TU0 handshake").
// The client counts a wipe as running while the host's state is not 0 and not
// 4; 4 is the world reset, which sends the screens away and respawns the
// players. Any of 1..3 starts one.
const STATE: Record<HardWipePhase, number> = {
  complete: 4,
  idle: 0,
  wiping: 1,
};

// The client's state with its screen black, waiting on the host; and the
// state it comes back to when it is done.
const CLIENT_BLACK = 4;
const CLIENT_IDLE = 0;

const COOKIE_RANGE = 256;

// TU0's wipe handshake: the host states a cookie and a state, and the client
// copies the cookie and never compares it, nor keeps a completed one. The host
// goes idle -> wiping -> (every client black: reset the world and move
// everyone) -> complete -> (every client idle) -> idle; leaving it before the
// clients are idle again keeps them on the wipe screen.
export const hardWipeRules: HardWipeRules = {
  completed: (report) => report.state === CLIENT_IDLE,

  nextCookie: (cookie) => (cookie + 1) % COOKIE_RANGE,

  nest: (phase, cookie) => ({ cookie, state: STATE[phase] }),

  screenUp: (report) => report.state === CLIENT_BLACK,
};
