import { rsat } from "@blamnetwork/rsat";

export function defineClientAuthSchemas() {
  const SessionId8 = rsat.schema(0x80800e31, {
    bytes: rsat.bytes(8),
  });

  const AdvertisedPad = rsat.schema(0x80800e38, {
    bytes: rsat.bytes(36),
  });

  const ActivityHost16 = rsat.schema(0x8080024a, {
    bytes: rsat.bytes(16),
  });

  const AdvertisedSession = rsat.schema(0x808044b3, {
    session: rsat.nested(SessionId8),
    pad: rsat.nested(AdvertisedPad),
    activityHost: rsat.nested(ActivityHost16),
  });

  // 808044B9 — citizen state of a region.
  const CitizenState = rsat.schema(0x808044b9, {
    unknown0: rsat.u8(),
    connectionState: rsat.u8({ size: 2, bias: 1 }),
    advertised: rsat.nested(AdvertisedSession),
    activityHostId: rsat.u64(),
  });

  // 808044BB — a region the client is in or heading to.
  const ClientRegion = rsat.schema(0x808044bb, {
    regionId: rsat.i32(),
    unknown1: rsat.i32(),
    public: rsat.u8({ size: 2, bias: 1 }),
    ackedRevokeToken: rsat.u8(),
    citizen: rsat.nested(CitizenState),
  });

  // 808044BD — slice-set transition state.
  const ClientTransition = rsat.schema(0x808044bd, {
    current: rsat.optional(rsat.nested(ClientRegion)),
    pending: rsat.optional(rsat.nested(ClientRegion)),
    spawnName: rsat.optional(rsat.u32()),
    token: rsat.optional(rsat.u8()),
    props: rsat.optional(rsat.u8()),
    phase: rsat.optional(rsat.u8({ size: 3, bias: 1 })),
  });

  // 808044D9 — client identity (sent once at join).
  const ClientIdentity = rsat.schema(0x808044d9, {
    unknown0: rsat.u8({ size: 4 }),
    sessionId: rsat.repeat(rsat.i8({ bias: 128 }), 128),
    unknown2: rsat.u64(),
    unknown3: rsat.u64(),
    fireteamId: rsat.u64(),
    unknown5: rsat.i32(),
    machine: rsat.repeat(rsat.u8(), 6),
  });

  // 808044C8 — the client's hard wipe, under the names of its log format
  // (hw_state, hw_current_cookie, hw_start_time, hw_last_cookie): its state
  // (0 a wipe seen, 1 showing the screen, 2 waiting on the host, 3 done), the
  // cookie it is handling, the activity tick it saw that cookie at and the
  // last cookie it completed.
  const HardWipe = rsat.schema(0x808044c8, {
    state: rsat.i8({ size: 3, bias: 1 }),
    currentCookie: rsat.u8(),
    startTime: rsat.i32(),
    lastCookie: rsat.u8(),
  });

  const TeleportTarget = rsat.schema(0x808044cc, {
    a: rsat.u8(),
    b: rsat.i32(),
    c: rsat.u32(),
    d: rsat.u32({ size: 20 }),
  });

  // The client's teleportation: its state (0 inactive, 1 accepted, 2
  // transitioning, 3 done) and the host target it accepted, copied whole.
  const Teleport = rsat.schema(0x808044cf, {
    unknown0: rsat.u8({ size: 3, bias: 1 }),
    target: rsat.nested(TeleportTarget),
    unknown2: rsat.i32(),
  });

  const ClientAuthoritativeData = rsat.schema(0x808044da, {
    anyUpdate: rsat.bool(),
    identity: rsat.optional(rsat.nested(ClientIdentity)),
    transition: rsat.optional(rsat.nested(ClientTransition)),
    hardWipe: rsat.optional(rsat.nested(HardWipe)),
    teleport: rsat.optional(rsat.nested(Teleport)),
  });
  return { ClientRegion, ClientTransition, ClientAuthoritativeData };
}
