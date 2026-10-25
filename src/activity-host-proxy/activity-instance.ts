// Who else is in this activity with you: the players in the same activity, who
// have to appear in each other's class-11 membership. A player's own hosts are
// per-player (PlayerHosts, found through the registry by soid).
//
// The guest finds its own membership slot by comparing its 6-byte machine id
// against every occupied slot and asserts "slot < 20" when it finds none, so a
// second player absent from the membership bug-checks the console. Slots are
// stable for the life of a member: a slot index is baked into PAH peerMask bits
// and marker positions, so it must not be reused under a client that is still
// crossing a load zone.
import type { ActivityPlayer } from "@blamnetwork/bullshcript/destiny1/common";
import { bundleWorlds, scenarioTag } from "../content";
import { scriptDebugger } from "../debug/script-debugger";
import type { AhClientIdentity } from "./join";
import { SensorRowState } from "./mission/row-state";
import type { Teleport } from "./rsat";
import type { ClientEcho } from "./rsat/membership";
import { compiledScripts } from "./script-host/compiled-scripts";
import { ScriptHost } from "./script-host/runtime";

export const MAX_INSTANCE_MEMBERS = 20;

// SensorAuth activity time runs at 30 ticks a second. 0 stalls combatant
// place, so the first tick is 1.
const ACTIVITY_TICK_MS = 1000 / 30;

export function activityTicksSince(startedAt: number, now: number): number {
  return 1 + Math.floor((now - startedAt) / ACTIVITY_TICK_MS);
}

interface InstanceMember {
  // The identity half of the member's own client-authoritative data (class
  // 21), replicated back in its membership slot. The guest adds the simulation
  // player only once the slot carries it.
  clientAuth?: ClientEcho;
  // The member's own teleportation state (class 21), echoed in its slot.
  clientTeleport?: ClientEcho;
  // The member's own transition (class 21, the deltas merged), echoed too.
  clientTransition?: ClientEcho;
  // Private-activity PAH rows (rsat ReplicateMember): the transition has
  // reached phase 3.
  committed?: boolean;
  // The client's own identity, as it joined. The machine bytes are what
  // that console matches on, so they must be its own, never ours.
  readonly identity: AhClientIdentity;
  // Its latest transition token, and the region its last crossing between
  // bubbles left (the same rows).
  lastToken?: number;
  leftBehind?: { regionId: number; token: number };
  // Region the member is crossing into, with the token IT assigned - each
  // client counts its own transition tokens, so one PAH row carries a
  // different marker per slot.
  pendingRegion: { regionId: number; token: number } | undefined;
  readonly slot: number;
  // The member's client has reported player_spawned; the scripts count it
  // ready from then on.
  spawned: boolean;
}

const hexTag = (tag: number | undefined) =>
  tag === undefined ? undefined : (tag >>> 0).toString(16).padStart(8, "0");

// Debugger target ids stay unique across an activity's restarts.
let debugTargetSeq = 0;
const debugTargets = new Map<string, ActivityInstance>();

// The instance a debugger target is.
export function activityInstanceForDebugTarget(
  id: string
): ActivityInstance | undefined {
  return debugTargets.get(id);
}

export class ActivityInstance {
  readonly activityName: string;
  readonly owner: number;
  // The activity's scripts and the rows they drive. Both belong here rather
  // than to a connection or a bubble: the whole script graph runs for as long
  // as the activity does, so walking out of a slice and back must not restart
  // an encounter. The bubble decides what we send, never what runs.
  readonly rowState = new SensorRowState();
  private scriptHost: ScriptHost | undefined;
  private debugTargetId: string | undefined;

  // The script debugger's id for this instance's host, once it has one.
  get debugTarget(): string | undefined {
    return this.debugTargetId;
  }
  private readonly members = new Map<string, InstanceMember>();

  // Mission progression: the running phase's index, kept here rather than on
  // the script host.
  private phase = 0;

