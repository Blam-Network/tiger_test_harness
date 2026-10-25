// Dev gear grants: item-grants.<build folder>.json beside prisma/ (def indices
// differ per build; the release executable embeds it as an asset) lists defs a
// character gets in its bag the next time the store reads it (sign-in),
// through the starter kit repair path (investment/item-grants.ts plans it).
// The file is optional. Example:
//
//   {
//     "defaults": { "level": 20, "quality": 62 },
//     "grants": [
//       { "label": "Gjallarhorn", "defIndex": 2075 },
//       { "label": "Thorn", "defIndex": 2069, "quality": 43, "equip": true },
//       { "label": "Voidfang Vestments", "defIndex": 1253,
//         "characters": ["0x200000001"] }
//     ]
//   }
//
// label must be the def's display name (a mistyped index is skipped, not
// granted). Idempotent: a def the character already holds is not granted again
// (a sold or destroyed grant comes back on the next sign-in). Class-locked
// armour only goes to that class, so one list serves every character. A grant
// that does not fit its bucket is skipped. equip puts the item in its slot on
// grant, the displaced item going back to the bag. level and quality are the
// item's primary stat inputs (primary-stat.ts).
import { readAsset } from "../assets";
import { activeBuild, buildFolder } from "../builds";

export interface ItemGrant {
  // Character soids this grant is for; every character when absent.
  characters?: readonly bigint[];
  defIndex: number;
  // Equip it on grant (once); the displaced item goes back to the bag.
  equip: boolean;
  // The def's display name, checked before granting.
  label?: string;
  level?: number;
  quality?: number;
}

export interface ItemGrants {
  // Level and quality for grants that give none.
  defaults: { level?: number; quality?: number };
  grants: readonly ItemGrant[];
}

interface ItemGrantsRead {
  grants: ItemGrants;
  // What could not be read or was not understood, for the log.
  problems: readonly string[];
  source: "file" | "none";
}

// The active build's grants file name.
export function itemGrantsFile(): string {
  return `item-grants.${buildFolder(activeBuild())}.json`;
}

const NO_GRANTS: ItemGrantsRead = {
  grants: { defaults: {}, grants: [] },
  problems: [],
  source: "none",
};

// The grants as the asset has them now, read on every call so an edited file
// is picked up at the next sign-in.
export function readItemGrants(
  read: () => Buffer = () => readAsset(itemGrantsFile())
): ItemGrantsRead {
  let text: string;
  try {
    text = read().toString("utf8");
  } catch {
    return NO_GRANTS;
  }
  try {
    return parseItemGrants(JSON.parse(text));
  } catch (error) {
    return {
      grants: NO_GRANTS.grants,
      problems: [
        `${itemGrantsFile()}: ${error instanceof Error ? error.message : String(error)}`,
      ],
      source: "file",
    };
  }
}

function optionalInt(
  value: unknown,
  name: string,
  problems: string[]
): number | undefined {
  if (value === undefined) {
    return;
  }
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }
  problems.push(`${name}: not an integer`);
}

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

// The file's shape, naming what it does not understand instead of failing.
export function parseItemGrants(json: unknown): ItemGrantsRead {
  const problems: string[] = [];
  const root = asObject(json);
  const defaultsIn = asObject(root.defaults);
  const defaults = {
    level: optionalInt(defaultsIn.level, "defaults.level", problems),
    quality: optionalInt(defaultsIn.quality, "defaults.quality", problems),
  };
  if (!Array.isArray(root.grants)) {
    problems.push("grants: not a list");
  }
  const grants: ItemGrant[] = [];
  const list: unknown[] = Array.isArray(root.grants) ? root.grants : [];
  for (const [i, entry] of list.entries()) {
    const at = `grants[${i}]`;
    if (typeof entry !== "object" || entry === null) {
      problems.push(`${at}: not an object`);
      continue;
    }
    const g = asObject(entry);
    const defIndex = optionalInt(g.defIndex, `${at}.defIndex`, problems);
    if (defIndex === undefined) {
      problems.push(`${at}: no defIndex`);
      continue;
    }
    let characters: bigint[] | undefined;
    if (g.characters !== undefined) {
      characters = [];
      const soids: unknown[] = Array.isArray(g.characters) ? g.characters : [];
      for (const soid of soids) {
        try {
          characters.push(BigInt(soid as string));
        } catch {
          problems.push(`${at}.characters: ${String(soid)} is not a soid`);
        }
      }
    }
    grants.push({
      characters,
      defIndex,
      equip: g.equip === true,
      label: typeof g.label === "string" ? g.label : undefined,
      level: optionalInt(g.level, `${at}.level`, problems),
      quality: optionalInt(g.quality, `${at}.quality`, problems),
    });
  }
  return { grants: { defaults, grants }, problems, source: "file" };
}
