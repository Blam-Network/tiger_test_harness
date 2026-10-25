import { event_message } from "@blamnetwork/datamine";
import { BapMessageType } from "../../lib/bap-wire/constants";
import { buildFetchFamilyResponseBody, parseFetchFamilyRequest } from "../rsat";
import type { WorldServerHandler } from "./context";

export const fetchFamily: WorldServerHandler = async (ctx, message) => {
  const req = parseFetchFamilyRequest(message.body);
  const baseline = req
    ? await ctx.buildBaselineForFamily(req.familyType, req.rootSoid)
    : null;
  const body = buildFetchFamilyResponseBody(0, baseline?.body ?? null);
  ctx.send({
    msgType: BapMessageType.ClientToWorldServerResponse,
    sequence: message.sequence,
    body,
  });
  event_message(
    "networking:bap:world: fetch_family rsp (seq %x, status=0, req=%s, %s, body %dB)",
    message.sequence,
    req
      ? `family ${req.familyType} root 0x${req.rootSoid.toString(16)}`
      : "unparsed",
    baseline
      ? `${baseline.label} baseline ${baseline.body.length}B`
      : "no baseline",
    body.length
  );
};
