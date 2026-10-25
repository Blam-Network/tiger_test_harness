import { event_warning } from "@blamnetwork/datamine";
import { BapMessageType } from "../../lib/bap-wire/constants";
import { bapBuild } from "../versions";
import type { WorldServerHandler } from "./context";

// Body hex kept in the log: talent_grid_bind_ability (803, never sent)
// and anything else unhandled. The client decodes every reply with the
// nid's response schema and drops BAP when that fails, so a build whose
// client does that answers with that schema at status 0 and everything else
// zero or absent (BapBuild.unhandledReply); the others get an empty type-11
// body.
export const unhandledRequest: WorldServerHandler = (
  ctx,
  message,
  networkId
) => {
  const reply = bapBuild().unhandledReply(networkId);
  event_warning(
    "networking:bap:world: req network-id=%d (%dB) — no handler yet; sending %s body=%s",
    networkId,
    message.body.length,
    reply ? `the status-0 reply (${reply.length}B)` : "an empty type-11 body",
    message.body.subarray(0, 96).toString("hex")
  );
  if (reply) {
    ctx.reply(
      message,
      reply,
      `world-server network-id ${networkId} status-0 reply`
    );
    return;
  }
  ctx.replyStatusOnly(
    message,
    BapMessageType.ClientToWorldServerResponse,
    `world-server network-id ${networkId}`
  );
};
