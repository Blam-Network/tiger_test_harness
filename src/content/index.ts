// Queries over the activity bundle tables, which are read off the disc
// packages on first use (tables.ts).
import type {
  ActivityBundleTag,
  ControlPointCommandScript,
  ItemRef,
  NavPointPosition,
} from "@blamnetwork/bullshcript/destiny1/common";
import { ownedState } from "./activity-table";
import { activityBundleItemType } from "./row-types";
import { activityStart } from "./start-config";
import { bundleTable } from "./tables";
import type {
  ActivityBundles,
  ActivityPhase,
  Bubble,
  BundleTag,
  Sensor,
} from "./types";
import { contentBuild } from "./versions";

export type {
  ActivityBundles,
  ActivityNavPoint,
  ActivityPhase,
  Bubble,
  BundleTag,
  Scenario,
  Sensor,
} from "./types";

export function activityBundles(
  activityName: string | undefined
): ActivityBundles | undefined {
  return activityName === undefined ? undefined : bundleTable(activityName);
}

// Every bundle the activity can load, in the order its bubbles name them.
export function bundleTags(activityName: string): ActivityBundleTag[] {
  const activity = bundleTable(activityName);
  return (activity?.tags ?? []).map((tag) => ({ ...tag, activityName }));
}

// A bubble's state: its own (0) unless asked for another the tables have. A
// phase's state loads on top of the bubble's own: the 2.3.1 capture's world
// entry in act_cosmo_m0_highway's highway intro (14.1) carries both states'
// bundles.
export function activityBubble(
  activityName: string,
  bubble: number,
  state = 0
): Bubble | undefined {
  const bubbles = bundleTable(activityName)?.bubbles ?? [];
  const base = bubbles.find(
    (entry) => entry.index === bubble && (entry.state ?? 0) === 0
  );
  const own = bubbles.find(
    (entry) => entry.index === bubble && (entry.state ?? 0) === state
  );
  if (!(own && base) || own === base) {
    return own ?? base ?? bubbles.find((entry) => entry.index === bubble);
  }
  const union = (a: readonly number[], b: readonly number[]) => [
    ...new Set([...a, ...b]),
  ];
  return {
    ...own,
    authoritative: union(base.authoritative, own.authoritative),
    global: union(base.global, own.global),
    private: union(base.private, own.private),
  };
}

