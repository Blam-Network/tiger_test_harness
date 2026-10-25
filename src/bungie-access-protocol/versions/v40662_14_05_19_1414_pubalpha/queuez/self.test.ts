import { decode, encode, type rsat } from "@blamnetwork/rsat";
import { describe, expect, it } from "vitest";
import { defineSelfSchemas } from "./self";

const { SelfCharacter, Unknown80801701, Unknown80801829 } = defineSelfSchemas();

const emptySlot: rsat.Infer<typeof Unknown80801829> = {
  unknown0: undefined,
  unknown1: undefined,
  unknown2: undefined,
  unknown3: undefined,
  unknown4: undefined,
};

describe("loot table schemas", () => {
  it("round-trips a loot slot (80801829) with a fresh drop", () => {
    const value = {
      unknown0: 497,
      unknown1: 1,
      unknown2: 3,
      unknown3: {
        unknown0: { unknown0: 0x34_fd, unknown1: 0x00_00_00_02_00_00_00_01n },
        unknown1: 0,
      },
      unknown4: undefined,
    };
    const decoded = decode(Unknown80801829, encode(Unknown80801829, value));
    expect(decoded.unknown0).toBe(497);
    expect(decoded.unknown1).toBe(1);
    expect(decoded.unknown2).toBe(3);
    expect(decoded.unknown3?.unknown0.unknown0).toBe(0x34_fd);
    expect(decoded.unknown3?.unknown0.unknown1).toBe(
      0x00_00_00_02_00_00_00_01n
    );
    expect(decoded.unknown4).toBeUndefined();
  });

  it("round-trips an empty loot slot (all fields absent)", () => {
    const decoded = decode(Unknown80801829, encode(Unknown80801829, emptySlot));
    expect(decoded).toEqual(emptySlot);
  });

  it("round-trips the loot member (80801701) with one active slot", () => {
    const slots = Array.from({ length: 64 }, () => ({ ...emptySlot }));
    slots[5] = { ...emptySlot, unknown0: -1 };
    const value = {
      unknown0: undefined,
      unknown1: { unknown0: slots },
      unknown2: undefined,
      unknown3: undefined,
    };
    const decoded = decode(Unknown80801701, encode(Unknown80801701, value));
    expect(decoded.unknown1?.unknown0[5]?.unknown0).toBe(-1);
    expect(decoded.unknown1?.unknown0[0]?.unknown0).toBeUndefined();
  });

  it("SelfCharacter.unknown9 absent re-encodes to the same bytes", () => {
    // An absent nested schema is a single 0 presence bit, so a character
    // with no loot activity re-encodes byte for byte.
    const empty = {
      soid: undefined,
      unknown1: undefined,
      unknown2: undefined,
      unknown3: undefined,
      unknown4: undefined,
      unknown5: undefined,
      unknown6: undefined,
      unknown7: undefined,
      unknown8: undefined,
      unknown9: undefined,
      unknown10: undefined,
      unknown11: undefined,
      unknown12: undefined,
      unknown13: undefined,
      unknown14: undefined,
      unknown15: undefined,
      unknown16: undefined,
      unknown17: undefined,
      unknown18: undefined,
    };
    const decoded = decode(SelfCharacter, encode(SelfCharacter, empty));
    expect(decoded.unknown9).toBeUndefined();
    expect(decoded).toEqual(empty);
  });
});
