import { BapMessageType } from "../../../lib/bap-wire/constants";
import type { WorldServerHandler } from "../../world-server/context";
import {
  buildDirectorCompleteBinkActivityResponseBody,
  parseDirectorCompleteBinkActivityRequest,
} from "./messages";
import { statusReplyBody } from "./zero-replies";

// The prologue video ended; the client now launches the prologue activity's
// next one (activity 2 -> act_cosmo_m1_dome_a) itself. Flag 1718 stays on until
// the mission is finished (completeActivity): a character that backs out comes
// back to it.
export const directorCompleteBinkActivity: WorldServerHandler = (
  ctx,
  message
) => {
  const character = ctx.character();
  // Needs the schema'd status ack: an empty type-11 body fails the
  // client's decode and it drops BAP ("centipede").
  const activityIndex = parseDirectorCompleteBinkActivityRequest(message.body);
  ctx.reply(
    message,
    buildDirectorCompleteBinkActivityResponseBody(),
    `director_complete_bink_activity ack activity=${activityIndex ?? "unparsed"}` +
      (character?.prologuePending
        ? ` prologue mission next for 0x${character.soid.toString(16)}`
        : "")
  );
};

// The client is leaving an activity for orbit (it sends this as it leaves the
// ended activity, 14 s after the lifetime ended; retail capture). The reply is
// the status-0 shape; an activity completion the host reported goes out right
// after it, before director_enter_orbit.
export const fetchUniverse: WorldServerHandler = (ctx, message, networkId) => {
  const reply = statusReplyBody(networkId);
  if (reply) {
    ctx.reply(message, reply, "fetch_universe ack");
  } else {
    ctx.replyStatusOnly(
      message,
      BapMessageType.ClientToWorldServerResponse,
      "fetch_universe"
    );
  }
  ctx.flushActivityComplete("fetch_universe");
};
