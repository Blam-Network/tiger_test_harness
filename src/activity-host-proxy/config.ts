import { BAP_SIGNON_IP } from "../signon/config";

export const ACTIVITY_HOST_PROXY_IP =
  process.env.ACTIVITY_HOST_PROXY_IP ?? BAP_SIGNON_IP;
export const ACTIVITY_HOST_PROXY_PORT = Number(
  process.env.ACTIVITY_HOST_PROXY_PORT ?? 37001
);

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
