import { create, toBinary } from "@bufbuild/protobuf";
import * as clientConfig from "../../../generated/v41375_14_07_03_1501_live/client_config_pb";
import * as xetrov from "../../../generated/v41375_14_07_03_1501_live/xetrov_pb";
import type { BapBuild } from "../bap-build";
import { baselines } from "./baselines";
import * as checksums from "./checksums";
import { messages } from "./messages";
import { defineInspectionSchemas } from "./queuez/inspection";
import { definePeerSchemas } from "./queuez/peer";
import { defineRosterSchemas } from "./queuez/roster";
import { defineSelectCharacterSchemas } from "./queuez/select-character";
import { defineSelfSchemas } from "./queuez/self";
import { liveRoutes } from "./routes";
import { defineSchemas } from "./schemas";
import * as unlockPolicy from "./unlock-policy";
import * as zeroReplies from "./zero-replies";

// What the live build's own code and tests read off it, beside what the
// build-neutral code does.
export interface LiveBapBuild extends BapBuild {
  protos: { xetrov: typeof xetrov };
  queuez: {
    inspection: ReturnType<typeof defineInspectionSchemas>;
    peer: ReturnType<typeof definePeerSchemas>;
    roster: ReturnType<typeof defineRosterSchemas>;
    selectCharacter: ReturnType<typeof defineSelectCharacterSchemas>;
    self: ReturnType<typeof defineSelfSchemas>;
  };
  schemas: ReturnType<typeof defineSchemas>;
}

// Defines every schema once; forBuild memoizes the result.
export function loadBapBuild(): LiveBapBuild {
  const self = defineSelfSchemas();
  const selectCharacter = defineSelectCharacterSchemas(self);
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
    // The create screen only moves on once the self family shows a signed-in
    // character, and nothing on this client sends login_character for a new
    // character.
    newCharacterSignsIn: true,
    protos: { xetrov },
    queuez: {
      inspection: defineInspectionSchemas(selectCharacter, self),
      peer: definePeerSchemas(selectCharacter, self),
      roster: defineRosterSchemas(self),
      selectCharacter,
      self,
    },
    routes: liveRoutes(),
    schemas: defineSchemas(self),
    // The select list walks the self primary's roster.
    selfFamilyHasRoster: true,
    // The client chains to an activity's next one when the self character
    // says it was finished.
    selfNamesActivity: true,
    // The real server answers every 702 with a self delta (2.3.1 capture).
    selfDeltaAfterProfileUpload: true,
    unhandledReply: zeroReplies.statusReplyBody,
    prologueMissionActivity: unlockPolicy.PROLOGUE_MISSION_ACTIVITY,
  };
}
