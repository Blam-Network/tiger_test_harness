import { rsat } from "@blamnetwork/rsat";

// Schemas register by id when this runs, so only the build's loader calls it.
export function defineJoinSchemas() {
  // 808044D3: the console's 6-byte machine id, the 8-byte player id and the
  // account and character soids. The fireteam member of the start request is
  // this too.
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

  const JoinRequest = rsat.schema(0x808044ee, {
    nonce: rsat.u32(),
    sessionId: rsat.u64(),
    identity: rsat.nested(JoinIdentity),
    auth: rsat.nested(JoinRequestAuth),
  });

  const JoinResult = rsat.schema(0x808044f1, {
    request: rsat.nested(JoinRequest),
    result: rsat.i8({ size: 3, bias: 1 }),
    sessionDisplay: rsat.nested(SessionDisplay),
    replicationEpoch: rsat.u32(),
    unk4: rsat.i32(),
    unk5: rsat.u32(),
    activityTime: rsat.i32(),
    flag: rsat.u8(),
  });

  return {
    JoinIdentity,
    JoinRequest,
    JoinRequestAuth,
    JoinResult,
    SessionDisplay,
  };
}

export type JoinSchemas = ReturnType<typeof defineJoinSchemas>;
