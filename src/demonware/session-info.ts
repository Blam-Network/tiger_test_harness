import {
  readTypedBlob,
  readTypedU32,
  writeTypedBlob,
  writeTypedU32,
} from "./typed-buffer";

// bdMatchMakingInfo. The client serialises {blob data, u32, u32} plus a long
// game-specific tail (60-byte advertisement, strings, floats) and expects
// back {blob data, blob(8) sessionId, u32, u32, u32, ...tail}: the session id
// and the third u32 are the only fields the server adds. A search result is
// the createSession params played back with those two fields spliced in,
// never synthesised, because most of the tail is undecoded.
export function buildSessionInfoResult(
  createParams: Buffer,
  sessionId: bigint
): Buffer | null {
  const data = readTypedBlob(createParams);
  if (!data) {
    return null;
  }
  const first = readTypedU32(data.next);
  const second = first ? readTypedU32(first.next) : null;
  if (!(first && second)) {
    return null;
  }
  const idBytes = Buffer.alloc(8);
  idBytes.writeBigUInt64LE(sessionId, 0);
  return Buffer.concat([
    createParams.subarray(0, createParams.length - data.next.length),
    writeTypedBlob(idBytes),
    writeTypedU32(first.value),
    writeTypedU32(second.value),
    // The server-only u32 at +0x118; meaning unknown, 0 until something
    // shows otherwise.
    writeTypedU32(0),
    second.next,
  ]);
}

// The activity id a session advertises, read out of the cached createSession /
// updateSession params. Serialized field order is the base record's
// {blob data, u32 +0x110, u32 +0x114} followed by Destiny's derived record,
// whose first two fields are the 60-byte advertised blob (+284) and the u32 at
// +480, the field findSessions filters on.
export function sessionAdvertisedActivityId(
  createParams: Buffer
): number | null {
  const data = readTypedBlob(createParams);
  const first = data && readTypedU32(data.next);
  const second = first && readTypedU32(first.next);
  const advertised = second && readTypedBlob(second.next);
  const activityId = advertised && readTypedU32(advertised.next);
  return activityId ? activityId.value : null;
}

// updateSession sends the same record with a leading blob(8) session id.
export function stripSessionIdPrefix(params: Buffer): Buffer {
  const id = readTypedBlob(params);
  return id && id.value.length === 8 ? id.next : params;
}
