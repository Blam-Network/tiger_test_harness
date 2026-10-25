// Solo PUBLIC matchmaking: PAH starts ASSIGN so matchmaking-GS enqueues, and
// after the abort-plane (~10s) flips to REVOKE so the guest can spin up a GAH;
// an immediate revoke while still `disc` assert-crashes once `ctng`. It is armed
// from the FAH join, not only findSessions, because the orbit-MM skip means the
// guest never searches (an empty findSessions is still correct if it does
// fire: no phantom session). One instance per player (PlayerHosts.pah), so one
// player's FAH connect / close does not reset another's timer.
export const PAH_AMBASSADOR_ASSIGN = 1;
export const PAH_AMBASSADOR_REVOKE = 2;
export const PAH_REVOKE_AFTER_SEARCH_MS = 11_000;

export class PahPolicy {
  private pendingAmbassador = PAH_AMBASSADOR_ASSIGN;
  private revokeTimer: ReturnType<typeof setTimeout> | null = null;
  private flushNeeded = false;
  private flushHook: (() => void) | null = null;

  setFlushHook(hook: (() => void) | null): void {
    this.flushHook = hook;
  }

  currentAmbassador(): number {
    return this.pendingAmbassador;
  }

  currentRevokeToken(): number {
    return this.pendingAmbassador === PAH_AMBASSADOR_REVOKE ? 1 : 0;
  }

  takeRevokeFlush(): boolean {
    if (!this.flushNeeded) {
      return false;
    }
    this.flushNeeded = false;
    return true;
  }

  reset(): void {
    if (this.revokeTimer != null) {
      clearTimeout(this.revokeTimer);
      this.revokeTimer = null;
    }
    this.pendingAmbassador = PAH_AMBASSADOR_ASSIGN;
    this.flushNeeded = false;
  }

  // Arm the ASSIGN→REVOKE timer. Call from FAH join (orbit-MM skip) and
  // from findSessions if the guest still searches. Idempotent.
  noteMatchmakingSearch(): boolean {
    if (
      this.pendingAmbassador === PAH_AMBASSADOR_REVOKE ||
      this.revokeTimer != null
    ) {
      return true;
    }
    this.revokeTimer = setTimeout(() => {
      this.revokeTimer = null;
      this.pendingAmbassador = PAH_AMBASSADOR_REVOKE;
      this.flushNeeded = true;
      this.flushHook?.();
    }, PAH_REVOKE_AFTER_SEARCH_MS);
    return true;
  }
}
