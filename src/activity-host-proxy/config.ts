import {
  resolveActivityHostProxyBindIp,
  resolveActivityHostProxyIp,
  resolveActivityHostProxyPort,
} from "../env";
import { BAP_BIND_IP, BAP_SIGNON_IP } from "../signon/config";

// Address handed to the client so it knows where to reach the activity host
// proxy. Behind a relay this is the public address, which this machine does
// not own - so it must not be used to bind (see ACTIVITY_HOST_PROXY_BIND_IP).
export const ACTIVITY_HOST_PROXY_IP = resolveActivityHostProxyIp(BAP_SIGNON_IP);

// Address the listener actually binds. Same advertise/bind split BAP has:
// binding the advertised address fails with EADDRNOTAVAIL the moment the two
// differ, which is every tunnelled or port-forwarded setup.
export const ACTIVITY_HOST_PROXY_BIND_IP =
  resolveActivityHostProxyBindIp(BAP_BIND_IP);
export const ACTIVITY_HOST_PROXY_PORT = resolveActivityHostProxyPort();

export function formatActivityHostTag(id: bigint): string {
  const hi = Number((id >> 32n) & 0xffffffffn)
    .toString(16)
    .padStart(8, "0")
    .toUpperCase();
  const lo = Number(id & 0xffffffffn)
    .toString(16)
    .padStart(8, "0")
    .toUpperCase();
  return `${hi}:${lo}`;
}
