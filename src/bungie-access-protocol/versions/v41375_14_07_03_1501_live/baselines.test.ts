import { expect, it } from "vitest";
import { type CharacterRecord } from "../../../investment/character-store";
import { CharacterLoadout } from "../../../investment/loadout";
import { STUB_APPEARANCE } from "../../../investment/stubs/stub-account";
import { describeWithPackages } from "../../../test-support/build";
import {
  buildInspectionBaselineBody,
  buildPeerBaselineBody,
  buildSelfBaselineBody,
} from "./baselines";

const ACCOUNT = 0x0000000100000001n;
describeWithPackages("typed peer/inspection/self baselines", () => {
  const CHAR: CharacterRecord = {
    soid: 0x0000000200000002n,
    accountSoid: ACCOUNT,
    name: "codie",
    appearance: STUB_APPEARANCE,
    level: 1,
    progressionXp: 0,
    progressionZeroXp: 0,
    prologuePending: false,
    loadout: CharacterLoadout.stub(),
    profile: null,
  };

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
