// Runtime debug toggles for the activity host, read from debug-toggles.json in
// the server's working directory at every AH session start and world entry: no
// restart, no env. The file is optional. The page at /debug only shows state;
// this file is the one place that changes it. Example:
//
//   {
//     "startPhase": { "act_cosmo_m0_highway": 2 },
//     "omitScriptRowTypes": [1, 2],
//     "stripNavPoints": true,
//     "actorPlaceBody": "retail",
//     "allowGrantedEquip": true,
//     "grantLevelQuality": "zero"
//   }
//
// The inventory toggles are read by the character store (loadout repair)
// and the self family encoder, on every character read / push.
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { workingDir } from "../env";

export interface DebugToggles {
  // How a placed named actor's auth goes out. "bare" is the place flag alone;
  // "retail" adds what every placement in the 2.3.1 captures carries: [0] = 1
  // and a behaviour of generation 1.
  actorPlaceBody?: "bare" | "retail";
  // Keep non-kit armour / weapons equipped across sign-in. Off, the loadout
  // repair sends any equipped item that is not the class starter kit's back to
  // the bag on read, so a bad equip can never crash-loop sign-in.
  allowGrantedEquip?: boolean;
  // What every item's 80801711 {level, required level, quality} carries
  // instead of the row's own values: "zero" sends 0 / 0 / 0, "def" the def's
  // level block. Isolates the item object from an equip crash.
  grantLevelQuality?: "def" | "zero";
  // Row type ids whose script-written bodies are withheld: applies keep
  // the rows' idle auths and no update goes out for them. 1 squads, 2
  // actors, 4 objects, 5 sequences, 32 player objectives. The binder's
  // lifetime (16) and players (12) are never withheld.
  omitScriptRowTypes?: readonly number[];
  // Send the rowless SensorAuth updates (applies, grants) with their sense
  // rows instead of dropping them (bring-up; rows built from data always keep
  // theirs).
  senseRows?: boolean;
  // Activity name -> the phase index a new instance starts in: that phase's
  // bubble and state (the GAS), the lifetime's phase and its mission's
  // scripts, the way a checkpoint would. act_cosmo_m0_highway: 2 is the
  // breach.
  startPhase?: Readonly<Record<string, number>>;
  // Player objectives go out without their nav point slots.
  stripNavPoints?: boolean;
}

interface DebugTogglesRead {
  // What could not be read or was not understood, for the log.
  problems: readonly string[];
  source: "file" | "none" | "test";
  toggles: DebugToggles;
}

const DEBUG_TOGGLES_FILE = "debug-toggles.json";

const NO_TOGGLES: DebugTogglesRead = {
  problems: [],
  source: "none",
  toggles: {},
};

let testToggles: DebugToggles | undefined;
let cached:
  | { mtimeMs: number; path: string; read: DebugTogglesRead }
  | undefined;

function debugTogglesPath(): string {
  return resolve(workingDir(), DEBUG_TOGGLES_FILE);
}

// The toggles as the file has them now. Re-read when the file changes;
// a stat per call otherwise.
export function readDebugToggles(path = debugTogglesPath()): DebugTogglesRead {
  if (testToggles) {
    return { problems: [], source: "test", toggles: testToggles };
  }
  let mtimeMs: number;
  try {
    mtimeMs = statSync(path).mtimeMs;
  } catch {
    cached = undefined;
    return NO_TOGGLES;
  }
  if (cached && cached.path === path && cached.mtimeMs === mtimeMs) {
    return cached.read;
  }
  let read: DebugTogglesRead;
  try {
    read = parseDebugToggles(JSON.parse(readFileSync(path, "utf8")));
  } catch (error) {
    read = {
      problems: [
        `${path}: ${error instanceof Error ? error.message : String(error)}`,
      ],
      source: "file",
      toggles: {},
    };
  }
  cached = { mtimeMs, path, read };
  return read;
}

// Tests set the toggles directly; undefined goes back to the file.
export function setDebugTogglesForTest(
  toggles: DebugToggles | undefined
): void {
  testToggles = toggles;
}

export function parseDebugToggles(raw: unknown): DebugTogglesRead {
  const problems: string[] = [];
  const toggles: DebugToggles = {};
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { problems: ["not a JSON object"], source: "file", toggles };
  }
  for (const [key, value] of Object.entries(raw)) {
    switch (key) {
      case "actorPlaceBody":
        if (value === "bare" || value === "retail") {
          toggles.actorPlaceBody = value;
        } else {
          problems.push(`${key}: expected "bare" or "retail"`);
        }
        break;
      case "allowGrantedEquip":
        if (typeof value === "boolean") {
          toggles.allowGrantedEquip = value;
        } else {
          problems.push(`${key}: expected true or false`);
        }
        break;
      case "grantLevelQuality":
        if (value === "def" || value === "zero") {
          toggles.grantLevelQuality = value;
        } else {
          problems.push(`${key}: expected "def" or "zero"`);
        }
        break;
      case "omitScriptRowTypes":
        if (
          Array.isArray(value) &&
          value.every((type) => Number.isInteger(type) && type >= 0)
        ) {
          toggles.omitScriptRowTypes = value as number[];
        } else {
          problems.push(`${key}: expected a list of row type ids`);
        }
        break;
      case "senseRows":
        if (typeof value === "boolean") {
          toggles.senseRows = value;
        } else {
          problems.push(`${key}: expected true or false`);
        }
        break;
      case "startPhase":
        if (
          typeof value === "object" &&
          value !== null &&
          !Array.isArray(value) &&
          Object.values(value).every(
            (index) => Number.isInteger(index) && (index as number) >= 0
          )
        ) {
          toggles.startPhase = value as Record<string, number>;
        } else {
          problems.push(`${key}: expected { "<activity>": <phase index> }`);
        }
        break;
      case "stripNavPoints":
        if (typeof value === "boolean") {
          toggles.stripNavPoints = value;
        } else {
          problems.push(`${key}: expected true or false`);
        }
        break;
      default:
        problems.push(`${key}: unknown toggle`);
    }
  }
  return { problems, source: "file", toggles };
}

export function describeDebugToggles(read: DebugTogglesRead): string {
  const set = Object.keys(read.toggles).length > 0;
  const body = set
    ? JSON.stringify(read.toggles)
    : `none (${read.source === "none" ? `no ${DEBUG_TOGGLES_FILE}` : "empty"})`;
  return read.problems.length > 0
    ? `${body} problems: ${read.problems.join("; ")}`
    : body;
}
