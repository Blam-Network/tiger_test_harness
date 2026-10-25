import { expect, it } from "vitest";
import { describeWithPackages } from "../../../../test-support/build";
import { classFlagRanges } from "../../../class-flags";
import {
  newCharacterDefaults,
  newCharacterFlags,
} from "../../../new-character";

describeWithPackages("new character defaults", () => {
  it("names each class's flags", () => {
    expect(classFlagRanges()).toEqual([
      [1645, 1651, 0],
      [1623, 1629, 1],
      [1652, 1658, 2],
    ]);
  });

  it("lists each class's starting gear by equip slot", () => {
    // Armour (helmet..class item), sparrow, ghost, class emblem.
    expect(newCharacterDefaults(0)).toEqual({
      subclass: 776,
      items: {
        1: 199,
        2: 193,
        3: 195,
        4: 201,
        5: 197,
        10: 3090,
        11: 892,
        12: 856,
      },
    });
    expect(newCharacterDefaults(1)?.subclass).toBe(775);
    expect(newCharacterDefaults(1)?.items[12]).toBe(853);
    expect(newCharacterDefaults(2)?.subclass).toBe(779);
    expect(newCharacterDefaults(2)?.items[12]).toBe(859);
    expect(newCharacterDefaults(3)).toBeUndefined();
  });

  it("reads the flags a character is created with", () => {
    const flags = newCharacterFlags(0, 1);
    expect(flags).toContainEqual({ flag: 1871, value: 2 });
    expect(flags.every((entry) => entry.value === 2)).toBe(true);
    expect(newCharacterFlags(9, 9)).toEqual([]);
  });
});
