import { event_warning } from "@blamnetwork/datamine";
import type { RawBapMessage } from "../../lib/bap-wire/codec";
import { bapBuild } from "../versions";
import type { WorldServerContext } from "./context";
import { unhandledRequest } from "./zero-reply";

// One client_to_world_server request, routed by the network id in its body
// through the active build's routes. A nid with no route gets the build's
// reply to an unhandled request (zero-reply.ts).
export async function handleWorldServerRequest(
  ctx: WorldServerContext,
  message: RawBapMessage
): Promise<void> {
  const networkId =
    message.body.length >= 2 ? message.body.readUInt16BE(0) : -1;
  const route = bapBuild().routes.get(networkId);
  if (!route) {
    await unhandledRequest(ctx, message, networkId);
    return;
  }
  if (route.absorb === undefined) {
    await route.handler(ctx, message, networkId);
    return;
  }
  try {
    await route.handler(ctx, message, networkId);
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    event_warning(
      "networking:bap:world: %s FAILED, absorbed to keep connection alive: %s",
      route.absorb,
      m
    );
  }
}
