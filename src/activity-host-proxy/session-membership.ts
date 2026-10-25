import { event_message, event_warning } from "@blamnetwork/datamine";
import { activityPrivate } from "../content";
import { selfFamilyPublisherFor } from "../players/registry";
import { activityInstanceFor, endActivityInstance } from "./activity-instance";
import { ActivityHostMessageType } from "./messages";
import { PAH_AMBASSADOR_ASSIGN } from "./pah-policy";
import {
  buildReplicateMembershipRsat,
  type ReplicateMember,
  unpackBubbleStateHandle,
} from "./rsat";
import { scenarioClient } from "./scenario-client";
import type { SessionContext } from "./session-context";

// The session's ReplicateMembership pushes and its place in the activity
// instance's roster.
export class MembershipPushes {
  private pushes = 0;
  private generation = 0;

  constructor(private readonly session: SessionContext) {}

  get pushCount(): number {
    return this.pushes;
  }

  push(sessionId: bigint, force = false): void {
    const { crossing, hosts, joinIdentity, kind } = this.session;
    if (this.session.retired) {
      return;
    }
    if (!joinIdentity || (!force && this.pushes >= 1)) {
      return;
    }
    this.pushes += 1;
    this.session.boundSessionId = sessionId;
    const generation = ++this.generation;
    const activityName = this.session.activityName();
    const scenario = activityName ? scenarioClient(activityName) : undefined;
    const bubbleCount = scenario?.bubbleCount ?? 1;
    // The CURRENT row names the region the player is in, or the guest clears
    // its cached current region after every swap; before the client reports a
    // bubble it is the scenario's start. A GAH keeps ASSIGN so its table does
    // not replay the FAH's revoke, and so does an all-private activity (the
    // revoke only spins up a public host, which it has no region for).
    const privateActivity = activityPrivate(activityName);
    // currentSlice moves to a crossing's destination as it opens, but the
    // current row stays the region the client is in until the world entry.
    const held =
      privateActivity && crossing.regionBeforeCrossing !== undefined
        ? unpackBubbleStateHandle(crossing.regionBeforeCrossing)
        : undefined;
    const pahBubble =
      held?.bubble ?? crossing.currentSlice ?? scenario?.initialBubble ?? 0;
    const pahState = held?.state ?? crossing.currentBubbleState;
    const ambassadorOpcode =
      kind === "GAH" || privateActivity
        ? PAH_AMBASSADOR_ASSIGN
        : hosts.pah.currentAmbassador();
    // A private activity's rows carry 1 beside ASSIGN, at the join and at
    // every crossing.
    let ambassadorRevokeToken = hosts.pah.currentRevokeToken();
    if (kind === "GAH") {
      ambassadorRevokeToken = 0;
    } else if (privateActivity) {
      ambassadorRevokeToken = 1;
    }
    // The pending row stays ASSIGN once a GAH has existed, and during a host
    // teleport (a state change inside a private bubble, where REVOKE would
    // send the client matchmaking for a public host that never comes). The
    // revoke only makes the guest spin a public host up and never flips back:
    // mirrored onto the pending row it says the region being crossed into has
    // no ambassador, and the citizen-join task never starts.
    const teleporting =
      activityName !== undefined &&
      (activityInstanceFor(activityName, hosts).teleport?.state ?? 0) > 0;
    const pendingAmbassadorOpcode =
      hosts.hasHadGah() || teleporting
        ? PAH_AMBASSADOR_ASSIGN
        : ambassadorOpcode;
    // Everyone in the activity, not just us: a console that finds no occupied
    // slot with its machine id bug-checks on "slot < 20".
    const members = this.members(activityName);
    const mem = buildReplicateMembershipRsat(members, {
      ambassadorOpcode,
      ambassadorRevokeToken,
      bubbleCount,
      privateActivity,
      emptyBubbles: scenario?.emptyBubbles,
      generation,
      initialBubble: pahBubble,
      initialState: pahState,
      pendingAmbassadorOpcode,
      hardWipe: this.session.scripts.hardWipe.host,
      teleport: activityName
        ? activityInstanceFor(activityName, hosts).teleport
        : undefined,
    });
    const machine = joinIdentity.machine.toString("hex");
    this.session.pushAh(
      sessionId,
      ActivityHostMessageType.ReplicateMembership,
      mem,
      `membership ${mem.length}B gen=${generation} slots=${members.length} ` +
        `machine=${machine} ` +
        `pah bubbles=${bubbleCount} pahBubble=${pahBubble} ` +
        `slice=${crossing.currentSlice ?? "none"} ` +
        `amb=${ambassadorOpcode}/${pendingAmbassadorOpcode} ` +
        `revTok=${ambassadorRevokeToken} tokens=1..8` +
        (crossing.pendingRegion
          ? ` pending=${crossing.pendingRegion.regionId} token=${crossing.pendingRegion.token}`
          : "") +
        (privateActivity
          ? ` phase=${crossing.transitionPhase ?? "-"}` +
            (crossing.leftBehindRegion
              ? ` left=${crossing.leftBehindRegion.regionId}`
              : "")
          : "")
    );
  }

