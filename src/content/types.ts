import type { ActivityBundleTag } from "@blamnetwork/bullshcript/destiny1/common";

// Which bundles a bubble loads (its slice descriptor's client blueprint set).
export interface Bubble {
  // Built in the authoritative instance's world per slice set: the public
  // host's world for a public bubble, the private one otherwise.
  authoritative: readonly number[];
  // Built in the private world once per activity, kept across slice sets.
  global: readonly number[];
  index: number;
  // A later state's phase: fnv1 of the Phase row whose running selects it
  // (the lifetime's phase hash; act_cosmo_m0_highway's bubble 14 state 1 is
  // cosmo_m0_phase00_highway_intro's).
  phase?: number;
  // Built in the private world per slice set.
  private: readonly number[];
  // The bubble state's mode is nonzero: a public region, which needs a
  // public host (GAH) bound on entry.
  public: boolean;
  // The bubble's region name hash.
  region: number;
  // The bubble state, 0 when left out. A region handle packs it under the
  // bubble (bubble << 3 | state).
  state?: number;
}

// A row the client builds a sensor for, with an auth schema: its sensor
// client applies nothing until every one of these in the loaded bundles has
// had an auth.
export interface Sensor {
  auth: number;
  // The sense schema, when the client reports on it.
  sense?: number;
  // The slice set (bubble) the sensor loads with, -1 for always.
  sliceSet: number;
  typeId: number;
  typeIndex: number;
}

// The activity's scenario_client (80800616).
export interface Scenario {
  bubbleCount: number;
  // fnv1 of the activity name.
  familyChecksum: number;
  // The bubble whose region the script's @start_slice names.
  initialBubble: number;
  // The start bubble's state: a later one is the first phase's own
  // (an opening cinematic), unset is 0.
  initialState?: number;
  privateChecksum: number;
  publicChecksum: number;
  // The GAS spawn transition name: the spawn point the player starts at.
  // Unset is "default".
  spawnTransition?: number;
  tag: number;
}

// A NavPoint row's baked position and the slice set (bubble) it is in.
export interface ActivityNavPoint {
  sliceSet: number;
  typeIndex: number;
  x: number;
  y: number;
  z: number;
}

export type BundleTag = Omit<ActivityBundleTag, "activityName"> & {
  navPoints?: readonly ActivityNavPoint[];
  sensors: readonly Sensor[];
};

// A Phase row the activity root runs, in mission order, and the bubble the
// real lifetime names beside it (true meaning unknown).
export interface ActivityPhase {
  bubble: number;
  // fnv1 of the phase row's name
  hash: number;
  name: string;
}

// An activity's bundle tables, straight off the disc packages. Row type ids
// are bullshcript's ActivityBundleItemType.
export interface ActivityBundles {
  activityName: string;
  bubbles: readonly Bubble[];
  // The destination's script folder (es\<destination>\): two destinations
  // can name a bundle the same (enc_plaza_amb1).
  destination: string;
  // The phases in the order the lifetime runs them, when known.
  phases?: readonly ActivityPhase[];
  scenario: Scenario;
  tags: readonly BundleTag[];
}
