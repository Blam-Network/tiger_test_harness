// Progressions and the character constants that name which of them is the
// character's level, read off the disc packages on first use.
import type { CharacterConstants, ProgressionDef } from "./model/investment";
import { contentBuild } from "./versions";

export type {
  CharacterConstants,
  ProgressionDef,
  ProgressionStep,
} from "./model/investment";

const progressions = new Map<number, ProgressionDef | null>();

// The progression at a progression table row, undefined past the table.
export function progressionDef(index: number): ProgressionDef | undefined {
  if (!progressions.has(index)) {
    progressions.set(index, contentBuild().readers.progression(index) ?? null);
  }
  return progressions.get(index) ?? undefined;
}

let constants: CharacterConstants | undefined;

export function characterConstants(): CharacterConstants {
  if (!constants) {
    constants = contentBuild().readers.characterConstants();
  }
  return constants;
}

let levelDef: ProgressionDef | undefined;

// The character's level progression. The constants list progressions by role
// and the client reads its level from the one at the level progression role.
export function levelProgression(): ProgressionDef {
  if (!levelDef) {
    const index =
      characterConstants().progressions[
        contentBuild().readers.levelProgressionRole()
      ];
    const def = index === undefined ? undefined : progressionDef(index);
    if (!def) {
      throw new Error("the character constants name no level progression");
    }
    levelDef = def;
  }
  return levelDef;
}

interface ProgressionLevel {
  // Steps cleared.
  level: number;
  // The next step's cost, 0 past the end of a progression that doesn't clamp.
  nextRequirement: number;
  // XP left over after the steps cleared.
  remainder: number;
}

// The real function has no iteration cap, this one does, for pathological
// inputs.
const ITERATION_CAP = 100_000;

// The client's walk: subtract each step's cost from the XP while it fits,
// counting the steps. A step costing nothing clears at 0 XP, so a progression
// opening on one starts at level 1. Past the last step the walk stops, or
// repeats the last step if the progression clamps.
export function levelForXp(
  progression: Pick<ProgressionDef, "clampAtMax" | "steps">,
  xp: number
): ProgressionLevel {
  const last = progression.steps.length - 1;
  let left = Math.max(0, Math.trunc(xp));
  let cleared = 0;
  for (let step = 0; step < ITERATION_CAP; step++) {
    if (step > last && !progression.clampAtMax) {
      return { level: cleared, remainder: left, nextRequirement: 0 };
    }
    const cost = progression.steps[Math.min(step, last)]?.xpRequired ?? 0;
    if (left < cost) {
      return { level: cleared, remainder: left, nextRequirement: cost };
    }
    left -= cost;
    cleared++;
  }
  return { level: cleared, remainder: left, nextRequirement: 0 };
}

// The least XP that reads as `level`: the cost of its first `level` steps.
export function xpForLevel(
  progression: Pick<ProgressionDef, "clampAtMax" | "steps">,
  level: number
): number {
  const last = progression.steps.length - 1;
  let total = 0;
  for (
    let step = 0;
    step < Math.min(Math.max(1, level), ITERATION_CAP);
    step++
  ) {
    if (step > last && !progression.clampAtMax) {
      break;
    }
    total += progression.steps[Math.min(step, last)]?.xpRequired ?? 0;
  }
  return total;
}
