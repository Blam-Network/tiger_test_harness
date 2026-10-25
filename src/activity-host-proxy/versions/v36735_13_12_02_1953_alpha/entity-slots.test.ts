import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { e_build } from "../../../builds";
import { describeBuild } from "../../../test-support/build";
import type { ActivityHostMessageType } from "../../messages";

// The 16 -> 8 crossing of the 2026-10-19 console log: bubble 16's abdicate
// and an abandon of 14 slots, then the client's purge request for the same 14.
const SLOTS = Buffer.alloc(1536);
SLOTS[2] = 0xff;
SLOTS[3] = 0xfc;
const withDomain = (domain: number) =>
  Buffer.concat([Buffer.from([domain]), SLOTS]);

describeBuild(
  e_build.v36735_13_12_02_1953_alpha,
  "alpha entity slot handoff",
  () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("claims and purges as 1537 bytes: u8 epoch, then the bitmap", async () => {
      const { activityHostBuild } = await import("..");
      const { entitySlots } = activityHostBuild();
      const claim = entitySlots.claim(1, SLOTS);
      expect(claim.length).toBe(1537);
      expect(claim[0]).toBe(1);
      expect(claim.subarray(1)).toEqual(SLOTS);
      const purge = entitySlots.purge(1, SLOTS);
      expect(purge.length).toBe(1537);
      expect(purge[0]).toBe(1);
      expect(purge.subarray(1)).toEqual(SLOTS);
    });

    it("purges under the epoch of the claim before it", async () => {
      const { EntitySlots } = await import("../../entity-slots");
      const { ActivityHostMessageType: Kind } = await import("../../messages");
      const pushed: { body: Buffer; kind: ActivityHostMessageType }[] = [];
      const slots = new EntitySlots({
        hasPendingRegion: () => true,
        onHandoffComplete: () => undefined,
        push: (_session, kind, body) => pushed.push({ body, kind }),
      });
      slots.handle(1n, Kind.AbdicateAuthority, withDomain(16));
      slots.handle(1n, Kind.AbandonEntitySlots, withDomain(16));
      vi.advanceTimersByTime(500);
      slots.handle(1n, Kind.RequestPurgeEntitySlots, SLOTS);
      slots.dispose();
      expect(pushed.map((p) => p.kind)).toEqual([
        Kind.ClaimAuthorityOverAbandonedEntitySlots,
        Kind.PurgeAbandonedEntitySlots,
      ]);
      const [claim, purge] = pushed.map((p) => p.body);
      expect(claim.length).toBe(1537);
      expect(claim[0]).toBe(1);
      expect(claim.subarray(1)).toEqual(SLOTS);
      expect(purge.length).toBe(1537);
      expect(purge[0]).toBe(1);
      expect(purge.subarray(1)).toEqual(SLOTS);
    });
  }
);
