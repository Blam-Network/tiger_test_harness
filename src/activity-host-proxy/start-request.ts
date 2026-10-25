import { decode, decodeServerMessage } from "@blamnetwork/rsat";
import { e_server_message_network_id } from "../bungie-access-protocol/rsat/constants";
import type { AhClientIdentity } from "./join";
import { activityHostBuild } from "./versions";

export interface ParsedStartRequest {
  activityId: number;
  // Decode of `stream` as 808044EB; undefined
  // if the stream is empty or the layout ever changes underneath us. Order
  // is the fireteam roster as the manager sent it; `requesterMachine` names
  // which member is this connection.
  fireteam?: AhClientIdentity[];
  ipValid: boolean;
  options: Buffer;
  requesterMachine?: Buffer;
  stream: Buffer;
  unknown1: boolean;
}

// Decode the 808044EB bitstream for fireteam membership and the requesting
// machine. Never throws: a layout change here must not kill the request
// path, only fall back to the caller's other identification heuristics.
function decodeStartRequestStream(
  stream: Buffer
): { fireteam: AhClientIdentity[]; requesterMachine: Buffer } | undefined {
  if (stream.length === 0) {
    return;
  }
  try {
    const decoded = decode(
      activityHostBuild().startRequest.StartRequestStream,
      stream
    );
    if (decoded.fireteam.members.length === 0) {
      // The client asserts the fireteam count is never 0 on the real wire;
      // seeing it here means this buffer doesn't match the 808044EB layout.
      return;
    }
    return {
      fireteam: decoded.fireteam.members.map((m) => ({
        machine: Buffer.from(m.machine),
        player: Buffer.from(m.player),
        account: m.account,
        character: m.character,
      })),
      requesterMachine: Buffer.from(decoded.machine),
    };
  } catch {
    return;
  }
}

export function parseStartRequest(payload: Buffer): ParsedStartRequest | null {
  const {
    ActivityHostStartupOptionsRequest,
    START_REQUEST_OPTIONS_CAPACITY,
    START_REQUEST_STREAM_CAPACITY,
    START_REQUEST_STREAM_OFFSET,
    START_REQUEST_STREAM_SIZE_OFFSET,
  } = activityHostBuild().startRequest;
  if (payload.length < START_REQUEST_STREAM_OFFSET) {
    return null;
  }

  const optionsSize = payload.readUInt16BE(0);
  if (optionsSize > START_REQUEST_OPTIONS_CAPACITY) {
    return null;
  }

  const streamSize = payload.readUInt16BE(START_REQUEST_STREAM_SIZE_OFFSET);
  if (streamSize > START_REQUEST_STREAM_CAPACITY) {
    return null;
  }
  if (payload.length < START_REQUEST_STREAM_OFFSET + streamSize) {
    return null;
  }

  const options = Buffer.from(payload.subarray(2, 2 + optionsSize));
  const stream = Buffer.from(
    payload.subarray(
      START_REQUEST_STREAM_OFFSET,
      START_REQUEST_STREAM_OFFSET + streamSize
    )
  );
  const decodedStream = decodeStartRequestStream(stream);

  if (optionsSize === 0) {
    return {
      activityId: 0,
      ipValid: false,
      unknown1: false,
      options,
      stream,
      ...decodedStream,
    };
  }

  try {
    const decoded = decodeServerMessage(
      options,
      ActivityHostStartupOptionsRequest
    );
    if (
      decoded.networkId !==
      e_server_message_network_id._server_message_network_id_activity_host_get_activity_host_startup_options
    ) {
      return null;
    }
    return {
      activityId: decoded.value.activityId,
      ipValid: decoded.value.ipValid,
      unknown1: decoded.value.unknown1,
      options,
      stream,
      ...decodedStream,
    };
  } catch {
    return null;
  }
}

export function formatStartRequest(parsed: ParsedStartRequest): string {
  return (
    `activity=${parsed.activityId} ipValid=${parsed.ipValid ? 1 : 0} ` +
    `options=${parsed.options.length}B stream=${parsed.stream.length}B`
  );
}

const U64_MASK = (1n << 64n) - 1n;

// Bit offset of `value` as a big-endian u64 anywhere in `stream`, or -1.
// The stream is the bit-packed player configuration; its "User state"
// soids (account, then character 32 bits later) land on arbitrary bit
// boundaries, so a byte-aligned search would miss them.
export function findU64BitOffset(stream: Buffer, value: bigint): number {
  const last = stream.length - 8;
  for (let i = 0; i <= last; i++) {
    const aligned = stream.readBigUInt64BE(i);
    if (aligned === value) {
      return i * 8;
    }
    if (i === last) {
      break;
    }
    const spill = BigInt(stream[i + 8]);
    for (let shift = 1; shift < 8; shift++) {
      const window =
        ((aligned << BigInt(shift)) | (spill >> BigInt(8 - shift))) & U64_MASK;
      if (window === value) {
        return i * 8 + shift;
      }
    }
  }
  return -1;
}
