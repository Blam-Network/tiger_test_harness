import { describe, expect, it } from "vitest";
import {
  AUTH_TICKET_SIZE,
  buildAuthReply,
  createAuthSession,
  findAuthSession,
  isDestinyTitle,
  parseAuthRequest,
  readServerTicket,
} from "./auth";
import { demonwareBuild } from "./versions";

const auth = () => {
  const values = demonwareBuild().auth;
  if (!values) {
    throw new Error("the live build has auth");
  }
  return values;
};

describe("Demonware auth", () => {
  // Shape of the request (bdAuth_start_http_request).
  const request = Buffer.from(
    '{"auth_task":"42","iv_seed":"3735928559","title_id":"18407","extra_data":"{\\"version\\":\\"0\\"}"}'
  );

  it("parses the request", () => {
    expect(parseAuthRequest(request)).toEqual({
      authTask: 42,
      ivSeed: "3735928559",
      titleId: 18_407,
    });
  });

  it("knows Destiny's title id", () => {
    const parsed = parseAuthRequest(request);
    expect(parsed && isDestinyTitle(parsed)).toBe(true);
    expect(
      isDestinyTitle({
        authTask: 42,
        ivSeed: "1",
        titleId: auth().titleId + 1,
      })
    ).toBe(false);
  });

  it("replies with task 43, code 700 and 128-byte tickets", () => {
    const session = createAuthSession("3735928559");
    const reply = JSON.parse(buildAuthReply(session, 1_000));

    expect(reply.auth_task).toBe("43");
    expect(reply.code).toBe("700");
    expect(reply.iv_seed).toBe("3735928559");
    expect(JSON.parse(reply.extra_data)).toEqual({ dpi: "0" });

    const client = Buffer.from(reply.client_ticket, "base64");
    expect(client.length).toBe(AUTH_TICKET_SIZE);
    expect(client.readUInt32LE(0)).toBe(auth().authTicketMagic);
    expect(client.readUInt32LE(5)).toBe(auth().titleId);
    expect(client.subarray(0x61, 0x79).equals(session.sessionKey)).toBe(true);

    const server = Buffer.from(reply.server_ticket, "base64");
    expect(server.length).toBe(AUTH_TICKET_SIZE);
    expect(findAuthSession(readServerTicket(server) ?? -1)).toBe(session);
  });

  it("uses no backslash escapes other than quotes", () => {
    const body = buildAuthReply(createAuthSession("1"));
    expect(body.replaceAll('\\"', "")).not.toContain("\\");
    expect(body.length).toBeLessThan(1000);
  });
});
