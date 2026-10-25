import type {
  ActivityBundleItemTypes,
  ActivityBundleTag,
  ControlPointCommandScript,
  EncounterScriptHost,
  EncounterScriptHostOptions,
  ScriptSource,
} from "@blamnetwork/bullshcript/destiny1/common";
import type { BundleSource, ScenarioClient } from "../model/activity-source";
import type {
  Ability,
  ActivityDefinition,
  CharacterConstants,
  ClientDestination,
  InventoryTable,
  ItemRecord,
  NewCharacterTable,
  PackageHeaderFields,
  ProgressionDef,
  ServerMessage,
  StatCurve,
  TalentGrid,
  TalentGridBuildSource,
  UnlockTables,
  Vendor,
} from "../model/investment";

// A build's raw table reads. The neutral modules under src/content call
// these lazily and keep what they return; the package structs behind them
// differ per build.
export interface ContentReaders {
  abilities(): readonly Ability[];
  // One activity bundle tag's rows, sensor hosts and NavPoint positions.
  activityBundle(tag: number): BundleSource;
  // By activity id (holes have an empty name).
  activityDefinitions(): readonly ActivityDefinition[];
  // The activity's scenario_client, undefined when the packages name none.
  activityScenario(activityName: string): ScenarioClient | undefined;
  characterConstants(): CharacterConstants;
  clientDestinations(): readonly ClientDestination[];
  // One activity bundle tag's ControlPoint rows' command scripts, the paths a
  // script's execute() sends an actor along. A build whose hosts send none
  // reads none.
  commandScripts(tag: number): readonly ControlPointCommandScript[];
  // The client's incident registry: name hashes by index.
  incidentNames(): readonly number[];
  inventoryTable(): InventoryTable;
  itemDefinitions(): readonly ItemRecord[];
  // The English display name of the item definition at an index, "" for none.
  itemName(defIndex: number): string;
  // The role of the character constants' progression that is the level.
  levelProgressionRole(): number;
  newCharacterTable(): NewCharacterTable;
  // The package header fields; the buffer holds packageHeaderSize() bytes.
  packageHeader(header: Buffer): PackageHeaderFields;
  packageHeaderSize(): number;
  // The header's language id for a language name ("english"), undefined for
  // a name the build lacks.
  packageLanguage(name: string): number | undefined;
  // The progression at a table row, undefined past the table.
  progression(index: number): ProgressionDef | undefined;
  recordFlags(): readonly number[];
  serverMessages(): readonly ServerMessage[];
  statCurves(): readonly StatCurve[];
  // The talent grid at a table row, undefined past the table.
  talentGrid(index: number): TalentGrid | undefined;
  // The grid's ability grants and node perks, for a subclass's starting build.
  talentGridBuildSource(index: number): TalentGridBuildSource;
  unlockTables(): UnlockTables;
  vendors(): readonly Vendor[];
}

// The ids a build numbers its own way. Equip slots are the equip slot byte of
// an item def's equipable block; buckets are the ids of the inventory table
// (inventory.test.ts checks each against the table's equip slot order). -1
// is "the build has none".
export interface ContentIds {
  bucket: {
    chest: number;
    classItem: number;
    emblem: number;
    energy: number;
    gauntlets: number;
    helmet: number;
    kinetic: number;
    legs: number;
    power: number;
    subclass: number;
  };
  equipSlot: {
    chest: number;
    classItem: number;
    emblem: number;
    gauntlets: number;
    ghost: number;
    heavy: number;
    helmet: number;
    legs: number;
    primary: number;
    shader: number;
    ship: number;
    special: number;
    subclass: number;
    vehicle: number;
  };
  // The emblem def each wire class index starts with equipped, for a build
  // whose new-character defaults name no emblem.
  starterEmblem?: Readonly<Record<number, number>>;
  // The item defs the server gives a new character beyond the new-character
  // defaults' lists, by the equip slot (a key of equipSlot) they fill. The
  // packages name no source for them.
  starterPicks: Readonly<
    Partial<Record<keyof ContentIds["equipSlot"], number>>
  >;
  // The subclass def each wire class index starts with, for a build whose
  // item defs name no class (so the subclass can't be found by it).
  starterSubclass?: Readonly<Record<number, number>>;
  // The item def tiers the item filters step by.
  tier: { exotic: number; legendary: number };
  // The value an unlock slot or time row holds to set its flag.
  unlockFlagSet: number;
}

// What a build's bullshcript ScriptRuntime takes: the encounter host over the
// scripts of the bundles it serves, with the build's row types bound.
interface ScriptRuntimeOptions
  extends Omit<
    EncounterScriptHostOptions,
    | "childScripts"
    | "chunkOwners"
    | "chunks"
    | "rootTags"
    | "rowOwners"
    | "types"
  > {
  bundles: readonly ActivityBundleTag[];
  scriptFor: (bundleTag: number) => number | undefined;
  scripts: ScriptSource;
}

export interface ScriptRuntimeInstance extends EncounterScriptHost {
  // Tag ids of every script the runtime loaded, roots first.
  readonly scriptTags: readonly string[];
}

export interface ContentBuild {
  // The script host and row types bullshcript binds to a build.
  bullshcript: {
    // TriggerGroup and Machine rows exist in some builds only.
    ActivityBundleItemType: ActivityBundleItemTypes;
    // A module in bullshcript's package, for finding Fukugen Daihon beside it.
    entryModule: string;
    ScriptRuntime: new (options: ScriptRuntimeOptions) => ScriptRuntimeInstance;
  };
  ids: ContentIds;
  readers: ContentReaders;
}
