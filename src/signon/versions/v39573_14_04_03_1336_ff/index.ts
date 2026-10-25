import { create, fromBinary, toBinary } from "@bufbuild/protobuf";
import * as contentManifest from "../../../generated/v39573_14_04_03_1336_ff/content_manifest_pb";
import * as signon from "../../../generated/v39573_14_04_03_1336_ff/signon_pb";
import type { SignonBuild } from "../signon-build";

// The client signs on with an HTTPS POST to
// https://www{1-8}.signon.{deadorbit,gravityshavings}.net/SignOn?platform=orbis
// (sub_761400); the native client's host overrides send it as plain HTTP to
// our host on 443. Its ticket field is the PSN OAuth reply.
const SIGNON_HTTP_PORTS = [443] as const;

// Signon response field 4. The decoder requires the cookie and the social
// matchmaking id; the Engine Configuration names the manifest, no guid.
function configuration(contentManifestUrl: string) {
  const { EngineConfigurationSchema, SignonConfigurationSchema } = signon;
  const engineConfiguration = create(EngineConfigurationSchema, {
    content: { contentManifestUrl },
  });
  return create(SignonConfigurationSchema, {
    cookie: 0n,
    socialMatchmakingId: 0,
    engineConfiguration: toBinary(
      EngineConfigurationSchema,
      engineConfiguration
    ),
  });
}

export function loadSignonBuild(): SignonBuild {
  return {
    // The manifest is required: the client stops without a url (0x8C380F). It
    // reads a bare protobuf only with its signature check cleared, and a
    // package is only its offer and file name.
    contentManifest: {
      encode(packages) {
        const { ContentManifestSchema } = contentManifest;
        return Buffer.from(
          toBinary(
            ContentManifestSchema,
            create(ContentManifestSchema, {
              packages: packages.map((p) => ({ offerId: 0, name: p.name })),
            })
          )
        );
      },
    },
    decodeRequest: (body) => fromBinary(signon.SignonRequestSchema, body),
    encodeRequest: (request) =>
      Buffer.from(
        toBinary(
          signon.SignonRequestSchema,
          create(signon.SignonRequestSchema, request)
        )
      ),
    encodeSuccessResponse: (ticket, contentManifestUrl) =>
      Buffer.from(
        toBinary(
          signon.SignonResponseSchema,
          create(signon.SignonResponseSchema, {
            type: 0,
            successTicket: ticket,
            configuration: contentManifestUrl
              ? configuration(contentManifestUrl)
              : undefined,
          })
        )
      ),
    ports: SIGNON_HTTP_PORTS,
  };
}
