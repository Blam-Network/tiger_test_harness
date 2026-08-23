import { decodeServerMessage, rsat } from "@blamnetwork/rsat";
import { e_server_message_network_id } from "../bungie-access-protocol/rsat/server-message";

/**
 * Wire-6 body is always 3095 (sub_82B80BB0). Type 3 copies the next 2580.
 *
 * sub_829DF8B8 / sub_829DE238 / sub_829DF6C8:
 *   u16be optionsSize
 *   u8[512]  server_message (nid 1303 + 80801A55)
 *   u16be streamSize
 *   u8[2064] bitstream (sub_83690600 writes nothing we have named yet)
 */
export const ACTIVITY_HOST_MANAGER_REQUEST_SIZE = 3095;
export const START_REQUEST_PAYLOAD_SIZE = 2580;
export const START_REQUEST_OPTIONS_CAPACITY = 512;
export const START_REQUEST_STREAM_CAPACITY = 2064;
export const START_REQUEST_STREAM_SIZE_OFFSET =
  2 + START_REQUEST_OPTIONS_CAPACITY;
export const START_REQUEST_STREAM_OFFSET = START_REQUEST_STREAM_SIZE_OFFSET + 2;

/** 80801A55 — activity_host_get_activity_host_startup_options request. */
export const ActivityHostStartupOptionsRequest = rsat.schema(0x80801a55, {
  activityId: rsat.i16({ size: 16, bias: 0x8000 }),
  /** 1 when the start object's ip byte is not -1 (sub_83676150). */
  ipValid: rsat.bool(),
  unknown1: rsat.bool(),
});

export interface ParsedStartRequest {
  activityId: number;
  ipValid: boolean;
  options: Buffer;
  stream: Buffer;
  unknown1: boolean;
}

export function parseStartRequest(payload: Buffer): ParsedStartRequest | null {
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

  if (optionsSize === 0) {
    return {
      activityId: 0,
      ipValid: false,
      unknown1: false,
      options,
      stream,
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
