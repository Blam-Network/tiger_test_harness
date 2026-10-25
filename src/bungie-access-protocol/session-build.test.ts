import { Socket } from "node:net";
import { e_event_level, events_dispose } from "@blamnetwork/datamine";
import { create, toBinary } from "@bufbuild/protobuf";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryCharacterStore } from "../investment/character-store";
import { BapMessageType } from "../lib/bap-wire/constants";
import { captureEvents } from "../test-support/capture-events";
import { BungieAccessProtocolSession } from "./session";
import { liveBap } from "./versions/v41375_14_07_03_1501_live/live-bap";

const { ClientToXetrovNotificationSchema, XetrovClientEventSchema } =
  liveBap().protos.xetrov;

function xetrovMessage(build: string | undefined) {
  const event = create(XetrovClientEventSchema, build ? { build } : {});
  const body = Buffer.from(
    toBinary(
      ClientToXetrovNotificationSchema,
      create(ClientToXetrovNotificationSchema, {
        reserved1: 1,
        reserved2: 2,
        event: toBinary(XetrovClientEventSchema, event),
      })
    )
  );
  return {
    body,
    msgType: BapMessageType.ClientToXetrovNotification,
    sequence: 1,
  };
}

afterEach(() => events_dispose());

function makeSession() {
  const captured = captureEvents();
  const socket = new Socket();
  const destroy = vi.spyOn(socket, "destroy");
  const session = new BungieAccessProtocolSession(
    socket,
    new MemoryCharacterStore()
  );
  return { captured, destroy, session };
}

describe("xetrov client build check", () => {
  it("leaves a matching client connected", () => {
    const { captured, destroy, session } = makeSession();
    session["handleMessage"](
      xetrovMessage("41375.14.07.03.1501.live__release_internal")
    );
    expect(destroy).not.toHaveBeenCalled();
    expect(captured.at(e_event_level.error)).toHaveLength(0);
  });

  it("closes the socket of a client on another build", () => {
    const { captured, destroy, session } = makeSession();
    session["handleMessage"](xetrovMessage("1.0.0.0.0.other"));
    expect(destroy).toHaveBeenCalled();
    expect(captured.at(e_event_level.error)).toHaveLength(1);
  });

  it("skips notifications that carry no build", () => {
    const { destroy, session } = makeSession();
    session["handleMessage"](xetrovMessage(undefined));
    expect(destroy).not.toHaveBeenCalled();
    session["handleMessage"](xetrovMessage("1.0.0.0.0.other"));
    expect(destroy).toHaveBeenCalled();
  });

  it("checks only the first notification that carries a build", () => {
    const { destroy, session } = makeSession();
    session["handleMessage"](xetrovMessage("41375.14.07.03.1501.live"));
    session["handleMessage"](xetrovMessage("1.0.0.0.0.other"));
    expect(destroy).not.toHaveBeenCalled();
  });
});
