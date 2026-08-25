/** Host scenario FAH — class 80800890. */
export interface ScenarioFahTag {
  activityName: string;
  class: 0x80800890;
  /** +0x1C starting bubble. */
  initialBubble: number;
  tag: number;
}

/** scenario_client — class 808008A4. */
export interface ScenarioClientTag {
  activityName: string;
  bubbleCount: number;
  class: 0x808008a4;
  emptyBubbles?: readonly number[];
  familyChecksum: number;
  privateChecksum: number;
  publicChecksum: number;
  tag: number;
}

// We have nothing official on this
// its name is inferred from logs
// its members are inferred from hashed strings
export enum ActivityBundleItemType {
  Squad = 1,
  Actor = 2,
  Objective = 3,
  Object = 4,
  Sequence = 5,
  Cinematic = 6,
  Fireteam = 9,
  Player = 12,
  Faction = 13,
  TeamPicker = 14,
  Scoreboard = 15,
  Lifetime = 16,
  Timer = 17,
  Health = 19,
  Unknown24 = 24,
  SafeZone = 27,
  PlayerMonitor = 28,
  PlayerTrigger = 29,
  PlayerObjective = 32,
  ObjectFilter = 33,
  HardWipeGlobals = 34,
  Loot = 35,
  FiringArea = 40,
  FiringAreaSet = 41,
  SquadGroup = 42,
  NavPoint = 43,
  ActionPoint = 44,
  LandingPoint = 45,
  SpawnPoint = 46,
  SpawnInfluencer = 47,
  NewMission = 53,
  Location = 54,
  ControlPoint = 55,
  TriggerVolume = 57,
  Encounter = 58,
  Phase = 59,
  EncounterBinding = 60,
}

/**
 * One 80800608 record from an 808004C5 host tag.
 */
export interface SensorSlotRow {
  activityNames?: readonly string[];
  authSchema: number;
  bundle: number;
  hostTag: number;
  recordOff: number;
  senseSchema: number | null;
  typeId: ActivityBundleItemType;
  typeIndex: number;
}

/**
 * One row from class 80800533 (per-activity bundle table).
 * typeIndex is the row's position in that table
 */
export interface ActivityBundleRow {
  nameHash: number;
  typeId: ActivityBundleItemType;
  typeIndex: number;
}

/** 80800533 — activity bundle table. */
export interface ActivityBundleTag {
  activityName: string;
  /** Set when the package names more than one activity. */
  activityNames?: readonly string[];
  bundle: number;
  class: 0x80800533;
  rows: readonly ActivityBundleRow[];
  tag: number;
}
