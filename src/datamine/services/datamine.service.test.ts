import { readdirSync } from "node:fs";
import { events_dispose } from "@blamnetwork/datamine";
import { afterEach, describe, expect, it } from "vitest";
import { captureEvents } from "../../test-support/capture-events";
import { DatamineService } from "./datamine.service";

describe("the datamine upload endpoint", () => {
  afterEach(() => {
    events_dispose();
  });

  it("logs an upload it cannot read and writes no file", async () => {
    const { texts } = captureEvents();
    const before = readdirSync(process.cwd()).sort();
    const body = Buffer.from("not a datamine upload");
    const result = await new DatamineService().absorbTicketDrop(body, {
      method: "PUT",
    });
    expect(result).toEqual({ ok: true, bytes: body.length });
    expect(texts()).toEqual([
      expect.stringMatching(/^datamine: PUT \/ticket_drop not multipart/),
    ]);
    expect(readdirSync(process.cwd()).sort()).toEqual(before);
  });
});
