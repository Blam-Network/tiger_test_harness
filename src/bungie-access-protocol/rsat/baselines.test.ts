import { describe, expect, it } from "vitest";
import {
  buildInspectionBaselineBody,
  buildPeerBaselineBody,
  buildSelfBaselineBody,
} from "./index";

const ACCOUNT = 0x0000000100000001n;
const CHAR = 0x0000000200000002n;

describe("typed peer/inspection/self baselines", () => {
  it("peer baseline is deterministic and non-empty", () => {
    const a = buildPeerBaselineBody(ACCOUNT, ACCOUNT, 1, undefined, CHAR);
    const b = buildPeerBaselineBody(ACCOUNT, ACCOUNT, 1, undefined, CHAR);
    expect(a.length).toBeGreaterThan(32);
    expect(a.equals(b)).toBe(true);
  });

  it("inspection baseline is deterministic and non-empty", () => {
    const a = buildInspectionBaselineBody(ACCOUNT, ACCOUNT, 1, undefined, CHAR);
    const b = buildInspectionBaselineBody(ACCOUNT, ACCOUNT, 1, undefined, CHAR);
    expect(a.length).toBeGreaterThan(32);
    expect(a.equals(b)).toBe(true);
  });

  it("self baseline is deterministic and non-empty", () => {
    const a = buildSelfBaselineBody(ACCOUNT, ACCOUNT, 1, undefined, CHAR);
    const b = buildSelfBaselineBody(ACCOUNT, ACCOUNT, 1, undefined, CHAR);
    expect(a.length).toBeGreaterThan(32);
    expect(a.equals(b)).toBe(true);
  });
});
