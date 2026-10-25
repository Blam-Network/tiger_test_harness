import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { SignonService } from "../services/signon.service";
import { signonBuild } from "../versions";
import { SignonController } from "./signon.controller";

function makeController() {
  return new SignonController(new SignonService());
}

function respond(controller: SignonController, req: Partial<Request>) {
  const status = vi.fn();
  const res = { send: vi.fn(), set: vi.fn(), status };
  status.mockReturnValue(res);
  controller.getSignon(req as Request, res as unknown as Response);
  return status;
}

function bodyWithBuild(build: string): Buffer {
  return signonBuild().encodeRequest({ build });
}

describe("signon build check", () => {
  it("serves the build in the query", () => {
    const status = respond(makeController(), {
      body: Buffer.alloc(0),
      method: "GET",
      query: { build: "41375.14.07.03.1501.live" },
    });
    expect(status).toHaveBeenCalledWith(200);
  });

  it("refuses the build in the query when it is not ours", () => {
    const status = respond(makeController(), {
      body: Buffer.alloc(0),
      method: "GET",
      query: { build: "1.0.0.0.0.other" },
    });
    expect(status).toHaveBeenCalledWith(403);
  });

  it("falls back to the build in the request body", () => {
    const controller = makeController();
    expect(
      respond(controller, {
        body: bodyWithBuild("1.0.0.0.0.other"),
        method: "POST",
        query: {},
      })
    ).toHaveBeenCalledWith(403);
    expect(
      respond(controller, {
        body: bodyWithBuild("41375.14.07.03.1501.live"),
        method: "POST",
        query: {},
      })
    ).toHaveBeenCalledWith(200);
  });

  it("serves a request that does not say", () => {
    const status = respond(makeController(), {
      body: Buffer.alloc(0),
      method: "GET",
      query: {},
    });
    expect(status).toHaveBeenCalledWith(200);
  });
});
