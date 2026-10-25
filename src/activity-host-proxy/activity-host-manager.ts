import { event_message, event_warning } from "@blamnetwork/datamine";
import { c } from "@craftycodie/cstruct";
import { Injectable } from "@nestjs/common";
import { activityPlaylist } from "../content/activities";
import type { RawBapMessage } from "../lib/bap-wire/codec";
import {
  type PlayerSession,
  playerByAccount,
  playerByCharacter,
  players,
} from "../players/registry";
import { formatActivityHostTag } from "./config";
import { hexPreview } from "./hex-preview";
import type { AhClientIdentity } from "./join";
import {
  anonymousHosts,
  type BoundHosts,
  type PlayerHosts,
} from "./player-hosts";
import {
  findU64BitOffset,
  formatStartRequest,
  type ParsedStartRequest,
  parseStartRequest,
} from "./start-request";

// Activity host manager startup request type.
export const ACTIVITY_HOST_MANAGER_START_TYPE = 3;
// Response type, true name unknown.
export const ACTIVITY_HOST_MANAGER_RESPONSE_TYPE = 2;

const ActivityHostManagerResponse = c.struct({
  type: c.u8(),
  activityHostId: c.u64(),
  session: c.String(128),
});

export function parseActivityHostManagerRequest(body: Buffer): {
  type: number;
  payload: Buffer;
} | null {
  if (body.length < 1) {
    return null;
  }
  return {
    type: body[0],
    payload: Buffer.from(body.subarray(1)),
  };
}

export function buildActivityHostManagerResponse(
  activityHostId: bigint
): Buffer {
  return c.write(
    ActivityHostManagerResponse,
    {
      type: ACTIVITY_HOST_MANAGER_RESPONSE_TYPE,
      activityHostId,
      session: formatActivityHostTag(activityHostId),
    },
    "big"
  );
}

// Called once per manager request with the parsed start request (undefined
// for other request types or an unparsed start); returns the hosts and
// host kind the reply names.
type BindHosts = (start: ParsedStartRequest | undefined) => BoundHosts;

@Injectable()
export class ActivityHostManager {
  // The start request stream is one 808044EB record: a fireteam roster
  // (account + character soid per member) and the requesting machine's id.
  // The requester is the roster member whose machine matches the trailing
  // field (first member if that machine is absent from the roster, which the
  // capture never showed); look it up by character soid then account soid.
  // If the stream doesn't decode, fall back to the soid bit-scan and finally
  // to the shared anonymous hosts.
  hostsForStartRequest(parsed: ParsedStartRequest): PlayerHosts {
    if (parsed.fireteam) {
      return this.hostsFromFireteam(parsed.fireteam, parsed.requesterMachine);
    }
    return this.hostsFromSoidScan(parsed.stream);
  }

  private hostsFromFireteam(
    fireteam: AhClientIdentity[],
    requesterMachine: Buffer | undefined
  ): PlayerHosts {
    const requester =
      (requesterMachine &&
        fireteam.find((m) => m.machine.equals(requesterMachine))) ||
      fireteam[0];
    if (!requester) {
      event_warning(
        "activities:host:manager: start req fireteam is empty, using anonymous hosts"
      );
      return anonymousHosts;
    }
    const player =
      playerByCharacter(requester.character) ??
      playerByAccount(requester.account);
    event_message(
      "activities:host:manager: start req player account=0x%I64x character=0x%I64x machine=%s fireteam=%d",
      requester.account,
      requester.character,
      requester.machine.toString("hex"),
      fireteam.length
    );
    if (!player) {
      event_warning(
        "activities:host:manager: start req matches no registered player (%d registered), using anonymous hosts",
        players().length
      );
      return anonymousHosts;
    }
    return player.hosts;
  }

  // Pre-decode fallback: scan every registered player's soids as a
  // big-endian u64 at any bit offset in the stream. Soids are
  // type<<32|row with tiny rows, so a bit-shifted window over one player's
  // soids can spell another's (0x1_00000001 << 1 is 0x2_00000002): a player
  // found by both soids beats one found by either, then the earliest offset
  // wins (the real soids lead, false positives trail), then the newest
  // registration. No match falls back to the shared anonymous hosts.
  private hostsFromSoidScan(stream: Buffer): PlayerHosts {
    let best: { player: PlayerSession; score: number; at: number } | undefined;
    for (const player of players()) {
      const accountAt = findU64BitOffset(stream, player.accountSoid);
      const characterAt =
        player.characterSoid === undefined
          ? -1
          : findU64BitOffset(stream, player.characterSoid);
      const score = (accountAt >= 0 ? 1 : 0) + (characterAt >= 0 ? 1 : 0);
      const at = accountAt >= 0 ? accountAt : characterAt;
      if (
        score > 0 &&
        (!best || score > best.score || (score === best.score && at <= best.at))
      ) {
        best = { player, score, at };
      }
    }
    if (!best) {
      event_warning(
        "activities:host:manager: start req matches no registered player (%d registered), using anonymous hosts",
        players().length
      );
      return anonymousHosts;
    }
    const { player, score, at } = best;
    event_message(
      "activities:host:manager: start req player account=0x%I64x character=0x%I64x (%s, stream bit %d)",
      player.accountSoid,
      player.characterSoid ?? 0n,
      score === 2 ? "both soids" : "one soid",
      at
    );
    return player.hosts;
  }

  handle(message: RawBapMessage, bind: BindHosts): Buffer | null {
    try {
      const req = parseActivityHostManagerRequest(message.body);
      if (!req) {
        event_warning(
          "activities:host:manager: req absorbed (short body %dB)",
          message.body.length
        );
        return null;
      }

      let start: ParsedStartRequest | undefined;
      if (req.type === ACTIVITY_HOST_MANAGER_START_TYPE) {
        const parsed = parseStartRequest(req.payload);
        if (parsed) {
          // A playlist id resolves to its first listed activity.
          const resolved =
            activityPlaylist(parsed.activityId)?.[0] ?? parsed.activityId;
          event_message(
            "activities:host:manager: start req (%dB %s%s)",
            req.payload.length,
            formatStartRequest(parsed),
            resolved === parsed.activityId
              ? ""
              : ` playlist -> activity ${resolved}`
          );
          // Downstream (scenario, GAS) wants the map, not the playlist.
          start = { ...parsed, activityId: resolved };
        } else {
          event_warning(
            "activities:host:manager: start req unparsed (%dB head=%s)",
            req.payload.length,
            hexPreview(req.payload, 16)
          );
        }
      }

      const { host, hosts, kind } = bind(start);
      if (req.type === ACTIVITY_HOST_MANAGER_START_TYPE) {
        hosts.setStartRequest(start);
      }
      const body = buildActivityHostManagerResponse(host.id);
      event_message(
        "activities:host:manager: rsp (seq %x, reqType=%d req=%dB head=%s ah=0x%I64x %s, body %dB)",
        message.sequence,
        req.type,
        message.body.length,
        hexPreview(req.payload, 16),
        host.id,
        kind,
        body.length
      );
      return body;
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      event_warning("activities:host:manager: rsp FAILED, absorbed: %s", m);
      return null;
    }
  }
}
