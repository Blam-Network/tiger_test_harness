import { ActivityHostMessageType } from "./messages";
import { slotBitmap } from "./rsat";
import { activityHostBuild } from "./versions";

// How long tables wait for the client's purge request after it hands its
// entity slots back, before going out anyway. A safety net: the purge request
// normally follows the claim within about 1.5s.
const PURGE_WAIT_TIMEOUT_MS = 5000;
// A client asks a host to purge only the slots it abandoned there, and which
// host gets the abandon cannot be told in advance: usually the one that owned
// the bubble being left. So an abdicate holds tables only this long for an
// abandon to follow.
const ABANDON_GRACE_MS = 1000;
// A client's abdicate and abandons for one crossing arrive within a few
// ms of each other; the 2.3.1 capture claims what they carried in one message
// about 0.4 s later. The batch settles this long before the claim goes out.
const CLAIM_BATCH_MS = 300;
// And the claim waits for the pending region (the client names it after a
// teleport's abdicate), a second at most.
const CLAIM_PENDING_WAIT_MS = 1000;

// What the entity slot handoff needs of its session.
interface EntitySlotsHost {
  // The client has named the region it is crossing into.
  hasPendingRegion(): boolean;
  // The handoff is over: the world apply that waited for it goes out.
  onHandoffComplete(sessionId: bigint, reason: string): void;
  push(
    sessionId: bigint,
    kind: ActivityHostMessageType,
    body: Buffer,
    label: string
  ): void;
}

// The entity slot handoff at a slice-set swap: the client hands its slots
// back (abdicate, abandon), the host claims them and purges what the client
// asks it to, and table updates wait for that to finish.
export class EntitySlots {
  // Set by the client's abdicate on this socket; consumed by the swap
  // refresh that follows it, which names the bubble being left.
  abdicateSeen = false;
  // Between the client handing its entity slots back (abdicate / abandon) and
  // its purge request, tables and row pushes wait. Order in the 2.3.1 capture:
  // abdicate + abandon -> swap -> claim-abandoned -> the client's class-26
  // purge request -> purge-abandoned together with the dest apply.
  awaitingPurge = false;
  private purgeFallback: NodeJS.Timeout | undefined;
  // Entity-slot handoff epoch for claim (23) / purge (24) at a swap.
  private slotEpoch = 0;
  // Slot bitmaps a client has handed back (abdicate, abandon) by
  // replication domain, claimed together once the batch has settled and
  // the client has named its pending region (handle).
  private readonly pendingClaims = new Map<number, Buffer>();
  private claimBatchTimer: ReturnType<typeof setTimeout> | undefined;
  private deferredClaimTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly host: EntitySlotsHost) {}

  // A client's handoff (the build's entitySlots wire for the formats). The
  // abdicate and the abandons each carry a replication domain and the slots
  // handed back; the 2.3.1 capture claims their union per domain in one message
  // about 0.4 s later, skipping empty bitmaps, and the purge request gets the
  // purge, which closes the handoff. A teleport's client abdicates before it
  // names its target region, so the claim also waits (a second at most) for the
  // pending region the host promotes and puts in the membership.
  handle(
    sessionId: bigint,
    kind: ActivityHostMessageType,
    payload: Buffer
  ): void {
    if (kind === ActivityHostMessageType.RequestPurgeEntitySlots) {
      const { entitySlots } = activityHostBuild();
      if (entitySlots.advancesEpochOnPurge) {
        this.slotEpoch = (this.slotEpoch + 1) & 0xff;
      }
      const epoch = this.slotEpoch;
      const body = entitySlots.purge(epoch, payload);
      this.host.push(
        sessionId,
        ActivityHostMessageType.PurgeAbandonedEntitySlots,
        body,
        `purge-abandoned ${body.length}B epoch=${epoch} for request-purge ` +
          `${payload.length}B`
      );
      this.finishPurgeWait(sessionId, "purge request");
      return;
    }
    if (kind === ActivityHostMessageType.AbdicateAuthority) {
      this.abdicateSeen = true;
      if (!this.awaitingPurge) {
        this.startPurgeWait(sessionId, ABANDON_GRACE_MS, "no abandon");
      }
    } else {
      this.startPurgeWait(sessionId, PURGE_WAIT_TIMEOUT_MS, "timeout");
    }
    const domain = payload[0] ?? 0;
    const bitmap = slotBitmap(payload);
    if (!bitmap.some((byte) => byte !== 0)) {
      return;
    }
    const held = this.pendingClaims.get(domain);
    this.pendingClaims.set(
      domain,
      held
        ? Buffer.from(held.map((byte, i) => byte | (bitmap[i] ?? 0)))
        : bitmap
    );
    this.claimBatchTimer ??= setTimeout(() => {
      this.claimBatchTimer = undefined;
      this.flushClaims(sessionId);
    }, CLAIM_BATCH_MS);
    this.deferredClaimTimer ??= setTimeout(() => {
      this.deferredClaimTimer = undefined;
      this.flushClaims(sessionId, true);
    }, CLAIM_PENDING_WAIT_MS);
  }

  // The claims held for a pending region (handle): one per
  // replication domain, all under one epoch, once the client has named its
  // pending region or the wait is up.
  flushClaims(sessionId: bigint, force = false): void {
    if (
      this.pendingClaims.size === 0 ||
      !(force || this.host.hasPendingRegion())
    ) {
      return;
    }
    if (this.claimBatchTimer) {
      clearTimeout(this.claimBatchTimer);
      this.claimBatchTimer = undefined;
    }
    if (this.deferredClaimTimer) {
      clearTimeout(this.deferredClaimTimer);
      this.deferredClaimTimer = undefined;
    }
    this.slotEpoch = (this.slotEpoch + 1) & 0xff;
    const epoch = this.slotEpoch;
    for (const [domain, bitmap] of this.pendingClaims) {
      const body = activityHostBuild().entitySlots.claim(epoch, bitmap);
      this.host.push(
        sessionId,
        ActivityHostMessageType.ClaimAuthorityOverAbandonedEntitySlots,
        body,
        `claim-abandoned ${body.length}B epoch=${epoch} domain=${domain}`
      );
    }
    this.pendingClaims.clear();
  }

  // An abandon restarts the wait an abdicate began, with the long timeout.
  // That one is a safety net only: a handoff that never completes must not
  // freeze table updates for good.
  private startPurgeWait(
    sessionId: bigint,
    timeoutMs: number,
    reason: string
  ): void {
    this.awaitingPurge = true;
    if (this.purgeFallback) {
      clearTimeout(this.purgeFallback);
    }
    this.purgeFallback = setTimeout(() => {
      this.finishPurgeWait(sessionId, reason);
    }, timeoutMs);
  }

  finishPurgeWait(sessionId: bigint, reason: string): void {
    if (this.purgeFallback) {
      clearTimeout(this.purgeFallback);
      this.purgeFallback = undefined;
    }
    if (!this.awaitingPurge) {
      return;
    }
    this.awaitingPurge = false;
    this.host.onHandoffComplete(sessionId, reason);
  }

  // The connection closed: nothing pending may fire afterwards.
  dispose(): void {
    clearTimeout(this.purgeFallback);
    clearTimeout(this.claimBatchTimer);
    clearTimeout(this.deferredClaimTimer);
    this.purgeFallback = undefined;
    this.claimBatchTimer = undefined;
    this.deferredClaimTimer = undefined;
    this.pendingClaims.clear();
  }
}
