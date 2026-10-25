// Activity host manager start request bitstream (808044EB), decoded. The
// layout (a 6-byte machine id in each fireteam member) is unverified against
// a capture of this build's client, and a stream that does not decode falls
// back to the other ways of identifying the requester (start-request.ts).
import { rsat } from "@blamnetwork/rsat";

// Schemas register by id when this runs, so only the build's loader calls it.
export function defineStartRequestSchemas() {
  // Wire-6 body is always 3095. Type 3 copies the next 2580:
  //   u16be optionsSize
  //   u8[512]  server_message (nid 1303 + 80801A55)
  //   u16be streamSize
  //   u8[2064] bitstream
  const ACTIVITY_HOST_MANAGER_REQUEST_SIZE = 3095;
  const START_REQUEST_PAYLOAD_SIZE = 2580;
  const START_REQUEST_OPTIONS_CAPACITY = 512;
  const START_REQUEST_STREAM_CAPACITY = 2064;
  const START_REQUEST_STREAM_SIZE_OFFSET = 2 + START_REQUEST_OPTIONS_CAPACITY;
  const START_REQUEST_STREAM_OFFSET = START_REQUEST_STREAM_SIZE_OFFSET + 2;

  // 80801A55 — activity_host_get_activity_host_startup_options request.
  const ActivityHostStartupOptionsRequest = rsat.schema(0x80801a55, {
    activityId: rsat.i16({ size: 16, bias: 0x8000 }),
    // 1 when the start object's ip byte is not -1.
    ipValid: rsat.bool(),
    unknown1: rsat.bool(),
  });

  // 808044D3 — one fireteam member: machine, player id, account and character
  // soids.
  const FireteamMember = rsat.schema(0x808044d3, {
    machine: rsat.bytes(6),
    player: rsat.bytes(8),
    account: rsat.u64(),
    character: rsat.u64(),
  });

  // 80804BAC — activity id + ip byte, same pair as the 80801A55 options message.
  const StartActivity = rsat.schema(0x80804bac, {
    activityId: rsat.i16({ bias: 0x8000 }),
    ip: rsat.i8({ bias: 0x80 }),
  });

  // 80800487 — opaque 256-byte slot (uninitialised stack).
  const StartRequestSlot = rsat.schema(0x80800487, {
    bytes: rsat.repeat(rsat.i8({ bias: 0x80 }), 256),
  });

  // 808044D4 — 5-bit count then N x FireteamMember (max 20).
  const StartFireteam = rsat.schema(0x808044d4, {
    members: rsat.array(rsat.nested(FireteamMember), {
      lengthBits: 5,
      max: 20,
    }),
  });

  // 808044EB — activity host manager start request bitstream.
  const StartRequestStream = rsat.schema(0x808044eb, {
    unknown0: rsat.u32(),
    unknown1: rsat.i8({ size: 2, bias: 1 }),
    activity: rsat.nested(StartActivity),
    // four opaque 256-byte slots; slot1 may carry uninitialised stack
    slot0: rsat.nested(StartRequestSlot),
    slot1: rsat.nested(StartRequestSlot),
    slot2: rsat.nested(StartRequestSlot),
    slot3: rsat.nested(StartRequestSlot),
    fireteam: rsat.nested(StartFireteam),
    machine: rsat.bytes(6),
  });

  return {
    ACTIVITY_HOST_MANAGER_REQUEST_SIZE,
    START_REQUEST_PAYLOAD_SIZE,
    START_REQUEST_OPTIONS_CAPACITY,
    START_REQUEST_STREAM_CAPACITY,
    START_REQUEST_STREAM_SIZE_OFFSET,
    START_REQUEST_STREAM_OFFSET,
    ActivityHostStartupOptionsRequest,
    FireteamMember,
    StartActivity,
    StartRequestSlot,
    StartFireteam,
    StartRequestStream,
  };
}
