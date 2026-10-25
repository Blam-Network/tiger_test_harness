import { phaseStart } from "../content";
import { activityBundleItemType } from "../content/row-types";
import { activityStart } from "../content/start-config";
import {
  type DebugToggles,
  readDebugToggles,
} from "../dev-config/debug-toggles";

const rowTypesNeverOmitted = (): ReadonlySet<number> =>
  new Set([activityBundleItemType().Lifetime, activityBundleItemType().Player]);

export function debugOmitsRowType(
  toggles: DebugToggles,
  typeId: number
): boolean {
  return (
    !rowTypesNeverOmitted().has(typeId) &&
    (toggles.omitScriptRowTypes?.includes(typeId) ?? false)
  );
}

interface DebugStart {
  bubble: number;
  phaseIndex: number;
  // The GAS spawn transition for the region, when a capture has shown it.
  spawnTransition?: number;
  state: number;
}

// Where a new instance of the activity starts when the toggles name a phase
// for it: the phase's bubble and state, and the region's spawn transition.
export function debugStart(
  activityName: string | undefined
): DebugStart | undefined {
  if (activityName === undefined) {
    return;
  }
  const phaseIndex = readDebugToggles().toggles.startPhase?.[activityName];
  if (phaseIndex === undefined) {
    return;
  }
  const start = phaseStart(activityName, phaseIndex);
  if (!start) {
    return;
  }
  const region = (start.bubble << 3) | start.state;
  return {
    ...start,
    phaseIndex,
    spawnTransition:
      activityStart(activityName)?.regionSpawnTransitions[region],
  };
}
