import { BAP_SIGNON_IP } from "../signon/config";

export const ACTIVITY_HOST_PROXY_IP =
  process.env.ACTIVITY_HOST_PROXY_IP ?? BAP_SIGNON_IP;
export const ACTIVITY_HOST_PROXY_PORT = Number(
  process.env.ACTIVITY_HOST_PROXY_PORT ?? 37001
);

// TODO: figure out what this should be.
// Maybe a random number, but what's its lifetime?
// Just a unique number for the server instance?
export const FAKE_ACTIVITY_HOST_ID = 1n;
