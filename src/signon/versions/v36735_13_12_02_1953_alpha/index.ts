import { create, fromBinary, toBinary } from "@bufbuild/protobuf";
import * as signon from "../../../generated/v36735_13_12_02_1953_alpha/signon_pb";
import type { SignonBuild } from "../signon-build";

// The client signs on over the XHTTP failover ports (hosts.json / title DNS).
const SIGNON_HTTP_PORTS = [
  32_000, 32_001, 32_004, 32_005, 32_008, 32_009,
] as const;

// The response is a ticket and nothing else: no Engine Configuration, so no
// content manifest and no guid.
export function loadSignonBuild(): SignonBuild {
  return {
    decodeRequest: (body) => fromBinary(signon.SignonRequestSchema, body),
    encodeRequest: (request) =>
      Buffer.from(
        toBinary(
          signon.SignonRequestSchema,
          create(signon.SignonRequestSchema, request)
        )
      ),
    encodeSuccessResponse: (ticket) =>
      Buffer.from(
        toBinary(
          signon.SignonResponseSchema,
          create(signon.SignonResponseSchema, {
            type: 0,
            successTicket: ticket,
          })
        )
      ),
    ports: SIGNON_HTTP_PORTS,
  };
}
