import { BitReader } from "@blamnetwork/rsat";
import { expect, it } from "vitest";
import { e_build } from "../../../builds";
import { buildPackagesDir, describeBuild } from "../../../test-support/build";
import { k_empty_name_hash } from "../../../utils/name-hash";
import { defineAhSchemas } from "./ah";

const packages = buildPackagesDir(e_build.v39573_14_04_03_1336_ff);
const ah = defineAhSchemas();

// Devil's Lair's blast (enc_blast_portal1) on this build: the Walker
// (sq_tank__tank, t2#5) rides in seated in skiff_passenger (t37#21).
const BLAST = 0x63_48_63_c2 | 0;
const ACTOR = 2;
const PASSENGER = 37;
const SEAT = { bundle: BLAST, typeId: PASSENGER, typeIndex: 21 };
const WALKER = { bundle: BLAST, typeId: ACTOR, typeIndex: 5 };
const UNSET = { bundle: k_empty_name_hash, typeId: -1, typeIndex: -1 };

async function blastSink() {
  const { bundleTags } = await import("../../../content");
  const { ItemSink } = await import("../../script-host/item-sink");
  return new ItemSink(bundleTags("cosmo_portal_1"), () => {
    // the sink's notes are not under test
  });
}

type Sink = Awaited<ReturnType<typeof blastSink>>;

function seat(sink: Sink) {
  const entry = sink
    .entries()
    .find(
      ({ clientRef: r }) =>
        r.typeId === PASSENGER && r.typeIndex === SEAT.typeIndex
    );
  const value = ah.PassengerAuth.decode(
    new BitReader(entry?.authBody ?? Buffer.alloc(0))
  );
  return {
    binding: { ...value.binding, bundle: value.binding.bundle >>> 0 },
    cookie: value.cookie,
  };
}

describeBuild(e_build.v39573_14_04_03_1336_ff, "39573 blast rows", () => {
  // The 2.3.1 capture: cookie 1 and the Walker with its placement, cookie 2
  // and the unset ref as the skiff arrives.
  it.skipIf(!packages)("seats the Walker and lets it go", async () => {
    const sink = await blastSink();
    sink.apply({
      item: SEAT,
      kind: "passenger",
      state: { passenger: WALKER, state: 1 },
    });
    expect(seat(sink)).toEqual({
      binding: { ...WALKER, bundle: WALKER.bundle >>> 0 },
      cookie: 1,
    });
    sink.apply({ item: SEAT, kind: "passenger", state: { state: 2 } });
    expect(seat(sink)).toEqual({ binding: UNSET, cookie: 2 });
    sink.apply({ item: SEAT, kind: "passenger", state: { state: 0 } });
    expect(seat(sink)).toEqual({ binding: UNSET, cookie: 0 });
  });
});
