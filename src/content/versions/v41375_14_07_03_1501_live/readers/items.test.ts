import { expect, it } from "vitest";
import { describeWithPackages } from "../../../../test-support/build";
import { itemDefs, itemName } from "../../../items";

describeWithPackages("item names", () => {
  it("reads the English name through the display and localized strings tables", () => {
    // The starter emblem.
    expect(itemName(1562)).toBe("Sign of the Ancients");
  });

  it("has no name past the item table", () => {
    expect(itemName(itemDefs().length)).toBe("");
    expect(itemName(-1)).toBe("");
  });
});
