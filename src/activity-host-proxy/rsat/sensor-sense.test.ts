import { BitReader, BitWriter } from "@blamnetwork/rsat";
import { describe, expect, it } from "vitest";
import { senseSchema } from "../../content";
import { hasPackages } from "../../test-support/build";
import { liveAh } from "../versions/v41375_14_07_03_1501_live/live-ah";
import { ZERO_AUTH } from "../versions/v41375_14_07_03_1501_live/zero-auth";
import {
  encodeObjectAuth,
  encodePlayerObjectiveAuth,
  encodePlayerTriggerAuth,
  encodeSequenceAuth,
  PlayerObjectiveState,
} from "./sensor-auth-fields";
import {
  peekSensorSenseUpdate,
  playerMonitorCounts,
  squadAliveCounts,
  squadTallies,
} from "./sensor-sense";

// venus_portal_1's first sense update from the client (Xenia capture): the
// u8, then portal_common's 16 player rows.
const FIRST_UPDATE = [
  "803e52443ea6c00260000000e04727716450820000000000000000000000006080000000",
  "00000001f94910fa9b000b80000003811c9dc59142080000000000000000000000018200",
  "00000000000007e52443ea6c00360000000e047277164508200000000000000000000000",
  "0608000000000000001f94910fa9b000f80000003811c9dc591420800000000000000000",
  "0000001820000000000000007e52443ea6c00460000000e0472771645082000000000000",
  "000000000000608000000000000001f94910fa9b001380000003811c9dc5914208000000",
  "000000000000000001820000000000000007e52443ea6c00560000000e04727716450820",
  "00000000000000000000000608000000000000001f94910fa9b001780000003811c9dc59",
  "14208000000000000000000000001820000000000000007e52443ea6c00660000000e047",
  "2771645082000000000000000000000000608000000000000001f94910fa9b001b800000",
  "03811c9dc5914208000000000000000000000001820000000000000007e52443ea6c0076",
  "0000000e0472771645082000000000000000000000000608000000000000001f94910fa9",
  "b001f80000003811c9dc5914208000000000000000000000001820000000000000007e52",
  "443ea6c00860000000e04727716450820000000000000000000000006080000000000000",
  "01f94910fa9b002380000003811c9dc59142080000000000000000000000018200000000",
  "00000007e52443ea6c00960000000e047277164508200000000000000000000000060800",
  "0000000000001f94910fa9b002780000003811c9dc591420800000000000000000000000",
  "18200000000000000040",
].join("");

describe("SensorSenseUpdate", () => {
  it.skipIf(!hasPackages())(
    "walks the player rows of venus_portal_1's first update",
    () => {
      const peek = peekSensorSenseUpdate(
        Buffer.from(FIRST_UPDATE, "hex"),
        (bundle, typeId, index) =>
          senseSchema("venus_portal_1", bundle, typeId, index)
      );
      expect(peek.truncated).toBe(false);
      expect(peek.rows.map((row) => row.typeIndex)).toEqual(
        Array.from({ length: 16 }, (_, i) => 4 + i)
      );
      for (const row of peek.rows) {
        expect(row.bundle).toBe(0xf2_92_21_f5);
        expect(row.typeId).toBe(12);
        expect(row.sense).toBeDefined();
      }
      expect(playerMonitorCounts(peek)).toEqual([]);
    }
  );

  // One squad row behind the u8: present bit, the
  // ref, present bit, the sense body, a 32-bit sequence, then the end bit.
  type SquadSenseValue = Parameters<
    ReturnType<typeof liveAh>["SquadSense"]["encode"]
  >[1];
  // Every optional member absent, as the client leaves what has not
  // changed.
  const IDLE: SquadSenseValue = {
    unknown0: undefined,
    unknown1: undefined,
    unknown2: undefined,
    alive: undefined,
    unknown4: undefined,
    unknown5: 0,
    unknown6: false,
    unknown7: false,
    tally: undefined,
    unknown9: undefined,
  };

  function squadUpdate(sense: Partial<SquadSenseValue>) {
    const bw = new BitWriter(64);
    bw.write(0x80, 8);
    bw.writeBit(0);
    bw.writeBit(0);
    bw.writeBit(1);
    liveAh().SensorClientRef.encode(bw, {
      bundle: 0x06_2d_d9_5d,
      typeId: 1,
      typeIndex: 12,
    });
    bw.writeBit(1);
    liveAh().SquadSense.encode(bw, { ...IDLE, ...sense });
    bw.write(7, 32);
    bw.writeBit(0);
    return peekSensorSenseUpdate(bw.finish(), (bundle, typeId, index) =>
      senseSchema("act_cosmo_m0_highway", bundle, typeId, index)
    );
  }

  // The hangar's sq_m0_fallen_2 as the client reports it: the per-cell
  // death tally with its first sense, [3] only once a member reaches its firing
  // area - never, when it dies on the way in.
  it.skipIf(!hasPackages())(
    "reads a squad row's death tally beside its firing-area count",
    () => {
      const first = squadUpdate({ tally: { cells: [0, 0] } });
      expect(first.truncated).toBe(false);
      expect(squadAliveCounts(first)).toEqual([]);
      expect(squadTallies(first)).toEqual([
        { bundle: 0x06_2d_d9_5d, tally: [0, 0], typeIndex: 12 },
      ]);
      const death = squadUpdate({ alive: 1, tally: { cells: [0, 1] } });
      expect(squadAliveCounts(death)).toEqual([
        { alive: 1, bundle: 0x06_2d_d9_5d, typeIndex: 12 },
      ]);
      expect(squadTallies(death)).toEqual([
        { bundle: 0x06_2d_d9_5d, tally: [0, 1], typeIndex: 12 },
      ]);
    }
  );
});

describe("strike row encoders", () => {
  it("arms a player trigger", () => {
    const body = encodePlayerTriggerAuth(true, 42);
    expect(
      liveAh().PlayerTriggerAuth.decode(new BitReader(body.bytes))
    ).toEqual({
      enabled: true,
      armStamp: 42,
    });
  });

  it("plays a sequence with its variables", () => {
    const body = encodeSequenceAuth({ playingId: 3, startTick: 90 }, [
      { name: 0x11, value: 0x22 },
    ]);
    const auth = liveAh().SequenceAuth.decode(new BitReader(body.bytes));
    expect(auth.startTick).toBe(90);
    expect(auth.playingId).toBe(3);
    expect(auth.variables.pairs).toEqual([{ name: 0x11, value: 0x22 }]);
  });

  it("keeps an object's auth the zero auth's length", () => {
    expect(encodeObjectAuth(1, true).bitCount).toBe(
      ZERO_AUTH[0x80_80_07_d9].bits
    );
  });

  it("sends a player objective's known members, the rest absent", () => {
    const active = encodePlayerObjectiveAuth({
      progress: { max: 4, min: 0 },
      state: PlayerObjectiveState.Active,
    });
    // [0] 1+3, [1] 1+54, [2] 1+1, [3] 1, [4] 1+4, [5] [6] 1+32 each, [7]
    // 1+54, [8] 1, [9] [10] 1+32 each, [11] [12] 1 each.
    expect(active.bitCount).toBe(257);
    const br = new BitReader(active.bytes);
    expect(br.readBit()).toBe(1);
    // The active state is 3 on the wire (bias 1).
    expect(br.readNumber(3)).toBe(4);
  });
});
