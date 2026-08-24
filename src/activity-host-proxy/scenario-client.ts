import { FAH_INITIAL_BUBBLE, SCENARIO_CLIENT_TAGS } from "../tags";

export { FAH_INITIAL_BUBBLE } from "../tags";

/**
 * Assembled view of a scenario_client tag plus the FAH start bubble
 * when we have dumped that activity's 80800890+0x1C.
 */
export interface ScenarioClient {
  activityName: string;
  bubbleCount: number;
  emptyBubbles?: readonly number[];
  familyChecksum: number;
  initialBubble?: number;
  privateChecksum: number;
  publicChecksum: number;
  tag: number;
}

export const SCENARIO_CLIENTS: Record<string, ScenarioClient> =
  Object.fromEntries(
    SCENARIO_CLIENT_TAGS.map((t) => [
      t.activityName,
      {
        activityName: t.activityName,
        bubbleCount: t.bubbleCount,
        emptyBubbles: t.emptyBubbles,
        familyChecksum: t.familyChecksum,
        initialBubble: FAH_INITIAL_BUBBLE[t.activityName],
        privateChecksum: t.privateChecksum,
        publicChecksum: t.publicChecksum,
        tag: t.tag,
      },
    ])
  );

export function scenarioClient(name: string): ScenarioClient | undefined {
  return SCENARIO_CLIENTS[name];
}
