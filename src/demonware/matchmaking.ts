import { event_message, event_warning } from "@blamnetwork/datamine";
import { anonymousHosts } from "../activity-host-proxy/player-hosts";
import { players } from "../players/registry";
import {
  FAKE_CONNECTION_ID,
  MM_CREATE_SESSION,
  MM_DELETE_SESSION,
  MM_FIND_SESSIONS,
  MM_GET_PERFORMANCE,
  MM_SUBMIT_PERFORMANCE,
  MM_UPDATE_SESSION,
} from "./constants";
import {
  buildSessionInfoResult,
  sessionAdvertisedActivityId,
  stripSessionIdPrefix,
} from "./session-info";
import {
  createDemonwareSession,
  deleteDemonwareSession,
  demonwareSessions,
  updateDemonwareSession,
} from "./session-registry";
import {
  buildTaskReplyFrame,
  peekTypedByte,
  readTypedByte,
  readTypedU32,
  readTypedU64,
  writeTypedBlob,
  writeTypedI64,
  writeTypedU64,
} from "./typed-buffer";
import { hexPreview, type LobbyLink } from "./util";
import { demonwareBuild } from "./versions";

// The client pre-allocates 50 result records and truncates there.
const MAX_FOUND_SESSIONS = 50;

let nextTransactionId = 1n;

// bdMatchMaking (service 21). Wire: typed-byte taskId + typed params.
// Activity session creation blocks on createSession until a TASK_REPLY
// arrives.
function handleMatchMaking(
  remote: string,
  rest: Buffer,
  sendTaskReply: (taskId: number, results: Buffer[]) => void
): void {
  const parsed = readTypedByte(rest);
  if (!parsed) {
    event_warning(
      "demonware:matchmaking: [%s] bdMatchMaking missing typed task id rest=%s",
      remote,
      hexPreview(rest)
    );
    return;
  }

  const { value: taskId, next } = parsed;
  event_message(
    "demonware:matchmaking: [%s] bdMatchMaking task=%d params=%s",
    remote,
    taskId,
    hexPreview(next, 64)
  );

  switch (taskId) {
    case MM_CREATE_SESSION: {
      // One id per client: two clients sharing an id cannot be told apart,
      // and findSessions has nothing to hand the second one.
      const sessionId = createDemonwareSession(remote, next).id;
      const idBytes = Buffer.alloc(8);
      idBytes.writeBigUInt64LE(sessionId, 0);
      sendTaskReply(taskId, [writeTypedBlob(idBytes)]);
      event_message(
        "demonware:matchmaking: [%s] bdMatchMaking createSession → id=0x%I64x advertises activity=%s",
        remote,
        sessionId,
        sessionAdvertisedActivityId(next) ?? "unreadable"
      );
      break;
    }

    case MM_GET_PERFORMANCE: {
      const results: Buffer[] = [];
      let cursor = next;
      const gameType = readTypedU32(cursor);
      if (gameType) {
        cursor = gameType.next;
        while (cursor.length > 0) {
          const uid = readTypedU64(cursor);
          if (!uid) {
            break;
          }
          cursor = uid.next;
          results.push(
            Buffer.concat([writeTypedU64(uid.value), writeTypedI64(10n)])
          );
        }
        event_message(
          "demonware:matchmaking: [%s] bdMatchMaking getPerformance gameType=0x%x users=%d",
          remote,
          gameType.value,
          results.length
        );
      }
      sendTaskReply(taskId, results);
      break;
    }

    case MM_DELETE_SESSION:
      deleteDemonwareSession(remote);
      sendTaskReply(taskId, []);
      break;

    case MM_UPDATE_SESSION: {
      // The advertisement has to follow its owner across regions: the seeker
      // searches for the activity id of the region being entered, and a
      // session still advertising the previous region's is filtered out of
      // its own search.
      const info = stripSessionIdPrefix(next);
      updateDemonwareSession(remote, info);
      sendTaskReply(taskId, []);
      event_message(
        "demonware:matchmaking: [%s] bdMatchMaking updateSession advertises activity=%s",
        remote,
        sessionAdvertisedActivityId(info) ?? "unreadable"
      );
      break;
    }

    case MM_SUBMIT_PERFORMANCE:
      sendTaskReply(taskId, []);
      break;

    case MM_FIND_SESSIONS: {
      // Solo Nest: no foreign public sessions. Empty results are correct.
      // Arm PAH ASSIGN→REVOKE after the abort-plane so matchmaking-GS
      // gives up and can spin GAH. The lobby cannot yet tell which player is
      // searching (every client shares FAKE_CONNECTION_ID), so arm every
      // registered player's policy plus the anonymous one.
      let revokeArmed = anonymousHosts.pah.noteMatchmakingSearch();
      for (const player of players()) {
        revokeArmed = player.hosts.pah.noteMatchmakingSearch() || revokeArmed;
      }
      // Only sessions advertising the activity the client asked for, the
      // searcher's own included: the client logs "we are not being
      // advertised!" when its own is missing. One console holds two Demonware
      // connections, so returning every session hands a solo player its
      // sibling socket's session, which the seeker rejects forever.
      const criteria = readFindSessionsCriteria(next);
      const limit = Math.min(
        criteria?.maxResults ?? MAX_FOUND_SESSIONS,
        MAX_FOUND_SESSIONS
      );
      const results: Buffer[] = [];
      let offered = 0;
      for (const session of demonwareSessions()) {
        if (results.length >= limit || !session.info) {
          continue;
        }
        offered += 1;
        if (
          criteria &&
          sessionAdvertisedActivityId(session.info) !== criteria.activityId
        ) {
          continue;
        }
        const record = buildSessionInfoResult(session.info, session.id);
        if (record) {
          results.push(record);
        }
      }
      sendTaskReply(taskId, results);
      event_message(
        "demonware:matchmaking: [%s] bdMatchMaking findSessions → %d of %d session(s)%s%s",
        remote,
        results.length,
        offered,
        criteria
          ? ` for kind=${criteria.kind} activity=${criteria.activityId}`
          : " unfiltered, criteria unreadable",
        revokeArmed ? "; PAH revoke armed (solo abort-plane 11s)" : ""
      );
      break;
    }

    default:
      event_warning(
        "demonware:matchmaking: [%s] bdMatchMaking unhandled task=%d — empty success",
        remote,
        taskId
      );
      sendTaskReply(taskId, []);
      break;
  }
}

