import { bapBuild } from "..";
import type { AlphaBapBuild } from ".";

export type { AlphaBapBuild };

// The alpha's own structures, for the code in this folder and its tests.
export function alphaBap(): AlphaBapBuild {
  return bapBuild() as AlphaBapBuild;
}
