import { decode, encode } from "@blamnetwork/rsat";
import type { JoinWire } from "../activity-host-build";
import type { AhSchemas } from "./ah";

// The join request 80800E98 and its result 80800A58.
export function createJoinWire(ah: AhSchemas): JoinWire {
  return {
    decodeRequest(payload) {
      const request = decode(ah.JoinRequest, payload);
      return {
        nonce: request.nonce >>> 0,
        sessionId: request.sessionId,
        machine: Buffer.from(request.identity.machine.bytes),
        player: Buffer.from(request.identity.player.bytes),
        account: request.identity.account,
        character: request.identity.character,
        identityUnknown4: request.identity.unknown4,
      };
    },

    // A join request with an empty auth block (tests and tools; the client
    // sends its own).
    encodeRequest(fields) {
      return encode(ah.JoinRequest, {
        nonce: fields.nonce,
        sessionId: fields.sessionId,
        identity: {
          machine: { bytes: [...fields.machine] },
          player: { bytes: [...fields.player] },
          account: fields.account,
          character: fields.character,
          unknown4: fields.identityUnknown4 ?? 0n,
        },
        auth: {
          unknown0: undefined,
          displayName: undefined,
          unknown2: undefined,
          unknown3: undefined,
          unknown4: undefined,
          unknown5: undefined,
          unknown6: undefined,
          unknown7: undefined,
          machine: undefined,
        },
        unknown4: false,
        unknown5: 0,
      });
    },

    // The result echoes the request as decoded and re-encoded. Members 8-10
    // are u16, u16, u32; the first two are canned (world defaults). Member
    // 10 is unknown, sent 0.
    encodeResult(requestPayload, fields) {
      const request = decode(ah.JoinRequest, requestPayload);
      const text = fields.sessionDisplay(request.sessionId);
      return encode(ah.JoinResult, {
        request,
        result: 0,
        sessionDisplay: {
          text: {
            chars: Array.from({ length: 128 }, (_, i) =>
              i < text.length ? text.charCodeAt(i) : 0
            ),
          },
        },
        replicationEpoch: fields.replicationEpoch,
        unk4: 0,
        unk5: 0,
        activityTime: 0,
        flag: 0,
        unknown8: fields.recentWindowMs,
        unknown9: fields.keepaliveIntervalMs,
        unknown10: 0,
      });
    },
  };
}
