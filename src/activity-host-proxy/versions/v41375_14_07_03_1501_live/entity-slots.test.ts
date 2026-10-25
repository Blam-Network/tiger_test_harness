import { describe, expect, it } from "vitest";
import { slotBitmap } from "../../rsat/claims";
import { createEntitySlotsWire } from "./entity-slots";

// The handoff as act_cosmo_m0_highway's teleport crosses into 112 (2.3.1
// capture); the schemas have the same layout.
describe("live entity slot handoff bodies", () => {
  const wire = createEntitySlotsWire();

  it("claims an abandon as captured", () => {
    const abandon = Buffer.alloc(1538);
    abandon[0] = 0x03;
    abandon[4] = 0x06;
    abandon[1537] = 0x80;
    const captured = Buffer.alloc(1538);
    captured[0] = 0x01;
    captured[4] = 0x06;
    captured[1537] = 0xa0;
    expect(wire.claim(1, slotBitmap(abandon))).toEqual(captured);
  });

  it("purges a purge request as captured", () => {
    const request = Buffer.alloc(1537);
    request[0] = 0xa0;
    request[4] = 0xc0;
    const captured = Buffer.alloc(1538);
    captured[0] = 0xa0;
    captured[1] = 0x40;
    captured[5] = 0xc0;
    expect(wire.purge(2, request)).toEqual(captured);
  });
});
