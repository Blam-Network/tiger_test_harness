import { describe, expect, it } from "vitest";
import { readFindSessionsCriteria } from "./matchmaking";
import {
  buildSessionInfoResult,
  sessionAdvertisedActivityId,
} from "./session-info";
import { writeTypedBlob, writeTypedU32, writeTypedU64 } from "./typed-buffer";

// createSession params in the serialized order: the base record's
// {blob data, u32 +0x110, u32 +0x114}, then Destiny's derived record
// starting with the 60-byte advertised blob (+284) and the u32 activity id
// (+480), then a tail we never read.
function createParams(activityId: number): Buffer {
  return Buffer.concat([
    writeTypedBlob(Buffer.alloc(42, 0xab)),
    writeTypedU32(1),
    writeTypedU32(2),
    writeTypedBlob(Buffer.alloc(60, 0xcd)),
    writeTypedU32(activityId),
    writeTypedU64(100n),
  ]);
}

describe("findSessions criteria", () => {
  // Captured from the client.
  const captured = Buffer.from(
    "0802000000080000000008320000000800000600" +
      "0a64000000000000000703000000070100000014141414",
    "hex"
  );

  it("reads kind, the result cap and the activity id", () => {
    expect(readFindSessionsCriteria(captured)).toEqual({
      activityId: 0x00_06_00_00,
      kind: 2,
      maxResults: 50,
    });
  });

  it("refuses params that are not four typed u32s", () => {
    expect(readFindSessionsCriteria(Buffer.from("0802000000", "hex"))).toBe(
      null
    );
  });
});

describe("advertised session record", () => {
  it("reads the activity id a session advertises", () => {
    expect(sessionAdvertisedActivityId(createParams(0x00_06_00_00))).toBe(
      0x00_06_00_00
    );
  });

  it("returns null for a record too short to carry one", () => {
    expect(sessionAdvertisedActivityId(writeTypedBlob(Buffer.alloc(42)))).toBe(
      null
    );
  });

  // The search result splices the session id in after the data blob; the
  // advertised fields have to survive that untouched.
  it("keeps the advertised fields intact through a search result", () => {
    const params = createParams(80);
    const result = buildSessionInfoResult(params, 0x13_37n);
    expect(result).not.toBe(null);
    expect(result?.subarray(result.length - params.length + 58)).toEqual(
      params.subarray(58)
    );
  });
});
