import type { ActivityHostKind, ActivityHostService } from "./activity-host";
import type { EntitySlots } from "./entity-slots";
import type { AhClientIdentity } from "./join";
import type { ActivityHostMessageType } from "./messages";
import type { PlayerHosts } from "./player-hosts";
import type { RegionCrossing } from "./region-crossing";
import type { SessionScriptHost } from "./script-host/session-host";

// What the session's push modules read of their session.
export interface SessionContext {
  // The host this connection is bound to. Not hosts.host(kind): during a
  // public load-zone crossing a player has a current and a pending GAH.
  readonly activityHost: ActivityHostService;
  activityName(): string | undefined;
  activityTicks(): number;
  boundSessionId: bigint | undefined;
  readonly closed: boolean;
  readonly crossing: RegionCrossing;
  readonly entitySlots: EntitySlots;
  readonly hosts: PlayerHosts;
  // This connection is the pending public host (PUBLIC TARGET) of a crossing.
  readonly isPendingTarget: boolean;
  readonly joinIdentity: AhClientIdentity | undefined;
  readonly kind: ActivityHostKind;
  pushAh(
    sessionId: bigint,
    kind: ActivityHostMessageType,
    rsatPayload: Buffer,
    label: string,
    opts?: { keepRows?: boolean }
  ): void;
  // A public host the client has swapped away from: everything it would apply
  // names a world that is being torn down.
  readonly retired: boolean;
  readonly scripts: SessionScriptHost;
  readonly worldEntered: boolean;
}