  // The activity's clock. One per instance, not per connection: the script host
  // is shared, so every stamp it writes (countdown epoch, Timer and Sequence
  // start, PlayerTrigger arm) is read in whichever world owns the row and
  // compared against that world's own clock.
  private clockStarted: number | undefined;
  readonly clock = { activityTicks: () => this.activityTicks() };
  // When the instance came up, in Unix seconds: the GAS world's server time.
  // It is the activity's own start (2.3.1 capture), the same value in every
  // GAS of the instance, and a new one for the next activity.
  readonly startedAtUnixSeconds = Math.floor(Date.now() / 1000);
  // The teleportation the host is running (membership 80800BF9), if any has
  // started: one per instance, for every member.
  teleport: Teleport | undefined;
  // A debugger teleport holds the phase's own teleports back for as long as
  // that phase runs: the phase it was sent in (fnv1 of its name).
  teleportHeldForPhase: number | undefined;

  constructor(activityName: string, owner: number) {
    this.activityName = activityName;
    this.owner = owner;
  }

  phaseProgress(): { read(): number; write(index: number): void } {
    return {
      read: () => this.phase,
      write: (index: number) => {
        this.phase = index;
      },
    };
  }

  activityTicks(now = Date.now()): number {
    this.clockStarted ??= now;
    return activityTicksSince(this.clockStarted, now);
  }

  // A session hands in the start of the clock it has already sent ticks from
  // and takes back the instance's. The start only ever moves earlier: the
  // client keeps the larger of the old and new activity time, so a world sent
  // less than it has seen freezes, while a jump forward is harmless.
  noteClockStart(startedAt: number): number {
    this.clockStarted = Math.min(this.clockStarted ?? startedAt, startedAt);
    return this.clockStarted;
  }

  // The activity's script host, built once on first use.
  host(): ScriptHost | undefined {
    return this.scriptHost;
  }

  ensureHost(build: () => ScriptHost | undefined): ScriptHost | undefined {
    if (this.scriptHost === undefined) {
      this.scriptHost = build();
      // The script debugger sees every package host (src/debug).
      if (this.scriptHost instanceof ScriptHost) {
        debugTargetSeq += 1;
        this.debugTargetId = `${this.activityName}#${debugTargetSeq}`;
        debugTargets.set(this.debugTargetId, this);
        const worlds = bundleWorlds(this.activityName);
        scriptDebugger.attach(
          this.debugTargetId,
          `${this.activityName} (owner ${this.owner})`,
          this.scriptHost.runtime,
          {
            bundleInfo: (bundle) => worlds.get(bundle >>> 0),
            standInLines: (path) =>
              compiledScripts().scriptByPath(path)?.standInLines,
            meta: {
              activity: this.activityName,
              scenario: hexTag(scenarioTag(this.activityName)),
            },
          }
        );
      }
    }
    return this.scriptHost;
  }

  // Dropped when the activity itself ends, not when a player crosses a
  // bubble or disconnects.
  clearHost(): void {
    this.scriptHost = undefined;
    if (this.debugTargetId !== undefined) {
      debugTargets.delete(this.debugTargetId);
      scriptDebugger.detach(this.debugTargetId);
      this.debugTargetId = undefined;
    }
  }

  // Slot assignment is first free index, and it is kept for as long as the
  // member stays joined.
  join(identity: AhClientIdentity): InstanceMember | undefined {
    const key = memberKey(identity);
    const existing = this.members.get(key);
    if (existing) {
      return existing;
    }
    const slot = this.firstFreeSlot();
    if (slot === undefined) {
      return;
    }
    const member: InstanceMember = {
      identity,
      pendingRegion: undefined,
      slot,
      spawned: false,
    };
    this.members.set(key, member);
    // tower's own sh_player_joined listener: nobody submits this incident
    // from script or client, so the host synthesizes it. A host built after
    // this join (the usual order) misses it.
    if (this.scriptHost instanceof ScriptHost) {
      this.scriptHost.notePlayerJoined(characterKey(identity));
    }
    return member;
  }

