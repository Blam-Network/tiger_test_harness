import { c } from "@craftycodie/cstruct";
import { cstructIPv4 } from "../lib/cstruct";

/** 8-byte request: activity-host id the client wants resolved. */
const GetActivityHostProxyRequest = c.struct({
  activityHostId: c.u64(),
});

/** 16-byte response. Client decoder (sub_82B7EA80) copies this verbatim. */
const GetActivityHostProxyResponse = c.struct({
  activityHostId: c.u64(),
  ipv4: cstructIPv4({ padAfter: 2 }),
  port: c.u16(),
});

export function parseGetActivityHostProxyRequest(body: Buffer): bigint | null {
  if (body.length < 8) {
    return null;
  }
  return c.read(GetActivityHostProxyRequest, body, "big").activityHostId;
}

export function buildGetActivityHostProxyResponse(
  activityHostId: bigint,
  ip: string,
  port: number
): Buffer {
  return c.write(
    GetActivityHostProxyResponse,
    {
      activityHostId,
      ipv4: ip,
      port,
    },
    "big"
  );
}
