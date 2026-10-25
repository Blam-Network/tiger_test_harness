import { event_message } from "@blamnetwork/datamine";
import { BapMessageType } from "../../lib/bap-wire/constants";
import { buildDirectorEnterOrbitResponseBody } from "../rsat";
import type { WorldServerHandler } from "./context";

// The reply to director_enter_orbit: the universe server_object.
export const directorEnterOrbitAck: WorldServerHandler = (ctx, message) => {
  const body = buildDirectorEnterOrbitResponseBody();
  ctx.send({
    msgType: BapMessageType.ClientToWorldServerResponse,
    sequence: message.sequence,
    body,
  });
  event_message(
    "networking:bap:world: director_enter_orbit ack (seq %x, body %dB)",
    message.sequence,
    body.length
  );
};

// The ack, then the self pushes that make the director rebuild its statuses.
// The reply's universe server_object (clock, flag list, debug unlock) clears
// the unlock flag cache but doesn't mark the director statuses dirty; only an
// applied family-4 character update does. Push self again so the statuses are
// rebuilt from the new flags, then again once they are (scheduleOrbitRefresh).
export const directorEnterOrbit: WorldServerHandler = (
  ctx,
  message,
  networkId
) => {
  directorEnterOrbitAck(ctx, message, networkId);
  if (ctx.character()) {
    ctx.flushActivityComplete("director_enter_orbit");
    ctx.pushSelfUpdate("director_enter_orbit");
    ctx.scheduleOrbitRefresh();
  }
};
