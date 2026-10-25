import { bapBuild } from "..";
import type { BetathBapBuild } from ".";

// This build's own structures, for the code in this folder and its tests.
export function betathBap(): BetathBapBuild {
  return bapBuild() as BetathBapBuild;
}
