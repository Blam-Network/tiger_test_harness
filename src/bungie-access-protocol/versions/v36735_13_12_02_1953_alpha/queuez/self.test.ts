import { decode, encode } from "@blamnetwork/rsat";
import { beforeAll, expect, it } from "vitest";
import { e_build } from "../../../../builds";
import { describeBuild } from "../../../../test-support/build";
import type { AlphaBapBuild } from "..";

const emptySlot = {
  unknown0: undefined,
  unknown1: undefined,
  unknown2: undefined,
  unknown3: undefined,
  unknown4: undefined,
};

describeBuild(
  e_build.v36735_13_12_02_1953_alpha,
  "alpha self family schemas",
  () => {
    let self: AlphaBapBuild["queuez"]["self"];
    beforeAll(async () => {
      const { alphaBap } = await import("../alpha-bap");
      self = alphaBap().queuez.self;
    });

    it("round-trips a loot slot (8080195F) with a fresh drop", () => {
      const value = {
        unknown0: 497,
        unknown1: 1,
        unknown2: 3,
        unknown3: {
          unknown0: { unknown0: 0x34_fd, unknown1: 0x2_00_00_00_01n },
          unknown1: 0,
        },
        unknown4: undefined,
      };
      const decoded = decode(
        self.Unknown8080195F,
        encode(self.Unknown8080195F, value)
      );
      expect(decoded).toEqual(value);
    });

    it("round-trips an empty loot slot (all fields absent)", () => {
      const decoded = decode(
        self.Unknown8080195F,
        encode(self.Unknown8080195F, emptySlot)
      );
      expect(decoded).toEqual(emptySlot);
    });

    it("round-trips the 64-slot loot table (80801966) with one active slot", () => {
      const slots = Array.from({ length: 64 }, () => ({ ...emptySlot }));
      slots[5] = { ...emptySlot, unknown0: -1 as never };
      const decoded = decode(
        self.Unknown80801966,
        encode(self.Unknown80801966, {
          unknown0: undefined,
          unknown1: { unknown0: slots },
          unknown2: undefined,
        })
      );
      expect(decoded.unknown1?.unknown0[5]?.unknown0).toBe(-1);
      expect(decoded.unknown1?.unknown0[0]?.unknown0).toBeUndefined();
    });

    // The item's stat block (808018F2) is a 2-bit count and up to two 8-byte
    // {key, value} slots (80801890, the client's own .schmr).
    it("round-trips the key/value slots through the biased index/value fields", () => {
      const value = {
        unknown0: {
          unknown0: [
            { unknown0: 0, unknown1: 10 },
            { unknown0: -1, unknown1: 0 },
          ],
        },
        unknown1: 110,
      };
      expect(
        decode(self.Unknown808018F2, encode(self.Unknown808018F2, value))
      ).toEqual(value);
    });

    it("round-trips a negative-biased value (below the wire's unsigned zero)", () => {
      const value = {
        unknown0: { unknown0: [{ unknown0: -1, unknown1: -5 }] },
        unknown1: -1,
      };
      expect(
        decode(self.Unknown808018F2, encode(self.Unknown808018F2, value))
      ).toEqual(value);
    });

    it("InventoryItem.unknown3 carries the stat block", () => {
      const value = {
        soid: 1n,
        defIndex: 434,
        unknown2: undefined,
        unknown3: { unknown0: undefined, unknown1: 110 },
        unknown4: undefined,
      };
      expect(
        decode(self.InventoryItem, encode(self.InventoryItem, value)).unknown3
          ?.unknown1
      ).toBe(110);
    });
  }
);
