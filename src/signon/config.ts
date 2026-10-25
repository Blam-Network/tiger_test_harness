import {
  resolveBapBindIp,
  resolveBapSignonIp,
  resolveBapSignonPort,
  resolveContentManifestUrl,
} from "../env";

// The address signon hands the client as the BAP endpoint. Loopback is right
// for Xenia (its hosts.json points the game at 127.0.0.1); a real console has
// to be told the server's LAN address instead, so set BAP_SIGNON_IP.
export const BAP_SIGNON_IP = resolveBapSignonIp();

// What the BAP listener binds. Every interface by default, so a console on
// the LAN and Xenia on loopback both reach it - advertising an address and
// binding one are different questions.
export const BAP_BIND_IP = resolveBapBindIp();
export const BAP_SIGNON_PORT = resolveBapSignonPort();

// Signon ticket session keys (fields 2/3). BAP secure-hello AES/HMAC must use
// the same values.
export const BAP_SESSION_KEY_AES = Buffer.alloc(16, 0);
export const BAP_SESSION_KEY_HMAC = Buffer.alloc(16, 0);
export const BAP_SECURITY_TOKEN = Buffer.from("bnet-signon-token", "utf8");

// Bootflow:content_check GETs this URL (Engine Configuration 1.2) and
// registers the packages the manifest lists, through XHttp: a signon hostname
// brings it back here on 443. Empty = no Engine Configuration is sent.
export const CONTENT_MANIFEST_URL = resolveContentManifestUrl();
