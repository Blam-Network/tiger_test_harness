import type { KillFilterDetails } from "@blamnetwork/bullshcript/destiny1/common";
import { type ActivityHostKind, ActivityHostService } from "./activity-host";
import type { IncidentPosition } from "./mission/incident";
import { PahPolicy } from "./pah-policy";
import type { SensorAuthSenseEntry } from "./rsat";
import type { ParsedStartRequest } from "./start-request";

// What a bound AH proxy session offers the other host of the same player:
// the script host lives on the FAH but drives rows that belong to the
// public world, and only the GAH's socket may carry those.
export interface HostSession {
  // A PlayerTrigger incident can arrive on either socket; the script host
  // only exists on the FAH.
  applyCrossing(bubble: number, token?: number, state?: number): void;
  noteClientIncident(nameHash: number): void;
  noteInteraction(carries: (name: number) => boolean): void;
  noteKill(details: KillFilterDetails): void;
  noteLootGathered(carries: (material: number) => boolean): void;
  notePlayerTrigger(bundle: number, typeIndex: number): void;
  noteSquadKill(idents: readonly number[], at?: IncidentPosition): void;
  pushRows(entries: readonly SensorAuthSenseEntry[]): void;
  // Re-send the full tables this host has applied, for when the guest is
  // about to build sensor instances that need a full auth state.
  republishTables(label: string): void;
  // The sensor rows this host's world has in its current bubble, and sending
  // script-written rows to it.
  worldRows(activityName: string): Set<string> | undefined;
}

// One player's activity hosts: the FAH its first AH proxy connection binds,
// the GAH a second connection (PUBLIC start after PAH revoke) binds, the
// start request that named the activity and the PAH ambassador policy.
// Lives on the player registry entry (src/players/registry.ts); an AH proxy
// session finds it through the soids in its manager start request.
export class PlayerHosts {
  readonly fah = new ActivityHostService();
  gah: ActivityHostService | undefined;
  // The public host for the region being entered, while a public load-zone
  // crossing is in flight. The client fills its pending record itself with a
  // full join on a new socket, and routes AH notifications to the first record
  // whose AH id matches, so this host needs an AH id of its own: two records
  // with one id re-grant the local player onto a host whose Player entity
  // already exists. At the slice-set swap the client exchanges its current and
  // pending public records and disconnects the old one, which is where this is
  // promoted.
  pendingGah: ActivityHostService | undefined;
  readonly pah = new PahPolicy();
  private fahBound = false;
  private gahBound = false;
  // Whether this activity has had a public host at all. Before the first
  // GAH the pending PAH row's revoke has to reach the guest so it spins one
  // up; after that, a region being entered always needs a live ambassador,
  // even when no GAH is bound (the client disposed of its last public record
  // at an earlier swap).
  private gahEverBound = false;
  private startRequest: ParsedStartRequest | undefined;
  private readonly sessions = new Map<ActivityHostKind, HostSession>();
  private pendingSession: HostSession | undefined;

  bind(): ActivityHostKind {
    return this.bindHost().kind;
  }

  // Which host a new connection is: the FAH first, then the public host,
  // then - while a public host is already bound - the pending public host of
  // a load-zone crossing.
  bindHost(): { host: ActivityHostService; kind: ActivityHostKind } {
    if (!this.fahBound) {
      this.fahBound = true;
      return { host: this.fah, kind: "FAH" };
    }
    if (!this.gahBound) {
      this.gahBound = true;
      this.gahEverBound = true;
      return { host: this.ensureGah(), kind: "GAH" };
    }
    this.pendingGah = new ActivityHostService();
    return { host: this.pendingGah, kind: "GAH" };
  }

  isGahBound(): boolean {
    return this.gahBound;
  }

  hasHadGah(): boolean {
    return this.gahEverBound;
  }

  setSession(
    kind: ActivityHostKind,
    session: HostSession | undefined,
    host?: ActivityHostService
  ): void {
    if (host !== undefined && host === this.pendingGah) {
      this.pendingSession = session;
      return;
    }
    // A swapped-out host's session going away must not take the current
    // host's session with it: after a promotion "GAH" names the new one.
    if (!session && host !== undefined && this.isRetiredHost(host)) {
      return;
    }
    if (session) {
      this.sessions.set(kind, session);
    } else {
      this.sessions.delete(kind);
    }
  }

  session(kind: ActivityHostKind): HostSession | undefined {
    return this.sessions.get(kind);
  }

  // The slice-set swap has landed: the pending public host is now the one the
  // client calls PUBLIC CURRENT. The old record stays open (as PUBLIC TARGET)
  // until the transition stops and gets the same state refresh as the others,
  // so this happens on the refresh, not on the old socket closing. Idempotent.
  promotePendingGah(): void {
    if (this.pendingGah === undefined) {
      return;
    }
    this.gah = this.pendingGah;
    this.pendingGah = undefined;
    if (this.pendingSession) {
      this.sessions.set("GAH", this.pendingSession);
    }
    this.pendingSession = undefined;
  }

  // A public host that is neither current nor pending: swapped out, waiting
  // for the client to dispose of its record. Nothing it applies can land
  // anywhere but a world being torn down.
  isRetiredHost(host: ActivityHostService): boolean {
    return host !== this.fah && host !== this.gah && host !== this.pendingGah;
  }

  unbind(kind: ActivityHostKind, host?: ActivityHostService): void {
    if (kind === "FAH") {
      this.fah.resetClientGrants();
      this.fahBound = false;
      // Leaving the activity: the next one starts without a public host.
      this.gahEverBound = false;
      return;
    }
    // The pending host's socket closing on its own is an aborted crossing:
    // the client keeps the public host it had.
    if (host !== undefined && host === this.pendingGah) {
      this.pendingGah = undefined;
      this.pendingSession = undefined;
      return;
    }
    // A swapped-out host closing - the client disposing of the old record -
    // changes nothing; the host it was swapped for is already current.
    if (host !== undefined && host !== this.gah) {
      return;
    }
    // The current host closing while a pending one exists is a completed
    // swap whose refresh never reached us.
    if (this.pendingGah !== undefined) {
      this.promotePendingGah();
      return;
    }
    // The client disposed of its public record with nothing to swap to. The
    // next public host it asks for is a new instance and gets a new id, as the
    // real server does; reusing this one would hand the client an AH id for a
    // record it has just thrown away.
    this.gah?.resetClientGrants();
    this.gah = undefined;
    this.gahBound = false;
  }

  ensureGah(): ActivityHostService {
    this.gah ??= new ActivityHostService();
    return this.gah;
  }

  host(kind: ActivityHostKind): ActivityHostService {
    return kind === "GAH" ? this.ensureGah() : this.fah;
  }

  getStartRequest(): ParsedStartRequest | undefined {
    return this.startRequest;
  }

  setStartRequest(start: ParsedStartRequest | undefined): void {
    this.startRequest = start;
  }
}

export interface BoundHosts {
  // The exact host this connection is bound to. `kind` alone cannot name it
  // while a public crossing has a current and a pending GAH at once.
  host: ActivityHostService;
  hosts: PlayerHosts;
  kind: ActivityHostKind;
}

// Hosts for connections whose player cannot be identified (no registered
// player's soid in the start request stream). Process-wide, so such connections
// share state.
export const anonymousHosts = new PlayerHosts();
