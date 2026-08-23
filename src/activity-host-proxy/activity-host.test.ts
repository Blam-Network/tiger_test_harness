import { describe, expect, it } from "vitest";
import { ActivityHostService } from "./activity-host";

describe("ActivityHostService", () => {
  it("grants class 0 once as a 1536-byte full mask", () => {
    const ah = new ActivityHostService(1n);
    const mask = ah.takeFirstEntityIndexGrant();
    expect(mask?.equals(Buffer.alloc(1536, 0xff))).toBe(true);
    expect(ah.takeFirstEntityIndexGrant()).toBeNull();
  });

  it("does not share grant state with another AH", () => {
    const fah = new ActivityHostService(1n);
    const gah = new ActivityHostService(2n);
    expect(fah.takeFirstEntityIndexGrant()).not.toBeNull();
    expect(gah.takeFirstEntityIndexGrant()).not.toBeNull();
  });
});
