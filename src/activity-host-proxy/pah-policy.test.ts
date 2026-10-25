import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PAH_AMBASSADOR_ASSIGN,
  PAH_AMBASSADOR_REVOKE,
  PAH_REVOKE_AFTER_SEARCH_MS,
  PahPolicy,
} from "./pah-policy";

describe("PahPolicy", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("flips ASSIGN to REVOKE after the abort-plane and flushes once", () => {
    const pah = new PahPolicy();
    const flush = vi.fn();
    pah.setFlushHook(flush);
    expect(pah.currentAmbassador()).toBe(PAH_AMBASSADOR_ASSIGN);
    expect(pah.currentRevokeToken()).toBe(0);
    expect(pah.noteMatchmakingSearch()).toBe(true);
    // Re-arming is idempotent.
    pah.noteMatchmakingSearch();
    vi.advanceTimersByTime(PAH_REVOKE_AFTER_SEARCH_MS);
    expect(pah.currentAmbassador()).toBe(PAH_AMBASSADOR_REVOKE);
    expect(pah.currentRevokeToken()).toBe(1);
    expect(flush).toHaveBeenCalledTimes(1);
    expect(pah.takeRevokeFlush()).toBe(true);
    expect(pah.takeRevokeFlush()).toBe(false);
  });

  it("reset clears the timer and returns to ASSIGN", () => {
    const pah = new PahPolicy();
    pah.noteMatchmakingSearch();
    pah.reset();
    vi.advanceTimersByTime(PAH_REVOKE_AFTER_SEARCH_MS);
    expect(pah.currentAmbassador()).toBe(PAH_AMBASSADOR_ASSIGN);
    expect(pah.takeRevokeFlush()).toBe(false);
  });

  it("keeps two players' timers independent", () => {
    const a = new PahPolicy();
    const b = new PahPolicy();
    a.noteMatchmakingSearch();
    vi.advanceTimersByTime(PAH_REVOKE_AFTER_SEARCH_MS / 2);
    b.noteMatchmakingSearch();
    // A second player's FAH connect resets only its own policy.
    b.reset();
    b.noteMatchmakingSearch();
    vi.advanceTimersByTime(PAH_REVOKE_AFTER_SEARCH_MS / 2);
    expect(a.currentAmbassador()).toBe(PAH_AMBASSADOR_REVOKE);
    expect(b.currentAmbassador()).toBe(PAH_AMBASSADOR_ASSIGN);
    vi.advanceTimersByTime(PAH_REVOKE_AFTER_SEARCH_MS / 2);
    expect(b.currentAmbassador()).toBe(PAH_AMBASSADOR_REVOKE);
  });
});
