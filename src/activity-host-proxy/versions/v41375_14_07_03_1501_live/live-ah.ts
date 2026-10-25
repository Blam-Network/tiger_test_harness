import { activityHostBuild } from "..";
import type { LiveActivityHostBuild } from ".";

// The live build's schemas, for the tests that read the wire it writes.
export function liveAh() {
  return (activityHostBuild() as LiveActivityHostBuild).ah;
}
