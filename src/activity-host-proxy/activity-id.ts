import { ACTIVITY_ID_NAMES } from "../tags";

export { ACTIVITY_ID_NAMES } from "../tags";

export function activityNameForId(activityId: number): string | undefined {
  return ACTIVITY_ID_NAMES[activityId];
}
