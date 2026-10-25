import { bapBuild } from "..";
import type { PubalphaBapBuild } from ".";

// This build's own structures, for the code in this folder and its tests.
export function pubalphaBap(): PubalphaBapBuild {
  return bapBuild() as PubalphaBapBuild;
}
