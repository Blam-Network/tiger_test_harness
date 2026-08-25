import { describe, expect, it } from "vitest";
import { ActivityHostService, ENTITY_INDEX_MASK_BYTES } from "./activity-host";

describe("ActivityHostService", () => {
  it("mints a non-zero id per instance", () => {
    const a = new ActivityHostService();
    const b = new ActivityHostService();
    expect(a.id).not.toBe(0n);
    expect(b.id).not.toBe(0n);
    expect(a.id).not.toBe(b.id);
  });

  it("grants class 0 once as a 1536-byte full mask", () => {
    const ah = new ActivityHostService(1n);
    const mask = ah.takeFirstEntityIndexGrant();
    expect(mask?.equals(Buffer.alloc(ENTITY_INDEX_MASK_BYTES, 0xff))).toBe(
      true
    );
    expect(ah.takeFirstEntityIndexGrant()).toBeNull();
  });

  it("does not share grant state with another AH", () => {
    const fah = new ActivityHostService(1n);
    const gah = new ActivityHostService(2n);
    expect(fah.takeFirstEntityIndexGrant()).not.toBeNull();
    expect(gah.takeFirstEntityIndexGrant()).not.toBeNull();
  });

  it("re-grants AllocateEntityIndices from the FreeEntityIndices pool", () => {
    const ah = new ActivityHostService(1n);
    expect(ah.takeFirstEntityIndexGrant()).not.toBeNull();

    const freed = Buffer.alloc(ENTITY_INDEX_MASK_BYTES, 0);
    freed.writeUInt32BE(0xfc000000, 28);
    freed.fill(0xff, 32);
    ah.noteEntityIndicesFreed(freed);

    const first = ah.takeAllocateEntityIndexGrant(64);
    expect(first.granted).toBe(64);
    expect(first.source).toBe("free-pool");
    expect(first.grant.length).toBe(ENTITY_INDEX_MASK_BYTES);
    expect(first.grant.equals(Buffer.alloc(ENTITY_INDEX_MASK_BYTES, 0))).toBe(
      false
    );

    const second = ah.takeAllocateEntityIndexGrant(64);
    expect(second.granted).toBe(64);
    expect(second.grant.equals(first.grant)).toBe(false);
  });
});
