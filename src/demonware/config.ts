import {
  resolveDemonwareBindHost,
  resolveDemonwareLobbyPortList,
} from "../env";
import { demonwareBuild } from "./versions";

// Listen ports from DEMONWARE_LOBBY_PORT (one) or DEMONWARE_LOBBY_PORTS
// (a list, 1020,1011); unset gives the build's lobbyPorts.
export function resolveDemonwareLobbyPorts(): number[] {
  return resolveDemonwareLobbyPortList(demonwareBuild().lobbyPorts);
}

export const DEMONWARE_BIND_HOST = resolveDemonwareBindHost();
