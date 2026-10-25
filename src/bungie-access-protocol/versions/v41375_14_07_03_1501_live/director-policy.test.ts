import { decode, encode } from "@blamnetwork/rsat";
import { expect, it } from "vitest";
import { type CharacterRecord } from "../../../investment/character-store";
import { CharacterLoadout } from "../../../investment/loadout";
import { STUB_APPEARANCE } from "../../../investment/stubs/stub-account";
import { describeWithPackages } from "../../../test-support/build";
import {
  DEBUG_FLAG_CAP,
  DIRECTOR_DEBUG_UNLOCK,
  directorCharacterSlotValues,
  directorDebugFlagList,
  directorForcedFlags,
  directorServerObjectFlags,
  directorUniverseFlagList,
  towerStateFlagValues,
} from "./director-policy";
import { liveBap } from "./live-bap";
import { UNIVERSE_FLAG_CAP } from "./unlock-slots";
import { selfCharacter } from "./values";

const LAUNCH_WEEK = 1_410_307_200n;
const TDB_WINDOW = 1_417_510_860n;
const AFTER_HOW = 1_441_702_860n;

describeWithPackages("director reveal", () => {
  const CHAR: CharacterRecord = {
    soid: 0x2_0000_0001n,
    accountSoid: 0x1_0000_0001n,
    name: "codie",
    appearance: STUB_APPEARANCE,
    level: 1,
    progressionXp: 0,
    progressionZeroXp: 0,
    prologuePending: false,
    loadout: CharacterLoadout.stub(),
    profile: null,
  };

  it("fills the universe and debug lists with distinct set flags", () => {
    const universe = directorUniverseFlagList().unknown0;
    const debug = directorDebugFlagList()?.unknown0 ?? [];
    expect(universe).toHaveLength(UNIVERSE_FLAG_CAP);
    expect(debug).toHaveLength(DEBUG_FLAG_CAP);
    const flags = [...universe, ...debug].map((e) => e.unknown0);
    expect(new Set(flags).size).toBe(flags.length);
    // TOWER_STATE clears the other Tower flags with 1.
    const cleared = towerStateFlagValues()
      .filter((entry) => entry.value === 1)
      .map((entry) => entry.flag);
    expect(
      [...universe, ...debug].every(
        (e) => e.unknown1 === (cleared.includes(e.unknown0) ? 1 : 2)
      )
    ).toBe(true);
    expect(directorServerObjectFlags()).toBe(1);
  });

  it("drops release flags the clock already sets", () => {
    expect(directorForcedFlags(LAUNCH_WEEK).slice(0, 2)).toEqual([250, 252]);
    expect(directorForcedFlags(TDB_WINDOW)).not.toContain(250);
    expect(directorForcedFlags(TDB_WINDOW)[0]).toBe(252);
    const late = directorForcedFlags(AFTER_HOW);
    expect(late).not.toContain(250);
    expect(late).not.toContain(252);
    expect(late).toHaveLength(UNIVERSE_FLAG_CAP + DEBUG_FLAG_CAP);
  });

  it("clears the Tower reveal only with the debug unlock", () => {
    const slots = directorCharacterSlotValues();
    // Slot 38 = flag 115, slot 68 = flag 170, slot 25 = flag 96.
    expect(slots[38]).toBe(DIRECTOR_DEBUG_UNLOCK ? undefined : 2);
    expect(slots[68]).toBe(DIRECTOR_DEBUG_UNLOCK ? undefined : 2);
    expect(slots[109]).toBeUndefined();
  });

  it("encodes the debug list and switch in self character member 16", () => {
    const value = { unknown0: selfCharacter(CHAR) };
    const decoded = decode(
      liveBap().queuez.self.SelfInventory,
      encode(liveBap().queuez.self.SelfInventory, value)
    ).unknown0.unknown16;
    expect(decoded?.unknown5?.unknown0.map((e) => e.unknown0)).toEqual(
      directorDebugFlagList()?.unknown0.map((e) => e.unknown0)
    );
    expect(decoded?.unknown6).toBe(DIRECTOR_DEBUG_UNLOCK ? true : undefined);
  });
});

describeWithPackages("Tower state", () => {
  it("sets the state's flag and clears the other Tower node requirements", () => {
    expect(towerStateFlagValues("queen")).toEqual([
      { flag: 243, value: 1 },
      { flag: 244, value: 2 },
      { flag: 245, value: 1 },
    ]);
    expect(towerStateFlagValues("iron_banner")).toEqual([
      { flag: 243, value: 2 },
      { flag: 244, value: 1 },
      { flag: 245, value: 1 },
    ]);
    expect(
      towerStateFlagValues("default").every((entry) => entry.value === 1)
    ).toBe(true);
  });
});
