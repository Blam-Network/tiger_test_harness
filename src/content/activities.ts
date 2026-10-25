// The activity ids (indices into the investment globals' activity
// table) with each definition's activity name, and the playlists (an activity
// whose definition lists the ids it picks from). The director and the AH start
// request name activities by these ids.
import { contentBuild } from "./versions";

interface ActivityTable {
  // Activity id -> the definition's activity name (holes have none).
  names: ReadonlyMap<number, string>;
  // Playlist activity id -> the ids it picks from, in table order.
  playlists: ReadonlyMap<number, readonly number[]>;
}

let table: ActivityTable | undefined;

function readActivityTable(): ActivityTable {
  const names = new Map<number, string>();
  const playlists = new Map<number, readonly number[]>();
  contentBuild()
    .readers.activityDefinitions()
    .forEach((definition, id) => {
      if (definition.name) {
        names.set(id, definition.name);
      }
      if (definition.playlist.length > 0) {
        playlists.set(id, definition.playlist);
      }
    });
  return { names, playlists };
}

function activityTable(): ActivityTable {
  if (!table) {
    table = readActivityTable();
  }
  return table;
}

export function activityName(activityId: number): string | undefined {
  return activityTable().names.get(activityId);
}

export function activityPlaylist(
  activityId: number
): readonly number[] | undefined {
  return activityTable().playlists.get(activityId);
}

export function activityIds(): number[] {
  return [...activityTable().names.keys()];
}
