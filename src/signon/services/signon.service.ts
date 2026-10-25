// Answers the client's nanopb signon request with the success ticket.

import {
  event_error,
  event_message,
  event_warning,
} from "@blamnetwork/datamine";
import { Injectable } from "@nestjs/common";
import { activeBuild, clientBuildMatches } from "../../builds";
import {
  BAP_SECURITY_TOKEN,
  BAP_SESSION_KEY_AES,
  BAP_SESSION_KEY_HMAC,
  BAP_SIGNON_IP,
  BAP_SIGNON_PORT,
  CONTENT_MANIFEST_URL,
} from "../config";
import { type SignonRequest, signonBuild } from "../versions";

@Injectable()
export class SignonService {
  private loggedMatch = false;

  parseSignonRequest(body: Buffer): SignonRequest | undefined {
    if (body.length === 0) {
      event_warning("signon: Signon request has empty body");
      return;
    }

    try {
      return signonBuild().decodeRequest(body);
    } catch (error) {
      event_error(
        "signon: Failed to decode SignonRequest: %s",
        error instanceof Error ? error.message : String(error)
      );
      return;
    }
  }

  // Whether to serve a client that reports this build. A client that does
  // not say is served; one on another build is refused.
  acceptsClientBuild(reported: string | undefined): boolean {
    const result = clientBuildMatches(reported);
    if (result === "missing") {
      event_warning("signon: Signon request does not say which build it is");
      return true;
    }
    if (result === "mismatch") {
      event_error(
        "signon: Signon from build %s, this server serves %s",
        reported,
        activeBuild()
      );
      return false;
    }
    if (!this.loggedMatch) {
      this.loggedMatch = true;
      event_message("signon: Signon client build %s matches", reported);
    }
    return true;
  }

  buildSuccessSignonResponse(opts?: {
    bapIp?: string;
    bapPort?: number;
  }): Buffer {
    const bapIp = opts?.bapIp ?? BAP_SIGNON_IP;
    const bapPort = opts?.bapPort ?? BAP_SIGNON_PORT;

    return signonBuild().encodeSuccessResponse(
      {
        id: new Uint8Array(16),
        sessionKeyAes: BAP_SESSION_KEY_AES,
        sessionKeyHmac: BAP_SESSION_KEY_HMAC,
        securityToken: BAP_SECURITY_TOKEN,
        reserved5: 0n,
        bapIpv4: this.ipv4StringToUint32(bapIp),
        bapPort,
      },
      CONTENT_MANIFEST_URL
    );
  }

  private ipv4StringToUint32(ip: string): number {
    const parts = ip.split(".").map((p) => Number(p));
    if (
      parts.length !== 4 ||
      parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)
    ) {
      throw new Error(`Invalid IPv4 address: ${ip}`);
    }
    return (
      ((parts[3] << 24) | (parts[2] << 16) | (parts[1] << 8) | parts[0]) >>> 0
    );
  }
}
