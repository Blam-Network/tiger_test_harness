import { expect, it } from "vitest";
import { buildFolder, e_build } from "../builds";
import { describeEachPackages } from "../test-support/build";

// Per build: the strike's activity row (cosmo_portal_1, at the level a new
// character starts on), the level progression's table row and that level.
const NEW_CHARACTER: Partial<
  Record<e_build, { level: number; progression: number; strike: number }>
> = {
  [e_build.v38464_14_02_28_1027_betath]: {
    level: 6,
    progression: 11,
    strike: 183,
  },
  [e_build.v39573_14_04_03_1336_ff]: {
    level: 21,
    progression: 57,
    strike: 303,
  },
};

describeEachPackages(
  "new character level",
  (build) => {
    const expected = NEW_CHARACTER[build];

    it("starts on the level progression's step", async () => {
      const { levelProgression } = await import("../content/progressions");
      const { activityName } = await import("../content/activities");
      const { levelForXp } = await import("./character-level");
      const { NEW_CHARACTER_LEVEL, newCharacterXp } = await import(
        `./versions/${buildFolder(build)}/new-character.ts`
      );
      const progression = levelProgression();
      expect(NEW_CHARACTER_LEVEL).toBe(expected?.level);
      expect(progression.index).toBe(expected?.progression);
      // Step 0 costs nothing (level 1); the steps after it take it to the level.
      const steps = progression.steps
        .slice(0, NEW_CHARACTER_LEVEL)
        .map((step) => step.xpRequired);
      expect(newCharacterXp()).toBe(steps.reduce((sum, xp) => sum + xp, 0));
      expect(levelForXp(newCharacterXp())).toBe(NEW_CHARACTER_LEVEL);
      expect(levelForXp(newCharacterXp() - 1)).toBe(NEW_CHARACTER_LEVEL - 1);
      expect(activityName(expected?.strike ?? -1)).toBe("cosmo_portal_1");
    });
  },
  Object.keys(NEW_CHARACTER) as e_build[]
);
