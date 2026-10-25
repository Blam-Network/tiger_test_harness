import type { ActivityStartData } from "@blamnetwork/bullshcript/destiny1/common";
import { compiledScripts } from "../activity-host-proxy/script-host/compiled-scripts";

// How an activity starts, as its script writes it (Fukugen Daihon's @activity
// decorators): the slice and phases, the spawn point, the lifetime tail.
// undefined when no script starts the activity, so it is not startable.
export function activityStart(
  activityName: string
): ActivityStartData | undefined {
  return compiledScripts().activityStart(activityName);
}
