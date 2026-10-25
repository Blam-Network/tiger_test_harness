import { bapBuild } from "..";
import type { LiveBapBuild } from ".";

// The live build's own structures, for the code in this folder and its tests.
export function liveBap(): LiveBapBuild {
  return bapBuild() as LiveBapBuild;
}
