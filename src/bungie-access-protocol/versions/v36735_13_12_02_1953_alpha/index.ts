import { create, toBinary } from "@bufbuild/protobuf";
import * as clientConfig from "../../../generated/v36735_13_12_02_1953_alpha/client_config_pb";
import * as xetrov from "../../../generated/v36735_13_12_02_1953_alpha/xetrov_pb";
import type { BapBuild } from "../bap-build";
import { baselines } from "./baselines";
import * as checksums from "./checksums";
import { messages } from "./messages";
import { defineInspectionSchemas } from "./queuez/inspection";
import { definePeerSchemas } from "./queuez/peer";
import { defineRosterSchemas } from "./queuez/roster";
import { defineSelectCharacterSchemas } from "./queuez/select-character";
import { defineSelfSchemas } from "./queuez/self";
import { defineSharedSchemas } from "./queuez/shared";
import { defineUniverseSchemas } from "./queuez/universe";
import { alphaRoutes } from "./routes";
import { defineMessageSchemas } from "./schemas";

// What the alpha's own code and tests read off it, beside what the
// build-neutral code does.
export interface AlphaBapBuild extends BapBuild {
  checksums: typeof checksums;
  queuez: {
    inspection: ReturnType<typeof defineInspectionSchemas>;
    peer: ReturnType<typeof definePeerSchemas>;
    roster: ReturnType<typeof defineRosterSchemas>;
    selectCharacter: ReturnType<typeof defineSelectCharacterSchemas>;
    self: ReturnType<typeof defineSelfSchemas>;
    shared: ReturnType<typeof defineSharedSchemas>;
    universe: ReturnType<typeof defineUniverseSchemas>;
  };
  schemas: ReturnType<typeof defineMessageSchemas>;
}

// Defines every schema once; forBuild memoizes the result.
export function loadBapBuild(): AlphaBapBuild {
  const shared = defineSharedSchemas();
  const selectCharacter = defineSelectCharacterSchemas(shared);
  const self = defineSelfSchemas({
    ...shared,
    SelectCharacterRoster: selectCharacter.SelectCharacterRoster,
  });
  return {
    baselines,
    checksums,
    encodeClientConfigResponse: (cookie, socialMatchmakingId) =>
      toBinary(
        clientConfig.ClientConfigResponseSchema,
        create(clientConfig.ClientConfigResponseSchema, {
          cookie,
          socialMatchmakingId,
        })
      ),
    messages,
    // Xbox Live: account type 1, a u64 per platform id.
    platformAccount: { type: 1, idBytes: 8 },
    // The client sends login_character itself for a new character.
    newCharacterSignsIn: false,
    protos: { xetrov },
    queuez: {
      inspection: defineInspectionSchemas(shared),
      peer: definePeerSchemas(shared),
      roster: defineRosterSchemas(),
      selectCharacter,
      self,
      shared,
      universe: defineUniverseSchemas(shared),
    },
    routes: alphaRoutes(),
    schemas: defineMessageSchemas({ ...self, ...shared }),
    // The self primary lists the signed-in character alone.
    selfFamilyHasRoster: false,
    // The alpha's self character names no activity.
    selfNamesActivity: false,
    // Nothing answers a profile upload but the ack.
    selfDeltaAfterProfileUpload: false,
    // Kills add points toward the one-time reward of progression 0.
    progressionZero: { progression: 0 },
    // The alpha's unhandled requests get a status-only type-11 body.
    unhandledReply: () => null,
  };
}
