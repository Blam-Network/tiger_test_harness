import { BitReader } from "@blamnetwork/rsat";
import { expect, it } from "vitest";
import { buildFolder, e_build } from "../builds";
import { describeEachBuild } from "../test-support/build";
import { k_empty_name_hash } from "../utils/name-hash";

// Per build: the PlayerObjective auth's schema id and the words after the
// nav slots (the 39573 adds participants and tier there).
const BUILDS: Partial<Record<e_build, { id: number; tailWords: number }>> = {
  [e_build.v38464_14_02_28_1027_betath]: { id: 0x80_80_23_be, tailWords: 3 },
  [e_build.v39573_14_04_03_1336_ff]: { id: 0x80_80_2a_1b, tailWords: 4 },
};

interface Ref {
  bundle: number;
  typeId: number;
  typeIndex: number;
}

describeEachBuild(
  "an idle PlayerObjective row",
  (build) => {
    const folder = buildFolder(build);
    const { id, tailWords } = BUILDS[build] as {
      id: number;
      tailWords: number;
    };
    let loaded: ReturnType<typeof loadBuild> | undefined;
    const load = () => {
      loaded ??= loadBuild();
      return loaded;
    };
    const loadBuild = async () => {
      const { defineAhSchemas } = await import(`./versions/${folder}/ah.ts`);
      const { createSensorAuth } = await import(
        `./versions/${folder}/sensor-auth.ts`
      );
      const { ZERO_AUTH } = await import(`./versions/${folder}/zero-auth.ts`);
      const ah = defineAhSchemas();
      return { ah, idle: createSensorAuth(ah).idleAuth(id), ZERO_AUTH };
    };

    // Walks a PlayerObjective body and returns its refs in wire order: [1],
    // [7], then each nav slot's [2] and [5].
    function playerObjectiveRefs(
      ah: { SensorClientRef: { decode(br: BitReader): Ref } } & Record<
        string,
        any
      >,
      bytes: Buffer
    ): { bits: number; refs: Ref[] } {
      const br = new BitReader(bytes);
      const refs: Ref[] = [];
      br.readNumber(3);
      refs.push(ah.SensorClientRef.decode(br));
      br.readBit();
      ah.ObjectiveCountdown.decode(br);
      br.readNumber(4);
      br.readNumber(32);
      br.readNumber(32);
      refs.push(ah.SensorClientRef.decode(br));
      for (let slot = 0; slot < 10; slot++) {
        br.readNumber(4);
        br.readNumber(3);
        refs.push(ah.SensorClientRef.decode(br));
        br.readNumber(32);
        for (let i = 0; i < 3; i++) {
          br.readNumber(32);
        }
        refs.push(ah.SensorClientRef.decode(br));
      }
      for (let i = 0; i < tailWords; i++) {
        br.readNumber(32);
      }
      return { bits: br.bitPos, refs };
    }

    it("leaves every ref unset, not type 0", async () => {
      const { ah, idle } = await load();
      if (!idle) {
        throw new Error("no idle PlayerObjective auth");
      }
      const { bits, refs } = playerObjectiveRefs(ah, idle.bytes);
      expect(bits).toBe(idle.bitCount);
      expect(refs).toHaveLength(22);
      for (const ref of refs) {
        expect({ ...ref, bundle: ref.bundle >>> 0 }).toEqual({
          bundle: k_empty_name_hash,
          typeId: -1,
          typeIndex: -1,
        });
      }
    });

    // The all-zero body names type 0 in each nav slot's NavPoint ref, which
    // the client's waypoint update asserts on.
    it("is not the zero auth", async () => {
      const { ah, idle, ZERO_AUTH } = await load();
      const zero = ZERO_AUTH[id];
      if (!zero) {
        throw new Error("no zero PlayerObjective auth");
      }
      const { refs } = playerObjectiveRefs(ah, Buffer.from(zero.hex, "hex"));
      expect(refs[3]?.typeId).toBe(0);
      expect(idle?.bitCount).toBe(zero.bits);
    });
  },
  Object.keys(BUILDS) as e_build[]
);