  noteSpawned(identity: AhClientIdentity): void {
    const member = this.member(identity);
    if (member) {
      member.spawned = true;
    }
  }

  // The members as c_player_script_utilities counts them. `powerLevel` looks
  // up a character's power level (the player registry).
  players(
    powerLevel: (character: bigint) => number | undefined
  ): ActivityPlayer[] {
    return this.all().map((member) => ({
      characterKey: characterKey(member.identity),
      powerLevel: powerLevel(member.identity.character),
      ready: member.spawned,
    }));
  }

  leave(identity: AhClientIdentity): void {
    this.members.delete(memberKey(identity));
    if (this.scriptHost instanceof ScriptHost) {
      this.scriptHost.notePlayerLeft(characterKey(identity));
    }
  }

  member(identity: AhClientIdentity): InstanceMember | undefined {
    return this.members.get(memberKey(identity));
  }

  // Every joined member, slot order - which is the order the membership
  // slots have to be written in.
  all(): InstanceMember[] {
    return [...this.members.values()].sort((a, b) => a.slot - b.slot);
  }

  get size(): number {
    return this.members.size;
  }

  private firstFreeSlot(): number | undefined {
    const taken = new Set([...this.members.values()].map((m) => m.slot));
    for (let slot = 0; slot < MAX_INSTANCE_MEMBERS; slot++) {
      if (!taken.has(slot)) {
        return slot;
      }
    }
    return;
  }
}

// A console is one machine; the same machine rejoining takes its slot back
// rather than occupying a second one.
function memberKey(identity: AhClientIdentity): string {
  return identity.machine.toString("hex");
}

// ActivityPlayer.characterKey: an opaque identity that round-trips through
// get_character_id()/get_player_sensor() - a u64 character id does not fit
// a double exactly, so this is the hex string, not the bigint itself.
function characterKey(identity: AhClientIdentity): string {
  return identity.character.toString(16);
}

const instances = new Map<string, ActivityInstance>();
const ownerIds = new WeakMap<object, number>();
let nextOwnerId = 0;

function instanceKey(activityName: string, owner: object): string {
  return `${activityName}#${ownerId(owner)}`;
}

function ownerId(owner: object): number {
  let id = ownerIds.get(owner);
  if (id === undefined) {
    id = nextOwnerId++;
    ownerIds.set(owner, id);
  }
  return id;
}

// Every player gets their own instance of an activity, keyed on what owns their
// hosts (their PlayerHosts, shared by their FAH and GAH sockets). Fireteams
// would need a real instance id, which is not decoded: the GAS instanceId we
// send is the AH session id, which is per connection.
export function activityInstanceFor(
  activityName: string,
  owner: object
): ActivityInstance {
  const key = instanceKey(activityName, owner);
  const existing = instances.get(key);
  if (existing) {
    return existing;
  }
  const made = new ActivityInstance(activityName, ownerId(owner));
  instances.set(key, made);
  return made;
}

// The instance if one is live; nothing is made.
export function findActivityInstance(
  activityName: string,
  owner: object
): ActivityInstance | undefined {
  return instances.get(instanceKey(activityName, owner));
}

// Test seam.
export function resetActivityInstances(): void {
  instances.clear();
}

// Ends the instance now: drops it from the map, and with it its script host and
// mission phase. Called only once the last AH session for the activity has
// closed, never on a timer: a load-zone crossing never closes a socket, so what
// remains once every socket has closed is a quit or a full reconnect, which
// cannot be told apart. The next join gets a fresh instance.
export function endActivityInstance(activityName: string, owner: object): void {
  const key = instanceKey(activityName, owner);
  instances.get(key)?.clearHost();
  instances.delete(key);
}
