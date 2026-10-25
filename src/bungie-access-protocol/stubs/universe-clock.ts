// The universe clock the client reads from ServerObject.unknown1 (unix
// seconds). Global unlock flags only apply once it passes their date: at 0
// the launch flag (248, 2014-09-09) never sets.
//
// UNIVERSE_TIME: "now" for the real clock, or unix seconds to start from.
// Default is launch week, ticking forward from server start.

import { resolveUniverseStart } from "../../env";

const LAUNCH_WEEK = 1_410_307_200; // 2014-09-10 00:00 UTC

const startedAt = Math.floor(Date.now() / 1000);

const start = resolveUniverseStart(LAUNCH_WEEK);

export function universeTime(): bigint {
  const now = Math.floor(Date.now() / 1000);
  return BigInt(start === "now" ? now : start + (now - startedAt));
}
