import { FAKE_DW_SESSION_ID } from "./constants";

// Every client that calls bdMatchMaking createSession gets its own session
// id and a row here, so a second client's findSessions can discover the
// first one.
interface DemonwareSession {
  id: bigint;
  // The bdMatchMakingInfo bytes the client sent with createSession /
  // updateSession, kept verbatim so findSessions can play them back.
  info?: Buffer;
  // The socket's remote address, our only per-connection identity until the
  // lobby carries a real one.
  remote: string;
}

const sessions = new Map<string, DemonwareSession>();
let nextSessionId = FAKE_DW_SESSION_ID;

export function createDemonwareSession(
  remote: string,
  info?: Buffer
): DemonwareSession {
  nextSessionId += 1n;
  const session = { id: nextSessionId, info, remote };
  sessions.set(remote, session);
  return session;
}

export function updateDemonwareSession(remote: string, info: Buffer): void {
  const session = sessions.get(remote);
  if (session) {
    session.info = info;
  }
}

export function deleteDemonwareSession(remote: string): void {
  sessions.delete(remote);
}

export function demonwareSessions(): readonly DemonwareSession[] {
  return [...sessions.values()];
}
