import { randomBytes } from "node:crypto";
import { type DemonwareAuth, demonwareBuild } from "./versions";

// Demonware cross-auth ("auth3"): the console POSTs JSON to
// https://panther-xbox360-auth3.<env>.demonware.net/auth/ and the reply hands
// back a plaintext client ticket and an opaque server ticket, both forwarded
// to the lobby.

// The build's auth values; callers check demonwareBuild().auth first.
function auth(): DemonwareAuth {
  const values = demonwareBuild().auth;
  if (!values) {
    throw new Error("this build has no Demonware auth");
  }
  return values;
}

export function isDestinyTitle(request: AuthRequest): boolean {
  return request.titleId === auth().titleId;
}

// bdAuthTicket size; packed little-endian.
export const AUTH_TICKET_SIZE = 128;
const SESSION_KEY_SIZE = 24;

// Our own server ticket format; the client never looks inside it.
const SERVER_TICKET_MAGIC = Buffer.from("WTDW", "ascii");

const TICKET_LIFETIME_SECONDS = 24 * 60 * 60;

interface AuthRequest {
  authTask: number;
  ivSeed: string;
  titleId: number;
}

interface DemonwareAuthSession {
  id: number;
  ivSeed: string;
  sessionKey: Buffer;
  userId: bigint;
  username: string;
}

// The lobby looks sessions up by the id inside the server ticket.
const sessions = new Map<number, DemonwareAuthSession>();
let nextSessionId = 1;

export function findAuthSession(id: number): DemonwareAuthSession | undefined {
  return sessions.get(id);
}

// Every auth session, newest first.
export function authSessions(): DemonwareAuthSession[] {
  return [...sessions.values()].reverse();
}

export function parseAuthRequest(body: Buffer): AuthRequest | undefined {
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(body.toString("utf8"));
  } catch {
    return;
  }
  const ivSeed = json.iv_seed;
  if (typeof ivSeed !== "string" && typeof ivSeed !== "number") {
    return;
  }
  return {
    authTask: Number(json.auth_task),
    ivSeed: String(ivSeed),
    titleId: Number(json.title_id),
  };
}

// bdAuthTicket, 128 bytes packed little-endian. Only the magic
// is checked; title id and session key are forwarded to the lobby.
function buildClientTicket(session: DemonwareAuthSession, now: number): Buffer {
  const ticket = Buffer.alloc(AUTH_TICKET_SIZE);
  ticket.writeUInt32LE(auth().authTicketMagic, 0x00);
  ticket.writeUInt8(0, 0x04); // type, true meaning unknown
  ticket.writeUInt32LE(auth().titleId, 0x05);
  ticket.writeUInt32LE(now, 0x09);
  ticket.writeUInt32LE(now + TICKET_LIFETIME_SECONDS, 0x0d);
  ticket.writeBigUInt64LE(0n, 0x11); // license id, unused
  ticket.writeBigUInt64LE(session.userId, 0x19);
  ticket.write(session.username.slice(0, 63), 0x21, "ascii");
  session.sessionKey.copy(ticket, 0x61);
  // 0x79 hash magic and 0x7c hash are never checked by the client.
  return ticket;
}

function buildServerTicket(session: DemonwareAuthSession): Buffer {
  const ticket = Buffer.alloc(AUTH_TICKET_SIZE);
  SERVER_TICKET_MAGIC.copy(ticket, 0);
  ticket.writeUInt32LE(session.id, 4);
  session.sessionKey.copy(ticket, 8);
  return ticket;
}

export function readServerTicket(ticket: Buffer): number | undefined {
  if (ticket.length < 8 || !ticket.subarray(0, 4).equals(SERVER_TICKET_MAGIC)) {
    return;
  }
  return ticket.readUInt32LE(4);
}

export function createAuthSession(ivSeed: string): DemonwareAuthSession {
  const id = nextSessionId++;
  const session: DemonwareAuthSession = {
    id,
    ivSeed,
    sessionKey: randomBytes(SESSION_KEY_SIZE),
    userId: 0x0009_0000_0000_0000n + BigInt(id),
    username: "Guardian",
  };
  sessions.set(id, session);
  return session;
}

// The client's JSON reader only understands \" as an escape,
// which is all JSON.stringify emits for these values.
export function buildAuthReply(
  session: DemonwareAuthSession,
  now = Math.floor(Date.now() / 1000)
): string {
  return JSON.stringify({
    auth_task: String(auth().authTaskReply),
    code: String(auth().authCodeOk),
    iv_seed: session.ivSeed,
    client_ticket: buildClientTicket(session, now).toString("base64"),
    server_ticket: buildServerTicket(session).toString("base64"),
    // Must be a JSON object string with a "dpi" key.
    extra_data: JSON.stringify({ dpi: "0" }),
  });
}
