import { type ActivityBundles, activityBundles } from "../content";
import { resolveStartBubbleOverrides } from "../env";
import { debugStart } from "./debug-start";

// A scenario_client tag with the activity's start bubble.
export interface ScenarioClient {
  activityName: string;
  bubbleCount: number;
  emptyBubbles?: readonly number[];
  familyChecksum: number;
  initialBubble?: number;
  // The start bubble's state (tables): a later one is the first phase's
  // own, the region packs it under the bubble.
  initialState?: number;
  privateChecksum: number;
  publicChecksum: number;
  // fnv1 of the spawn point the activity starts at (GAS spawn transition
  // name); unset sends "default".
  spawnTransition?: number;
  tag: number;
}

// Scenario clients (class 80800616), from the disc tables (read off the
// packages on first use, so any activity resolves). The GAS activity checksum
// must match the scenario tag's word [2 + private 0 / public 1]: world
// instantiate fails the activity world transition otherwise, with "activity
// checksum mismatch" (world_controller error 54). The start bubble is the slice
// its script starts in (content/start-config.ts). A bubble with no state is one
// the activity never uses.
function clientFromBundles({
  activityName,
  bubbles,
  scenario,
}: ActivityBundles): ScenarioClient {
  const used = new Set(bubbles.map((bubble) => bubble.index));
  return {
    activityName,
    bubbleCount: scenario.bubbleCount,
    emptyBubbles: Array.from(
      { length: scenario.bubbleCount },
      (_, index) => index
    ).filter((index) => !used.has(index)),
    familyChecksum: scenario.familyChecksum,
    initialBubble: scenario.initialBubble,
    initialState: scenario.initialState,
    privateChecksum: scenario.privateChecksum,
    publicChecksum: scenario.publicChecksum,
    spawnTransition: scenario.spawnTransition,
    tag: scenario.tag,
  };
}

// Test lever: `TIGER_START_BUBBLE=venus_portal_1:29` starts that activity in
// another bubble of its world (the promote/apply bubble is ours to choose).
// Used to reach content with no orbit marker, e.g. a raid gate.
// Several entries are comma separated. Unset in normal play.
function startBubbleOverride(name: string): number | undefined {
  for (const entry of resolveStartBubbleOverrides().split(",")) {
    const [activity, bubble] = entry.split(":");
    if (activity?.trim() === name && bubble !== undefined) {
      const parsed = Number.parseInt(bubble, 10);
      if (Number.isInteger(parsed)) {
        return parsed;
      }
    }
  }
  return;
}

// The scenario as the activity starts: a debug start (debug-toggles.json
// startPhase) moves an activity's start to that phase's bubble state and
// the region's spawn transition.
export function scenarioClient(name: string): ScenarioClient | undefined {
  const client = tableScenarioClient(name);
  const start = client && debugStart(name);
  return start
    ? {
        ...client,
        initialBubble: start.bubble,
        initialState: start.state,
        spawnTransition: start.spawnTransition ?? client.spawnTransition,
      }
    : client;
}

function tableScenarioClient(name: string): ScenarioClient | undefined {
  const bundles = activityBundles(name);
  if (!bundles) {
    return;
  }
  const client = clientFromBundles(bundles);
  const override = startBubbleOverride(name);
  return override === undefined
    ? client
    : { ...client, initialBubble: override };
}
