import { describe, expect, it, vi } from "vitest";
import {
  playerByAccount,
  playerByCharacter,
  players,
  registerPlayer,
  type SelfFamilyPublisher,
  selfFamilyPublisherFor,
  setPlayerCharacter,
  unregisterPlayer,
} from "./registry";

function publisher(): SelfFamilyPublisher {
  return { dropLoot: vi.fn(), grantXp: vi.fn() };
}

describe("player registry", () => {
  it("keeps one entry per publisher with its own hosts", () => {
    const a = publisher();
    const b = publisher();
    try {
      const pa = registerPlayer(a, 0x11n, 0x100000001n);
      const pb = registerPlayer(b, 0x22n, 0x100000002n);
      expect(players()).toEqual([pa, pb]);
      expect(pa.hosts).not.toBe(pb.hosts);
      expect(playerByAccount(0x100000001n)).toBe(pa);
      expect(playerByAccount(0x100000002n)).toBe(pb);
      expect(playerByAccount(0x100000003n)).toBeUndefined();
      expect(pa.platformId).toBe(0x11n);
    } finally {
      unregisterPlayer(a);
      unregisterPlayer(b);
    }
  });

  it("tracks the signed-in character through switch and signout", () => {
    const a = publisher();
    try {
      registerPlayer(a, 0x11n, 0x100000001n);
      expect(playerByCharacter(0x200000001n)).toBeUndefined();
      setPlayerCharacter(a, 0x200000001n);
      expect(selfFamilyPublisherFor(0x200000001n)).toBe(a);
      setPlayerCharacter(a, 0x200000002n);
      expect(selfFamilyPublisherFor(0x200000001n)).toBeUndefined();
      expect(selfFamilyPublisherFor(0x200000002n)).toBe(a);
      setPlayerCharacter(a, undefined);
      expect(selfFamilyPublisherFor(0x200000002n)).toBeUndefined();
    } finally {
      unregisterPlayer(a);
    }
  });

  it("is a no-op for a publisher that never logged in", () => {
    const a = publisher();
    setPlayerCharacter(a, 0x200000001n);
    expect(playerByCharacter(0x200000001n)).toBeUndefined();
    unregisterPlayer(a);
    expect(players()).toEqual([]);
  });

  it("lets a fresh login win over a lingering socket and survives its stale unregister", () => {
    const stale = publisher();
    const fresh = publisher();
    try {
      registerPlayer(stale, 0x11n, 0x100000001n);
      setPlayerCharacter(stale, 0x200000001n);
      const live = registerPlayer(fresh, 0x11n, 0x100000001n);
      setPlayerCharacter(fresh, 0x200000001n);
      expect(playerByAccount(0x100000001n)).toBe(live);
      expect(selfFamilyPublisherFor(0x200000001n)).toBe(fresh);
      unregisterPlayer(stale);
      expect(playerByAccount(0x100000001n)).toBe(live);
      expect(selfFamilyPublisherFor(0x200000001n)).toBe(fresh);
    } finally {
      unregisterPlayer(stale);
      unregisterPlayer(fresh);
    }
  });

  it("keeps the hosts across a re-login on the same connection", () => {
    const a = publisher();
    try {
      const first = registerPlayer(a, 0x11n, 0x100000001n);
      setPlayerCharacter(a, 0x200000001n);
      const again = registerPlayer(a, 0x11n, 0x100000001n);
      expect(again.hosts).toBe(first.hosts);
      expect(again.characterSoid).toBeUndefined();
      expect(players()).toHaveLength(1);
    } finally {
      unregisterPlayer(a);
    }
  });
});
