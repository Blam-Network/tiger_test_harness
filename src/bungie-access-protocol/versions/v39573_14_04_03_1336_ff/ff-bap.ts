import { bapBuild } from "..";
import type { FfBapBuild } from ".";

// This build's own structures, for the code in this folder and its tests.
export function ffBap(): FfBapBuild {
  return bapBuild() as FfBapBuild;
}