// The sensors every private world builds whatever its bubble: the slice set -1
// (activity-wide) sensors of each bubble's global and private bundles. The
// 2.3.1 capture's act_cosmo_m0_highway world entry in the highway carries 151
// such rows, where the highway's own bundles have 142. The Tower and
// venus_portal_1 have none outside their bubbles' own.
export function activitySensors(activityName: string): BubbleSensor[] {
  const activity = bundleTable(activityName);
  if (!activity) {
    return [];
  }
  const ids = new Set(
    activity.bubbles.flatMap((entry) => [...entry.global, ...entry.private])
  );
  const seen = new Set<string>();
  return activity.tags
    .filter((tag) => ids.has(tag.tag))
    .flatMap((tag) =>
      tag.sensors
        .filter((sensor) => sensor.sliceSet === -1)
        .map((sensor) => ({ ...sensor, bundle: tag.bundle, tag: tag.tag }))
    )
    .filter((sensor) => {
      const key = `${sensor.bundle >>> 0}:${sensor.typeId}:${sensor.typeIndex}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

// The state a bubble shows while a phase runs: the one that phase owns, or
// its own. The client picks it from the lifetime's phase hash and swaps to
// it itself (act_cosmo_m0_highway's highway, 113 -> 112, as the intro ends).
export function bubbleState(
  activityName: string,
  bubble: number,
  phaseHash: number | undefined
): number {
  return ownedState(
    bundleTable(activityName)?.bubbles ?? [],
    bubble,
    phaseHash
  );
}

// Where a phase starts: its bubble, in the state that phase owns there (the
// intro's 14.1), otherwise the bubble's own.
export function phaseStart(
  activityName: string,
  index: number
): { bubble: number; state: number } | undefined {
  const phase = bundleTable(activityName)?.phases?.[index];
  if (!phase) {
    return;
  }
  return {
    bubble: phase.bubble,
    state: bubbleState(activityName, phase.bubble, phase.hash),
  };
}

// Trigger group rows are named tg_* or t_*.
const TG_PREFIX = /(^|\.)tg_/;
const T_PREFIX = /(^|\.)t_/;

// The name of the TriggerVolume a trigger group watches: tg_X watches sv_X
// (the 2.3.1 capture's tg_m0_gating refs sv_m0_gating, act_cosmo_m0_highway)
// and t_X watches X (its t_pit_kill_volume refs pit_kill_volume,
// cosmo_portal_1). Unset, the client has no volume to switch.
export function watchedVolumeName(groupName: string): string {
  return groupName.replace(TG_PREFIX, "$1sv_").replace(T_PREFIX, "$1");
}

export function triggerGroupVolume(
  activityName: string,
  bundle: number,
  typeIndex: number
): ItemRef | undefined {
  const triggerGroupType = activityBundleItemType().TriggerGroup;
  // A build without trigger group rows has no volumes to resolve.
  if (triggerGroupType === undefined) {
    return;
  }
  for (const tag of bundleTable(activityName)?.tags ?? []) {
    if (tag.bundle >>> 0 !== bundle >>> 0) {
      continue;
    }
    const group = tag.rows.find(
      (row) => row.typeId === triggerGroupType && row.typeIndex === typeIndex
    );
    if (!group?.name) {
      continue;
    }
    const name = watchedVolumeName(group.name);
    const volume = tag.rows.find(
      (row) =>
        row.typeId === activityBundleItemType().TriggerVolume &&
        row.name === name
    );
    if (volume) {
      return {
        bundle: tag.bundle,
        typeId: volume.typeId,
        typeIndex: volume.typeIndex,
      };
    }
  }
  return;
}

// An activity none of whose bubble states is public: one private host
// serves the whole of it, and nothing in it ever needs a public host
// (act_cosmo_m0_highway, cine_reveal; venus_portal_1 has public bubbles).
export function activityPrivate(activityName: string | undefined): boolean {
  const activity = activityBundles(activityName);
  return activity !== undefined && !activity.bubbles.some((b) => b.public);
}

// The scenario_client tag an activity runs, for a debugger to read its
// slices from the packages.
export function scenarioTag(activityName: string): number | undefined {
  return bundleTable(activityName)?.scenario.tag;
}

export function activityPhases(activityName: string): readonly ActivityPhase[] {
  return bundleTable(activityName)?.phases ?? [];
}

// Every NavPoint row's position, for the scripts' nav_point_activate.
export function activityNavPoints(activityName: string): NavPointPosition[] {
  return (bundleTable(activityName)?.tags ?? []).flatMap((tag) =>
    (tag.navPoints ?? []).map((point) => ({ ...point, bundle: tag.bundle }))
  );
}

// Every ControlPoint row's command script, for the scripts' execute() on a
// path. A bundle loaded as several tags lists each host in only one of them.
export function activityCommandScripts(
  activityName: string
): ControlPointCommandScript[] {
  const { readers } = contentBuild();
  return (bundleTable(activityName)?.tags ?? []).flatMap((tag) => [
    ...readers.commandScripts(tag.tag),
  ]);
}

// Bundle hashes loaded in a bubble state: the global set plus its own.
export function loadedBundles(
  activityName: string,
  bubble: number,
  state = 0
): Set<number> | undefined {
  const activity = bundleTable(activityName);
  const loaded = activityBubble(activityName, bubble, state);
  if (!(activity && loaded)) {
    return;
  }
  const hashOf = new Map(activity.tags.map((tag) => [tag.tag, tag.bundle]));
  return new Set(
    [...loaded.global, ...loaded.authoritative, ...loaded.private]
      .map((tag) => hashOf.get(tag))
      .filter((bundle) => bundle !== undefined)
  );
}

// Which world a host builds: a lone host (the Tower, or any activity before
// its first public host) builds everything; with a public host (GAH), the
// private host (FAH) builds the global and private bundles and a private
// bubble's authoritative ones, and the public host a public bubble's
// authoritative ones.
type WorldScope = "all" | "private" | "public";

// Which world builds each bundle, and in which bubbles (`bubble.state`): the
// public host's for a public bubble's authoritative tags, the private one's
// for the rest. A bundle both kinds of bubble name counts as public.
export function bundleWorlds(
  activityName: string
): Map<number, { bubbles: string[]; world: "private" | "public" }> {
  const out = new Map<
    number,
    { bubbles: string[]; world: "private" | "public" }
  >();
  const activity = bundleTable(activityName);
  if (!activity) {
    return out;
  }
  const bundleOf = new Map(activity.tags.map((tag) => [tag.tag, tag.bundle]));
  const note = (id: number, world: "private" | "public", where?: string) => {
    const bundle = bundleOf.get(id);
    if (bundle === undefined) {
      return;
    }
    const entry = out.get(bundle) ?? { bubbles: [], world };
    if (world === "public") {
      entry.world = "public";
    }
    if (where !== undefined && !entry.bubbles.includes(where)) {
      entry.bubbles.push(where);
    }
    out.set(bundle, entry);
  };
  for (const bubble of activity.bubbles) {
    const where = `${bubble.index}.${bubble.state ?? 0}`;
    for (const id of bubble.global) {
      note(id, "private");
    }
    for (const id of bubble.private) {
      note(id, "private", where);
    }
    for (const id of bubble.authoritative) {
      note(id, bubble.public ? "public" : "private", where);
    }
  }
  return out;
}

export function worldTags(
  activityName: string,
  bubble: number,
  scope: WorldScope,
  state = 0
): BundleTag[] {
  const activity = bundleTable(activityName);
  const loaded = activityBubble(activityName, bubble, state);
  if (!(activity && loaded)) {
    return [];
  }
  const buildsAuthoritative =
    scope === "all" || (scope === "public" ? loaded.public : !loaded.public);
  const own = buildsAuthoritative ? loaded.authoritative : [];
  const ids =
    scope === "public" ? own : [...loaded.global, ...loaded.private, ...own];
  return ids.flatMap((id) => activity.tags.filter((tag) => tag.tag === id));
}

interface BubbleSensor extends Sensor {
  bundle: number;
  tag: number;
}

// The sensors of these tags that load in the bubble (slice set -1 or the
// bubble itself).
export function bubbleSensors(
  tags: readonly BundleTag[],
  bubble: number
): BubbleSensor[] {
  return tags.flatMap((tag) =>
    tag.sensors
      .filter((sensor) => sensor.sliceSet === -1 || sensor.sliceSet === bubble)
      .map((sensor) => ({ ...sensor, bundle: tag.bundle, tag: tag.tag }))
  );
}

// A sensor of one of these tags, loaded in the bubble or not. `foreign` is a
// sensor of another bubble's slice set, whose rows the guest has not built.
interface SlotSensor extends BubbleSensor {
  foreign: boolean;
}

// Every sensor of these tags, for a build whose guest needs each bundle's
// slots in full.
export function slotSensors(
  tags: readonly BundleTag[],
  bubble: number
): SlotSensor[] {
  return tags.flatMap((tag) =>
    tag.sensors.map((sensor) => ({
      ...sensor,
      bundle: tag.bundle,
      foreign: sensor.sliceSet !== -1 && sensor.sliceSet !== bubble,
      tag: tag.tag,
    }))
  );
}

// A Squad row's cell count, for the body it has before a script writes it.
// undefined where the packages give no members.
export function squadDefinition(
  activityName: string,
  bundle: number,
  typeIndex: number
): { cells: number } | undefined {
  for (const tag of bundleTable(activityName)?.tags ?? []) {
    if (tag.bundle >>> 0 !== bundle >>> 0) {
      continue;
    }
    const row = tag.rows.find(
      (entry) =>
        entry.typeId === activityBundleItemType().Squad &&
        entry.typeIndex === typeIndex &&
        entry.memberCount !== undefined
    );
    if (row) {
      return { cells: row.memberCount ?? 0 };
    }
  }
  return;
}

const senseSchemaCache = new Map<string, Map<string, number>>();

// A row's sense schema (bundle, type, index), from its sensor definition.
export function senseSchema(
  activityName: string,
  bundle: number,
  typeId: number,
  typeIndex: number
): number | undefined {
  let schemas = senseSchemaCache.get(activityName);
  if (!schemas) {
    schemas = new Map();
    for (const tag of bundleTable(activityName)?.tags ?? []) {
      for (const sensor of tag.sensors) {
        if (sensor.sense !== undefined) {
          schemas.set(
            `${tag.bundle >>> 0}:${sensor.typeId}:${sensor.typeIndex}`,
            sensor.sense
          );
        }
      }
    }
    senseSchemaCache.set(activityName, schemas);
  }
  return schemas.get(`${bundle >>> 0}:${typeId}:${typeIndex}`);
}

// The binder: the global bundle with the activity's lifetime and its player
// rows (tower_common, portal_common).
interface Binder {
  bundle: number;
  lifetime: number;
  players: readonly number[];
}

// Other bundles carry Lifetime rows of their own (cosmo_patrols_1's patrol
// bundle, with no players); a lifetime with no players beside it is the
// binder only when no bundle has both.
export function activityBinder(activityName: string): Binder | undefined {
  let fallback: Binder | undefined;
  for (const tag of bundleTable(activityName)?.tags ?? []) {
    const lifetime = tag.rows.find(
      (row) => row.typeId === activityBundleItemType().Lifetime
    );
    if (!lifetime) {
      continue;
    }
    const binder = {
      bundle: tag.bundle,
      lifetime: lifetime.typeIndex,
      players: tag.rows
        .filter((row) => row.typeId === activityBundleItemType().Player)
        .map((row) => row.typeIndex),
    };
    if (binder.players.length > 0) {
      return binder;
    }
    fallback ??= binder;
  }
  return fallback;
}

// A new instance's lifetime tail: the time of day the script locks the
// clients to from world entry, if any.
export function lifetimeTail(activityName: string): {
  instance: number;
  timeOfDay: number;
  timeOfDayLocked: boolean;
} {
  const timeOfDay = activityStart(activityName)?.timeOfDay;
  return {
    instance: 1 + Math.floor(Math.random() * 0xff_ff),
    timeOfDay: timeOfDay ?? 0,
    timeOfDayLocked: timeOfDay !== undefined,
  };
}

// The binder's lifetime_timer (the binder's import_only_bind target).
export function lifetimeTimer(
  tags: readonly ActivityBundleTag[]
): ItemRef | undefined {
  for (const tag of tags) {
    const row = tag.rows.find(
      (entry) =>
        entry.typeId === activityBundleItemType().Timer &&
        entry.name === "lifetime_timer"
    );
    if (row) {
      return {
        bundle: tag.bundle,
        typeId: row.typeId,
        typeIndex: row.typeIndex,
      };
    }
  }
}
