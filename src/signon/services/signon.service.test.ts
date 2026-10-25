import { e_event_level, events_dispose } from "@blamnetwork/datamine";
import { afterEach, describe, expect, it } from "vitest";
import { captureEvents } from "../../test-support/capture-events";
import { SignonService } from "./signon.service";

afterEach(() => events_dispose());

function makeService() {
  return { captured: captureEvents(), service: new SignonService() };
}

describe("signon client build check", () => {
  it("serves a matching build and says so once", () => {
    const { captured, service } = makeService();
    expect(service.acceptsClientBuild("41375.14.07.03.1501.live")).toBe(true);
    expect(service.acceptsClientBuild("41375.14.07.03.1501.live")).toBe(true);
    expect(captured.at(e_event_level.message)).toHaveLength(1);
    expect(captured.at(e_event_level.error)).toHaveLength(0);
  });

  it("serves a request that does not say, with a warning", () => {
    const { captured, service } = makeService();
    expect(service.acceptsClientBuild(undefined)).toBe(true);
    expect(captured.at(e_event_level.warning)).toHaveLength(1);
  });

  it("refuses another build and logs an error", () => {
    const { captured, service } = makeService();
    expect(service.acceptsClientBuild("1.0.0.0.0.other")).toBe(false);
    expect(captured.at(e_event_level.error)).toHaveLength(1);
  });
});
