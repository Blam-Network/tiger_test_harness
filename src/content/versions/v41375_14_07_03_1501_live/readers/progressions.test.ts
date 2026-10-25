import { expect, it } from "vitest";
import { describeWithPackages } from "../../../../test-support/build";
import {
  clientDestinations,
  destinationProgressions,
} from "../../../destinations";
import {
  characterConstants,
  levelProgression,
  xpForLevel,
} from "../../../progressions";

describeWithPackages("character progressions", () => {
  it("names the level progression through the character constants", () => {
    const constants = characterConstants();
    expect(constants.progressions).toEqual([108, 109, 111, 110, 196, 197]);
    expect(constants.levelCap).toBe(20);
    const level = levelProgression();
    expect(level.index).toBe(109);
    expect(level.steps).toHaveLength(constants.levelCap);
    expect(xpForLevel(level, constants.levelCap)).toBe(305_900);
  });

  it("reads the destinations' progressions", () => {
    expect(clientDestinations()[14]?.progressions).toEqual([117, 120]);
    expect(destinationProgressions()).toEqual([117, 119, 120, 125]);
  });
});
