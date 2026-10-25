import { create, fromBinary, toBinary } from "@bufbuild/protobuf";
import * as contentManifest from "../../../generated/v40662_14_05_19_1414_pubalpha/content_manifest_pb";
import * as signon from "../../../generated/v40662_14_05_19_1414_pubalpha/signon_pb";
import type { SignonBuild } from "../signon-build";

const CONTENT_GUID = "00000000-0000-0000-0000-000000040662";

// The client signs on with an HTTPS POST to
// https://www{1-8}.signon.{deadorbit,gravityshavings}.net/SignOn?platform=orbis.
// The native client's host overrides send it as plain HTTP to our host on
// the port the title asked for, so https lands on 443.
const SIGNON_HTTP_PORTS = [443] as const;

// Signon response field 4. The decoder requires the cookie and the social
// matchmaking id (0x4CE300); the Engine Configuration names the content.
function configuration(contentManifestUrl: string) {
  const { EngineConfigurationSchema, SignonConfigurationSchema } = signon;
  const engineConfiguration = create(EngineConfigurationSchema, {
    content: { contentManifestUrl, contentGuid: CONTENT_GUID },
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
    // The manifest is required: the client stops without a url (0xB85D4A).
    // It reads a bare protobuf only with its signature check cleared.
    contentManifest: {
      encode(packages) {
        const { ContentManifestSchema } = contentManifest;
        return Buffer.from(
          toBinary(
            ContentManifestSchema,
            create(ContentManifestSchema, {
              packages: packages.map((p) => ({
                offerId: 0,
                name: p.name,
                packageId: p.packageId,
                headerValue: p.headerValue,
              })),
              guid: CONTENT_GUID,
            })
          )
        );
      },
      guid: CONTENT_GUID,
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
