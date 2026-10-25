// Builds an activity's bundle table (types.ts ActivityBundles) from what the
// build's readers hand over: the scenario_client with each bubble state's
// blueprint sets, and the activity bundles those name, each with its rows and
// sensor hosts. Each bundle also lists its sensors: every row whose host has
// an auth schema, with its sense schema and slice set. The client's sensor
// client applies nothing until each of them has had an auth, so a world entry
// sends every one of them.
//
// Where the activity starts and the phases it runs come from its script
// (start-config.ts); the slices they name resolve to this scenario_client's
// bubbles by region. An Encounter row's archetype is not in the packages
// (41375 ships no encounter hosts); child-scripts.ts takes it from the
// compiled scripts.
import {
  type ActivityStartData,
  sliceRegionHash,
} from "@blamnetwork/bullshcript/destiny1/common";
import { k_empty_name_hash } from "../utils/name-hash";
import type {
  BundleSource,
  ObjectiveTaskSource,
  ScenarioClient,
  SensorHostSource,
} from "./model/activity-source";
import { activityBundleItemType } from "./row-types";
import type {
  ActivityBundles,
  ActivityPhase,
  Bubble,
  BundleTag,
  Sensor,
} from "./types";
import { contentBuild } from "./versions";

// What the hosts of every copy of a bundle say, by row index.
interface BundleInfo {
  // Squad row -> the squad's member name hashes, one per cell.
  counts: Map<number, readonly number[]>;
  identifiers: Map<number, number>;
  // Squad row -> the cells named Actor rows fill.
  named: Map<number, number[]>;
  // Object row -> where it stands.
  objectPositions: Map<number, { x: number; y: number; z: number }>;
  sequences: Map<number, { blueprint: boolean; duration: number }>;
  // Squad row -> where its template spawns it.
  spawnPoints: Map<number, readonly { x: number; y: number; z: number }[]>;
  // Objective row -> its AI tasks. A squad is linked under one by SquadAuth
  // [10] and the client hands it a firing area set from the task's options.
  // The runtime's ObjectiveTask is a tree node; a flat list fills name and
  // influencer and leaves the tree links unset.
  tasks: Map<number, ObjectiveTaskSource[]>;
}

// Squad cells and import identifiers come from the sensor hosts, and a
// bundle loaded as several tags (venus_portal_1's strike bundle has one copy
// per strike bubble) lists each host in only one of them, so they are
// gathered per bundle hash across every copy.
function bundleInfo(sources: readonly BundleSource[]): Map<number, BundleInfo> {
  const byBundle = new Map<number, SensorHostSource[]>();
  for (const { bundle, hosts } of sources) {
    byBundle.set(bundle, [...(byBundle.get(bundle) ?? []), ...hosts]);
  }
  return new Map(
    [...byBundle].map(([hash, hosts]) => {
      const info: BundleInfo = {
        counts: new Map(),
        identifiers: new Map(),
        named: new Map(),
        objectPositions: new Map(),
        sequences: new Map(),
        spawnPoints: new Map(),
        tasks: new Map(),
      };
      for (const host of hosts) {
        if (host.squadMembers) {
          info.counts.set(host.index, host.squadMembers);
        }
        if (host.squadSpawnPoints) {
          info.spawnPoints.set(host.index, host.squadSpawnPoints);
        }
        if (host.objectPosition) {
          info.objectPositions.set(host.index, host.objectPosition);
        }
        if (host.actor) {
          const { cell, squad } = host.actor;
          info.named.set(squad, [...(info.named.get(squad) ?? []), cell]);
        }
        if (host.tasks) {
          info.tasks.set(host.index, [...host.tasks]);
        }
        if (host.sequence) {
          info.sequences.set(host.index, host.sequence);
        }
        if (host.identifier !== k_empty_name_hash) {
          info.identifiers.set(host.index, host.identifier);
        }
      }
      return [hash, info];
    })
  );
}

