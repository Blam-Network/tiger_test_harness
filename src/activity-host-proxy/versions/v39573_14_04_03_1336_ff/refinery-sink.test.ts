import { BitReader } from "@blamnetwork/rsat";
import { expect, it } from "vitest";
import { e_build } from "../../../builds";
import { buildPackagesDir, describeBuild } from "../../../test-support/build";
import { defineAhSchemas } from "./ah";

const packages = buildPackagesDir(e_build.v39573_14_04_03_1336_ff);
const ah = defineAhSchemas();

// Devil's Lair's refinery (enc_refinery_portal1) on this build: the lasers'
// tripwire kill volumes and the hack's waves.
const REFINERY = 0x4c_63_79_2c | 0;
const SQUAD = 1;
const OBJECTIVE = 3;
const TRIGGER_GROUP = 30;
const TRIGGER_VOLUME = 58;

async function refinerySink() {
  const { bundleTags } = await import("../../../content");
  const { ItemSink } = await import("../../script-host/item-sink");
  return new ItemSink(bundleTags("cosmo_portal_1"), () => {
    // the sink's notes are not under test
  });
}

type Sink = Awaited<ReturnType<typeof refinerySink>>;

function bodyOf(sink: Sink, typeId: number, typeIndex: number) {
  const entry = sink
    .entries()
    .find(
      ({ clientRef: r }) => r.typeId === typeId && r.typeIndex === typeIndex
    );
  return new BitReader(entry?.authBody ?? Buffer.alloc(0));
}

describeBuild(e_build.v39573_14_04_03_1336_ff, "39573 refinery rows", () => {
  // t_kill_volume_tripwire01 watches kill_volume_tripwire01 (t30#51 ->
  // t58#151), as the 2.3.1 capture's t_pit_kill_volume refs pit_kill_volume.
  it.skipIf(!packages)("refs a t_ group's volume", async () => {
    const sink = await refinerySink();
    sink.apply({
      item: { bundle: REFINERY, typeId: TRIGGER_GROUP, typeIndex: 51 },
      kind: "triggerGroup",
      state: { state: 0 },
    });
    const br = bodyOf(sink, TRIGGER_GROUP, 51);
    expect(ah.SensorClientRef.decode(br)).toEqual({
      bundle: REFINERY,
      typeId: TRIGGER_VOLUME,
      typeIndex: 151,
    });
    expect(br.readNumber(2) - 1).toBe(0);
  });

  // The world entry's idle squad already holds generation 1 with no task, so
  // the placement that gives sq_objective_fallen01a its task moves it.
  it.skipIf(!packages)(
    "moves a squad's binding generation with its task",
    async () => {
      const sink = await refinerySink();
      const squad = { bundle: REFINERY, typeId: SQUAD, typeIndex: 13 };
      const objective = {
        bundle: REFINERY,
        typeId: OBJECTIVE,
        typeIndex: 11,
      };
      const auth = () =>
        ah.SquadAuth.decode(bodyOf(sink, SQUAD, squad.typeIndex));
      sink.apply({
        item: squad,
        kind: "squad",
        state: { carried: false, objective, wave: 0 },
      });
      expect(auth().bindingGeneration).toBe(2);
      sink.apply({
        item: squad,
        kind: "squad",
        state: { carried: false, objective, wave: 0 },
      });
      expect(auth().bindingGeneration).toBe(2);
      sink.apply({
        item: squad,
        kind: "squad",
        state: {
          bodies: 5,
          carried: false,
          objective,
          task: 4,
          taskInfluencer: 2,
          wave: 0,
        },
      });
      expect(auth()).toMatchObject({ bindingGeneration: 3, task: 4 });
      sink.apply({
        item: squad,
        kind: "squad",
        state: {
          bodies: 5,
          carried: false,
          objective,
          task: 6,
          taskInfluencer: 2,
          wave: 0,
        },
      });
      expect(auth()).toMatchObject({ bindingGeneration: 4, task: 6 });
    }
  );
});
