import { destinationProgressions } from "../content/destinations";
import {
  characterConstants,
  levelProgression,
  levelForXp as progressionLevelForXp,
  xpForLevel as progressionXpForLevel,
} from "../content/progressions";
import {
  evaluateStatCurve,
  invertStatCurve,
  type StatCurvePoint,
  statCurve,
  statCurveFrom,
} from "../content/stat-curves";
import { resolveCharacterLevel } from "../env";

// The client's level for activity gates is the progression level of the
// character constants' level progression (109), read from the self character
// progression rows (80801714 member 7, rows {i32 xp, i32, i32, i16 progression
// index}). Once that reaches the level cap (20) the level becomes max(20,
// floor(light level)), where light level is the light stat run through its
// stat curve. The light stat comes from 80801714 member 16 (808018BB) member 3
// when the server sends it, else from the equipped gear.

// Level = steps whose XP fits, so step 0 (0 XP) gives level 1 and the sum of
// the steps (305,900) gives the cap.
export function levelCap(): number {
  return characterConstants().levelCap;
}

let lightCurve: StatCurvePoint[] | undefined;

// The light stat's curve from the level cap on, {x: level, y: light}. Past the
// cap the client maps light to level along it. The curve opens with two points
// below the cap that the mapping never reaches, the first at the cap's own x.
function lightCurveFromCap(): StatCurvePoint[] {
  if (!lightCurve) {
    const stat = characterConstants().stats[0]!;
    lightCurve = statCurveFrom(statCurve(stat)!.points, levelCap());
  }
  return lightCurve;
}

// The highest level light reaches (50).
function maxLightLevel(): number {
  return lightCurveFromCap().at(-1)!.x;
}

// The highest activity requirement in data is 33 (def +72); 34 is the House of
// Wolves cap. CHARACTER_LEVEL overrides (1..50).
const DEFAULT_CHARACTER_LEVEL = 34;

let characterLevelValue: number | undefined;

export function characterLevel(): number {
  characterLevelValue ??= resolveCharacterLevel(
    DEFAULT_CHARACTER_LEVEL,
    maxLightLevel()
  );
  return characterLevelValue;
}

// XP on the level progression that reads as `level` (capped at the last step).
export function xpForLevel(level: number): number {
  return progressionXpForLevel(levelProgression(), level);
}

// Count the steps whose XP still fits, as the client's walk does.
export function levelForXp(xp: number): number {
  return progressionLevelForXp(levelProgression(), xp).level;
}

// Light (stat 0) whose curve level floors to `level`. One point over the exact value
// so float rounding can't land just under it. 0 below the cap: light is ignored there.
export function lightForLevel(level: number): number {
  if (level <= levelCap()) {
    return 0;
  }
  return Math.ceil(evaluateStatCurve(lightCurveFromCap(), level)) + 1;
}

// Client mapping light -> level, clamped to the last point.
export function levelForLight(light: number): number {
  return invertStatCurve(lightCurveFromCap(), light);
}

// The level the activity gate compares with def +72.
export function effectiveLevel(progressionLevel: number, light: number) {
  if (progressionLevel < levelCap()) {
    return progressionLevel;
  }
  return Math.max(progressionLevel, Math.floor(levelForLight(light)));
}

// Progressions the client looks up in the character's rows without a null
// check (a missing index reads 0). The activity reward tracker reads, when the
// self character's 808017B9 [0] changes to an activity, the character
// constants' progressions [1] and [3] (109, 110) and every progression of the
// activity's destination row. Every constants role and every destination's
// list is included so no activity can hit it.
function trackedProgressions(): number[] {
  return [
    ...new Set([
      ...characterConstants().progressions,
      ...destinationProgressions(),
    ]),
  ];
}

// Self character member 7: the level row plus a zero-XP row for every progression the
// client dereferences unchecked.
export function progressionRows(level = characterLevel()) {
  const levelIndex = levelProgression().index;
  const others = new Set(trackedProgressions());
  others.delete(levelIndex);
  return [
    {
      unknown0: xpForLevel(level),
      unknown1: 0,
      unknown2: 0,
      unknown3: levelIndex,
    },
    ...[...others].map((index) => ({
      unknown0: 0,
      unknown1: 0,
      unknown2: 0,
      unknown3: index,
    })),
  ];
}

// Self character member 16 (808018BB) member 3: a present flag plus 7 {i8 stat,
// i32 value} pairs the stat code reads before summing gear. Only the light stat
// is set; stat -1 never matches, so the other stats still come from gear.
const NO_STAT = -1;

export function statOverride(level = characterLevel()) {
  const light = lightForLevel(level);
  if (light === 0) {
    return;
  }
  return {
    unknown0: true,
    unknown1: {
      unknown0: [
        { unknown0: characterConstants().stats[0]!, unknown1: light },
        ...Array.from({ length: 6 }, () => ({
          unknown0: NO_STAT,
          unknown1: 0,
        })),
      ],
    },
  };
}
