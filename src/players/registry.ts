import { PlayerHosts } from "../activity-host-proxy/player-hosts";

// Process-wide registry of signed-in players. One entry per BAP session
// that completed login_account; the entry carries the character it signed
// in with (login_character) and the activity hosts its AH proxy
// connections bind. The two proxies never hold a reference to each other:
// the AH side finds a player by the soids in its manager start request,
// loot drops find the BAP session by character soid.
export interface SelfFamilyPublisher {
  // The signed-in character's name and level, for the debugger's player
  // list. Undefined with no character signed in.
  characterSummary?(): { level: number; name: string } | undefined;
  // The activity host saw this character's activity (index) complete:
  // record it, and let the client chain to the activity's next one.
  completeActivity?(activityIndex: number): void;
  // Roll, record and push a loot drop for a kill incident this character's
  // client reported. `value` is the combatant's reward row value, which
  // sizes the drop chance (investment/loot.ts's dropChanceForValue).
  dropLoot(incidentNumber: number, submitterSoid: bigint, value: number): void;
  // The character joined an activity host for this activity: the self
  // character names it as the one in progress, as the real server's does right after
  // the join.
  enterActivity?(activityIndex: number): void;
  // Add points to progression 0, the one-time reward a kill earns toward in
  // a build that has it (BapBuild.progressionZero).
  grantProgressionZero?(amount: number, reason: string): void;
  // Add XP to the level progression and push the delta that makes the client
  // show the XP toast, and a level-up when the level moves.
  grantXp(amount: number, reason: string): void;
  // The signed-in character's power level as its client computes it, read
  // live (gear changes it). Undefined with no character signed in.
  powerLevel?(): number | undefined;
}

export interface PlayerSession {
  accountSoid: bigint;
  characterSoid?: bigint;
  hosts: PlayerHosts;
  platformId: bigint;
  publisher: SelfFamilyPublisher;
}

// Keyed by publisher (the BAP session) so a stale disconnect can only ever
// drop its own entry. Re-registration moves the entry to the end; lookups
// take the newest match, so a fresh login wins over a lingering socket for
// the same account.
const registry = new Map<SelfFamilyPublisher, PlayerSession>();

export function registerPlayer(
  publisher: SelfFamilyPublisher,
  platformId: bigint,
  accountSoid: bigint
): PlayerSession {
  const existing = registry.get(publisher);
  registry.delete(publisher);
  const session: PlayerSession = {
    platformId,
    accountSoid,
    characterSoid: undefined,
    publisher,
    hosts: existing?.hosts ?? new PlayerHosts(),
  };
  registry.set(publisher, session);
  return session;
}

// login_character / signout / delete of the signed-in character. No-op
// for a publisher that never completed login_account.
export function setPlayerCharacter(
  publisher: SelfFamilyPublisher,
  characterSoid: bigint | undefined
): void {
  const session = registry.get(publisher);
  if (session) {
    session.characterSoid = characterSoid;
  }
}

export function unregisterPlayer(publisher: SelfFamilyPublisher): void {
  registry.delete(publisher);
}

export function players(): PlayerSession[] {
  return [...registry.values()];
}

function newest(
  match: (session: PlayerSession) => boolean
): PlayerSession | undefined {
  let found: PlayerSession | undefined;
  for (const session of registry.values()) {
    if (match(session)) {
      found = session;
    }
  }
  return found;
}

export function playerByAccount(
  accountSoid: bigint
): PlayerSession | undefined {
  return newest((s) => s.accountSoid === accountSoid);
}

export function playerByCharacter(
  characterSoid: bigint
): PlayerSession | undefined {
  return newest((s) => s.characterSoid === characterSoid);
}

// A signed-in character's power level, from its BAP session.
export function powerLevelOf(characterSoid: bigint): number | undefined {
  return playerByCharacter(characterSoid)?.publisher.powerLevel?.();
}

export function selfFamilyPublisherFor(
  characterSoid: bigint
): SelfFamilyPublisher | undefined {
  return playerByCharacter(characterSoid)?.publisher;
}
