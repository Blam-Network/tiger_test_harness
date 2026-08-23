import { create, toBinary } from "@bufbuild/protobuf";
import { ClientConfigResponseSchema } from "../generated/client_config_pb";

/** Guest decoder requires ≥24 bytes; trailing zeros are fine (tag 0 ends the scan). */
const CLIENT_CONFIG_RESPONSE_MIN_BYTES = 24;

export function buildClientConfigResponseBody(
  cookie = 1n,
  socialMatchmakingId = 0
): Buffer {
  const message = create(ClientConfigResponseSchema, {
    cookie,
    socialMatchmakingId,
  });
  const pb = Buffer.from(toBinary(ClientConfigResponseSchema, message));
  if (pb.length >= CLIENT_CONFIG_RESPONSE_MIN_BYTES) {
    return pb;
  }
  return Buffer.concat([
    pb,
    Buffer.alloc(CLIENT_CONFIG_RESPONSE_MIN_BYTES - pb.length, 0),
  ]);
}