// findSessions params: u32 kind, u32 0, u32 maxResults, then the search
// criteria object whose first field is the u32 activity id, followed by u64
// 100, i32 3 (nat type), i32 1 (joinable party sizes) and a run of type-0x14
// entries we do not read.
interface FindSessionsCriteria {
  activityId: number;
  kind: number;
  maxResults: number;
}

export function readFindSessionsCriteria(
  params: Buffer
): FindSessionsCriteria | null {
  const kind = readTypedU32(params);
  const unknown = kind && readTypedU32(kind.next);
  const maxResults = unknown && readTypedU32(unknown.next);
  const activityId = maxResults && readTypedU32(maxResults.next);
  if (!(kind && maxResults && activityId)) {
    return null;
  }
  return {
    activityId: activityId.value,
    kind: kind.value,
    maxResults: maxResults.value,
  };
}

function sendLobbyTaskReply(
  socket: LobbyLink,
  remote: string,
  taskId: number,
  resultObjects: Buffer[]
): void {
  const txn = nextTransactionId++;
  const frame = buildTaskReplyFrame(txn, taskId, resultObjects);
  socket.write(frame);
  event_message(
    "demonware:matchmaking: [%s] TASK_REPLY task=%d txn=%I64d results=%d frame=%s",
    remote,
    taskId,
    txn,
    resultObjects.length,
    hexPreview(frame, 48)
  );
}

export function dispatchLobbyService(
  socket: LobbyLink,
  remote: string,
  serviceId: number,
  rest: Buffer
): void {
  const reply = (taskId: number, results: Buffer[]) =>
    sendLobbyTaskReply(socket, remote, taskId, results);

  if (serviceId === demonwareBuild().matchMakingService) {
    handleMatchMaking(remote, rest, reply);
    return;
  }

  const taskId = peekTypedByte(rest);
  event_warning(
    "demonware:matchmaking: [%s] stub empty TASK_REPLY for service=%d task=%s",
    remote,
    serviceId,
    taskId ?? "?"
  );
  reply(taskId ?? 0, []);
}

export { FAKE_CONNECTION_ID };