  // Takes a membership slot in the activity we joined once we know who we
  // are. The slot is stable while we stay joined: it is baked into PAH
  // peerMask bits and marker positions, so it must not move under a peer that
  // is still crossing.
  join(): void {
    const { hosts, joinIdentity, kind } = this.session;
    const activityName = this.session.activityName();
    if (!(activityName && joinIdentity)) {
      return;
    }
    const member = activityInstanceFor(activityName, hosts).join(joinIdentity);
    if (member) {
      event_message(
        "activities:host: %s joined %s slot %d machine=%s",
        kind,
        activityName,
        member.slot,
        joinIdentity.machine.toString("hex")
      );
      // The character's BAP session names the activity in progress: the
      // client's reward tracker snapshots the progressions on it, and the
      // completion push later only flips the finished flag.
      const activityId = hosts.getStartRequest()?.activityId;
      if (activityId !== undefined) {
        selfFamilyPublisherFor(joinIdentity.character)?.enterActivity?.(
          activityId
        );
      }
      return;
    }
    // 20 slots is the guest's own limit; a 21st would fail its slot walk.
    event_warning(
      "activities:host: %s is full, %s gets no membership slot",
      activityName,
      joinIdentity.machine.toString("hex")
    );
  }

  // Our client reported player_spawned: the scripts count us ready.
  noteSpawned(): void {
    const activityName = this.session.activityName();
    const { hosts, joinIdentity } = this.session;
    if (activityName && joinIdentity) {
      activityInstanceFor(activityName, hosts).noteSpawned(joinIdentity);
    }
  }

  leave(): void {
    const { hosts, joinIdentity, kind } = this.session;
    const activityName = this.session.activityName();
    if (!(activityName && joinIdentity)) {
      return;
    }
    // A player's FAH and GAH are two sockets for one membership slot (join()
    // keys on the machine, not the connection). Whichever closes first must
    // not drop them from the roster, or a peer mid-crossing loses a slot it
    // still relies on, so check the sibling session first.
    const siblingKind = kind === "FAH" ? "GAH" : "FAH";
    if (hosts.session(siblingKind)) {
      return;
    }
    const instance = activityInstanceFor(activityName, hosts);
    instance.leave(joinIdentity);
    if (instance.size === 0) {
      endActivityInstance(activityName, hosts);
    }
  }

  // The activity roster as this session sees it, with our own pending region
  // kept current. A member we never saw join is not invented here: the
  // instance is the only source.
  private members(activityName: string | undefined): ReplicateMember[] {
    const { crossing, hosts, joinIdentity } = this.session;
    if (!(activityName && joinIdentity)) {
      return [];
    }
    const instance = activityInstanceFor(activityName, hosts);
    const self = instance.member(joinIdentity);
    // A pending public host (PUBLIC TARGET) never gets its own class 21, so
    // its pendingRegion is always undefined: its membership push must not
    // clobber the PAH row the socket tracking the crossing already wrote onto
    // the shared member record.
    if (
      self &&
      (crossing.pendingRegion !== undefined || !this.session.isPendingTarget)
    ) {
      self.pendingRegion = crossing.pendingRegion;
    }
    if (self && activityPrivate(activityName)) {
      // A private activity's rows: the pending row's flag turns on at the
      // client's phase 3, the region it left keeps a row, and every row's
      // marker is its latest token.
      self.committed = (crossing.transitionPhase ?? 0) >= 3;
      self.leftBehind = crossing.leftBehindRegion;
      self.lastToken = crossing.lastTransitionToken;
    }
    const members = instance.all();
    if (members.length > 0) {
      return members;
    }
    // Before the join is recorded (the very first membership push), describe
    // ourselves in slot 0 so the shape is never empty.
    return [
      {
        identity: joinIdentity,
        pendingRegion: crossing.pendingRegion,
        slot: 0,
      },
    ];
  }
}
