import { decode, encode } from "@blamnetwork/rsat";
import type { JoinWire } from "../activity-host-build";
import type { AhSchemas } from "./ah";

// The join request 808044EE and its result 808044F1. The identity's machine
// is the console's 6-byte id, and there is no member after the activity time
// and flag: the result lacks the keepalive timings the live build's has.
export function createJoinWire(ah: AhSchemas): JoinWire {
  return {
    decodeRequest(payload) {
      const request = decode(ah.JoinRequest, payload);
      return {
        nonce: request.nonce >>> 0,
        sessionId: request.sessionId,
        machine: Buffer.from(request.identity.machine),
        player: Buffer.from(request.identity.player),
        account: request.identity.account,
        character: request.identity.character,
      };
    },

    encodeRequest(fields) {
      return encode(ah.JoinRequest, {
        nonce: fields.nonce,
        sessionId: fields.sessionId,
        identity: {
          machine: fields.machine,
          player: fields.player,
          account: fields.account,
          character: fields.character,
        },
        auth: {
          unk0: 0,
          displayName: { chars: new Array(128).fill(0) },
          unk2: 0n,
          unk3: 0n,
          unk4: 0n,
          unk5: 0,
          unk6: Buffer.alloc(6),
        },
      });
    },

    encodeResult(requestPayload, fields) {
      const request = decode(ah.JoinRequest, requestPayload);
      const text = fields.sessionDisplay(request.sessionId);
      return encode(ah.JoinResult, {
        request,
        result: 0,
        sessionDisplay: {
          chars: Array.from({ length: 128 }, (_, i) =>
            i < text.length ? text.charCodeAt(i) : 0
          ),
        },
        replicationEpoch: fields.replicationEpoch,
        unk4: 0,
        unk5: 0,
        activityTime: 0,
        flag: 0,
      });
    },
  };
}
