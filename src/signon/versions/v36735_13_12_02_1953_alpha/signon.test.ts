import { fromBinary } from "@bufbuild/protobuf";
import type { Request, Response } from "express";
import { expect, it, vi } from "vitest";
import { e_build } from "../../../builds";
import {
  SignonRequestSchema,
  SignonResponseSchema,
} from "../../../generated/v36735_13_12_02_1953_alpha/signon_pb";
import { describeBuild } from "../../../test-support/build";

function responseMock() {
  const status = vi.fn();
  const res = { end: vi.fn(), send: vi.fn(), set: vi.fn(), status };
  status.mockReturnValue(res);
  return { res: res as unknown as Response, status };
}

describeBuild(e_build.v36735_13_12_02_1953_alpha, "alpha signon", () => {
  it("signs on at the six XHTTP failover ports", async () => {
    const { resolveSignonHttpPorts } = await import("../../constants");
    expect(resolveSignonHttpPorts()).toEqual([
      32_000, 32_001, 32_004, 32_005, 32_008, 32_009,
    ]);
  });

  it("answers with a ticket and no Engine Configuration", async () => {
    const { SignonService } = await import("../../services/signon.service");
    const body = new SignonService().buildSuccessSignonResponse({
      bapIp: "127.0.0.1",
      bapPort: 37_000,
    });
    const response = fromBinary(SignonResponseSchema, body);
    expect(response.type).toBe(0);
    expect(response.successTicket?.bapPort).toBe(37_000);
    expect(response.successTicket?.bapIpv4).toBe(0x01_00_00_7f);
    // A field 4 would be left over as an unknown field.
    expect(response.$unknown).toBeUndefined();
  });

  it("reads a request's build", async () => {
    const { signonBuild } = await import("../../versions");
    const body = signonBuild().encodeRequest({
      build: "36735.13.12.02.1953.alpha",
    });
    expect(fromBinary(SignonRequestSchema, body).build).toBe(
      "36735.13.12.02.1953.alpha"
    );
    expect(signonBuild().decodeRequest(body).build).toBe(
      "36735.13.12.02.1953.alpha"
    );
  });

  it("has no content manifest: the controller answers 404", async () => {
    const { signonBuild } = await import("../../versions");
    expect(signonBuild().contentManifest).toBeUndefined();
    const { ContentManifestController } = await import(
      "../../controllers/content-manifest.controller"
    );
    const { res, status } = responseMock();
    new ContentManifestController().get(res);
    expect(status).toHaveBeenCalledWith(404);
  });

  it("has no Demonware auth: the controller answers 404", async () => {
    const { DemonwareAuthController } = await import(
      "../../controllers/demonware-auth.controller"
    );
    const { res, status } = responseMock();
    new DemonwareAuthController().auth(
      { body: Buffer.alloc(0) } as Request,
      res
    );
    expect(status).toHaveBeenCalledWith(404);
  });
});
