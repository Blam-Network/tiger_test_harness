import type { DemonwareBuild } from "../demonware-build";

// The lobby ports the client connects to. The client has no auth3 step, so
// the build states no auth.
const LOBBY_PORTS = [1020, 1011] as const;

export function loadDemonwareBuild(): DemonwareBuild {
  return {
    lobbyPorts: LOBBY_PORTS,
    lobbyProtocol: 200,
    matchMakingService: 21,
  };
}
