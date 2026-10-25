// What a build's reader hands the table assembly (activity-table.ts), which
// builds an ActivityBundles (types.ts) from it.
import type { ActivityNavPoint } from "../types";

// The bundles a bubble state loads, as tag ids.
interface BlueprintSet {
  authoritative: readonly number[];
  global: readonly number[];
  private: readonly number[];
}

// One state of a bubble: its slice descriptor's region and blueprint set.
interface BubbleStateSource {
  blueprints: BlueprintSet;
  // The phase row's name hash a later state is selected by; state 0's is
  // unused.
  phase: number;
  // The state's mode is nonzero: a public region.
  public: boolean;
  region: number;
}

// An activity's scenario_client with each bubble's states.
export interface ScenarioClient {
  bubbles: readonly (readonly BubbleStateSource[])[];
  familyChecksum: number;
  privateChecksum: number;
  publicChecksum: number;
  tag: number;
}

// An Objective row's AI task: its name hash and influencer. A build whose
// hosts store the task tree also gives its links (the runtime's
// ObjectiveTask); the rest are left unset.
export interface ObjectiveTaskSource {
  capacity?: number;
  firstChild?: number;
  influencer: number;
  name: number;
  nextSibling?: number;
  parent?: number;
  priority?: number;
}

// A sensor host of a bundle: the row it serves, its schemas and, by row
// type, what the host definition says of the row.
export interface SensorHostSource {
  // Actor rows: the Squad row and cell it fills.
  actor?: { cell: number; squad: number };
  // The auth schema, undefined when the client builds no sensor for the row.
  auth: number | undefined;
  // fnv1 of the row's import identifier, k_empty_name_hash for none.
  identifier: number;
  // The row's index within its type.
  index: number;
  // Object rows: where the object stands, for a waypoint on it.
  objectPosition?: { x: number; y: number; z: number };
  sense: number | undefined;
  // Sequence rows: whether it has a blueprint, and its length in seconds.
  sequence?: { blueprint: boolean; duration: number };
  sliceSet: number;
  // Squad rows: each cell's member name hash.
  squadMembers?: readonly number[];
  // Squad rows: where its template spawns it, which a kill incident's
  // position finds it by.
  squadSpawnPoints?: readonly { x: number; y: number; z: number }[];
  // Objective rows: the AI tasks in order.
  tasks?: readonly ObjectiveTaskSource[];
  typeId: number;
}

interface BundleRowSource {
  // Unset where the packages hold the hash only.
  name?: string;
  nameHash: number;
  typeId: number;
}

// One activity bundle tag. A bundle loaded as several tags lists each host in
// only one of them.
export interface BundleSource {
  bundle: number;
  hosts: readonly SensorHostSource[];
  navPoints: readonly ActivityNavPoint[];
  rows: readonly BundleRowSource[];
}
