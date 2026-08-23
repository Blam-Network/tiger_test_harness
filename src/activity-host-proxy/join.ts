import { decode, encode, rsat } from "@blamnetwork/rsat";

const JoinIdentity = rsat.schema(0x808044d3, {
  machine: rsat.bytes(6),
  player: rsat.bytes(8),
  account: rsat.u64(),
  character: rsat.u64(),
});

const SessionDisplay = rsat.schema(0x808001b8, {
  chars: rsat.repeat(rsat.i8({ size: 8, bias: 128 }), 128),
});

const JoinRequestAuth = rsat.schema(0x808044d9, {
  unk0: rsat.u8({ size: 4, bias: 0 }),
  displayName: rsat.nested(SessionDisplay),
  unk2: rsat.u64(),
  unk3: rsat.u64(),
  unk4: rsat.u64(),
  unk5: rsat.i32(),
  unk6: rsat.bytes(6),
});

export const JoinRequest = rsat.schema(0x808044ee, {
  nonce: rsat.u32(),
  sessionId: rsat.u64(),
  identity: rsat.nested(JoinIdentity),
  auth: rsat.nested(JoinRequestAuth),
});

export const JoinResult = rsat.schema(0x808044f1, {
  request: rsat.nested(JoinRequest),
  result: rsat.i8({ size: 3, bias: 1 }),
  sessionDisplay: rsat.nested(SessionDisplay),
  replicationEpoch: rsat.u32(),
  unk4: rsat.i32(),
  unk5: rsat.u32(),
  activityTime: rsat.i32(),
  flag: rsat.u8(),
});

export interface ParsedJoinRequest {
  account: bigint;
  character: bigint;
  nonce: number;
  sessionId: bigint;
}

export function parseJoinRequest(payload: Buffer): ParsedJoinRequest | null {
  try {
    const request = decode(JoinRequest, payload);
    return {
      nonce: request.nonce >>> 0,
      sessionId: request.sessionId,
      account: request.identity.account,
      character: request.identity.character,
    };
  } catch {
    return null;
  }
}

export function formatAhSessionDisplay(id: bigint): string {
  const hi = Number((id >> 32n) & 0xffffffffn)
    .toString(16)
    .padStart(8, "0")
    .toUpperCase();
  const lo = Number(id & 0xffffffffn)
    .toString(16)
    .padStart(8, "0")
    .toUpperCase();
  return `${hi}:${lo}`;
}

function sessionDisplayFromId(id: bigint) {
  const text = formatAhSessionDisplay(id);
  const chars = Array.from({ length: 128 }, (_, i) =>
    i < text.length ? text.charCodeAt(i) : 0
  );
  return { chars };
}

export function buildJoinResultRsat(joinRequestPayload: Buffer): Buffer {
  const request = decode(JoinRequest, joinRequestPayload);
  return encode(JoinResult, {
    request,
    result: 0,
    sessionDisplay: sessionDisplayFromId(request.sessionId),
    replicationEpoch: 1,
    unk4: 0,
    unk5: 0,
    activityTime: 0,
    flag: 0,
  });
}
