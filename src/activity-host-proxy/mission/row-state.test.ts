import { describe, expect, it } from "vitest";
import { rowKey, SensorRowState } from "./row-state";

describe("rowKey", () => {
  it("keys a row by its unsigned bundle", () => {
    expect(rowKey(-1, 32, 123)).toBe("4294967295:32:123");
  });
});

describe("SensorRowState", () => {
  it("reports whether an activity flag actually changed", () => {
    const state = new SensorRowState();
    expect(state.setActivityFlag(0xff_ff_ff_ff, true)).toBe(true);
    expect(state.setActivityFlag(-1, true)).toBe(false);
    expect(state.playerActivityFlags).toEqual([0xff_ff_ff_ff]);
    expect(state.setActivityFlag(0xff_ff_ff_ff, false)).toBe(true);
    expect(state.playerActivityFlags).toEqual([]);
  });
});