function bundleTag(
  tag: number,
  source: BundleSource,
  info: Map<number, BundleInfo>
): BundleTag {
  const itemType = activityBundleItemType();
  const found = info.get(source.bundle);
  if (!found) {
    throw new Error(`no sensor hosts read for bundle ${source.bundle}`);
  }
  const {
    counts,
    identifiers,
    named,
    objectPositions,
    sequences,
    spawnPoints,
    tasks,
  } = found;
  const rows = source.rows.map((row, index) => {
    const entry: BundleTag["rows"][number] = {
      ...(row.name === undefined ? {} : { name: row.name }),
      nameHash: row.nameHash,
      typeId: row.typeId,
      typeIndex: index,
    };
    const objective =
      row.typeId === itemType.Objective ? tasks.get(index) : undefined;
    if (objective?.length) {
      entry.tasks = objective.map((task) => ({
        name: task.name,
        influencer: task.influencer,
        capacity: task.capacity ?? -1,
        firstChild: task.firstChild ?? -1,
        nextSibling: task.nextSibling ?? -1,
        parent: task.parent ?? -1,
        priority: task.priority ?? 0,
      }));
    }
    const members =
      row.typeId === itemType.Squad ? counts.get(index) : undefined;
    if (members !== undefined) {
      // Default bodies per cell: one per member, and 0 in a cell a named
      // actor fills (it is that cell's body). A script's @member_counts
      // gives others, keyed by the members' names.
      entry.memberCount = members.length;
      entry.memberNames = members;
      entry.cells = members.map((_, cell) =>
        named.get(index)?.includes(cell) ? 0 : 1
      );
    }
    const spawns =
      row.typeId === itemType.Squad ? spawnPoints.get(index) : undefined;
    if (spawns) {
      entry.spawnPoints = spawns;
    }
    const position =
      row.typeId === itemType.Object ? objectPositions.get(index) : undefined;
    if (position) {
      entry.objectPosition = position;
    }
    const sequence =
      row.typeId === itemType.Sequence ? sequences.get(index) : undefined;
    if (sequence) {
      entry.sequenceHasBlueprint = sequence.blueprint;
      entry.sequenceDurationSeconds = sequence.duration;
    }
    const identifier = identifiers.get(index);
    if (identifier !== undefined) {
      entry.importIdent = identifier;
    }
    return entry;
  });
  const sensors: Sensor[] = [];
  for (const host of [...source.hosts].sort((a, b) => a.index - b.index)) {
    if (host.auth !== undefined) {
      sensors.push({
        typeId: host.typeId,
        typeIndex: host.index,
        auth: host.auth,
        sense: host.sense,
        sliceSet: host.sliceSet,
      });
    }
  }
  return {
    tag,
    bundle: source.bundle,
    rows,
    sensors,
    ...(source.navPoints.length > 0 ? { navPoints: source.navPoints } : {}),
  };
}

// The one bubble whose region the script's slice names.
function sliceBubble(
  scenario: ScenarioClient,
  activityName: string,
  slice: string
): number {
  const region = sliceRegionHash(slice);
  const found = scenario.bubbles.flatMap((states, index) =>
    states[0] && states[0].region >>> 0 === region ? [index] : []
  );
  if (found.length !== 1) {
    throw new Error(
      `${activityName}: slice '${slice}' names ${found.length} bubbles, not one`
    );
  }
  return found[0];
}

// The state of a bubble a phase owns, the bubble's own (0) where none does.
export function ownedState(
  bubbles: readonly Bubble[],
  bubble: number,
  phaseHash: number | undefined
): number {
  const owned = bubbles.find(
    (entry) =>
      entry.index === bubble &&
      phaseHash !== undefined &&
      entry.phase === phaseHash >>> 0
  );
  return owned?.state ?? 0;
}

// undefined when the packages name no scenario_client for the activity.
export function readActivityTable(
  activityName: string,
  start: ActivityStartData
): ActivityBundles | undefined {
  const { readers } = contentBuild();
  const scenario = readers.activityScenario(activityName);
  if (!scenario) {
    return;
  }
  if (start.destination === undefined) {
    throw new Error(
      `${activityName}: ${start.script} is in no destination folder (es/<destination>/)`
    );
  }
  if (start.startSlice === undefined) {
    throw new Error(`${activityName}: ${start.script} writes no @start_slice`);
  }
  const bubbles: Bubble[] = [];
  const tags: number[] = [];
  const add = (list: readonly number[]) =>
    list.map((tag) => {
      if (!tags.includes(tag)) {
        tags.push(tag);
      }
      return tag;
    });
  // Every state of a bubble. State 0 is the bubble's own; a later one is a
  // phase's, and the client swaps to it while that phase is the lifetime's.
  scenario.bubbles.forEach((states, index) => {
    states.forEach((state, stateIndex) => {
      bubbles.push({
        index,
        ...(stateIndex > 0 ? { state: stateIndex, phase: state.phase } : {}),
        region: state.region,
        public: state.public,
        global: add(state.blueprints.global),
        authoritative: add(state.blueprints.authoritative),
        private: add(state.blueprints.private),
      });
    });
  });
  const sources = tags.map((tag) => readers.activityBundle(tag));
  const info = bundleInfo(sources);
  const phases: ActivityPhase[] = start.phases.map(({ hash, name, slice }) => ({
    bubble: sliceBubble(scenario, activityName, slice),
    hash,
    name,
  }));
  const initialBubble = sliceBubble(scenario, activityName, start.startSlice);
  const initialState = ownedState(
    bubbles,
    initialBubble,
    start.startPhase?.hash
  );
  return {
    activityName,
    destination: start.destination,
    scenario: {
      tag: scenario.tag,
      familyChecksum: scenario.familyChecksum,
      privateChecksum: scenario.privateChecksum,
      publicChecksum: scenario.publicChecksum,
      bubbleCount: scenario.bubbles.length,
      initialBubble,
      ...(initialState ? { initialState } : {}),
      ...(start.spawnTransition === undefined
        ? {}
        : { spawnTransition: start.spawnTransition }),
    },
    ...(phases.length > 0 ? { phases } : {}),
    bubbles,
    tags: tags.map((tag, i) => bundleTag(tag, sources[i], info)),
  };
}
