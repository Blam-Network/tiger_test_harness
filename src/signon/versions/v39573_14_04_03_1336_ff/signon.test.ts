import { fromBinary } from "@bufbuild/protobuf";
import { expect, it } from "vitest";
import { e_build } from "../../../builds";
import { ContentManifestSchema } from "../../../generated/v39573_14_04_03_1336_ff/content_manifest_pb";
import {
  EngineConfigurationSchema,
  SignonResponseSchema,
} from "../../../generated/v39573_14_04_03_1336_ff/signon_pb";
import { describeBuild } from "../../../test-support/build";

describeBuild(e_build.v39573_14_04_03_1336_ff, "ff signon", () => {
  it("names the manifest in the Engine Configuration, with no guid", async () => {
    const { SignonService } = await import("../../services/signon.service");
    const body = new SignonService().buildSuccessSignonResponse({
      bapIp: "127.0.0.1",
      bapPort: 37_000,
    });
    const response = fromBinary(SignonResponseSchema, body);
    expect(response.type).toBe(0);
    expect(response.successTicket?.bapIpv4).toBe(0x01_00_00_7f);
    expect(response.successTicket?.bapPort).toBe(37_000);
    const configuration = response.configuration;
    expect(configuration?.cookie).toBe(0n);
    expect(configuration?.socialMatchmakingId).toBe(0);
    const engine = fromBinary(
      EngineConfigurationSchema,
      configuration?.engineConfiguration ?? new Uint8Array()
    );
    expect(engine.content?.contentManifestUrl).not.toBe("");
    expect(engine.content?.$unknown).toBeUndefined();
  });

  it("encodes a bare manifest of offer and file name", async () => {
    const { signonBuild } = await import("..");
    const manifest = signonBuild().contentManifest;
    expect(manifest?.guid).toBeUndefined();
    const bytes = manifest?.encode([
      { name: "ps4_globals_0153_0", packageId: 0x153, headerValue: 1n },
    ]);
    const decoded = fromBinary(ContentManifestSchema, bytes ?? Buffer.alloc(0));
    expect(decoded.packages).toHaveLength(1);
    expect(decoded.packages[0].name).toBe("ps4_globals_0153_0");
    expect(decoded.packages[0].$unknown).toBeUndefined();
  });

  it("reads a request's build", async () => {
    const { signonBuild } = await import("..");
    const body = signonBuild().encodeRequest({
      build: e_build.v39573_14_04_03_1336_ff,
    });
    expect(signonBuild().decodeRequest(body).build).toBe(
      "39573.14.04.03.1336.ff"
    );
  });

  it("authenticates Demonware as the Alpha Trial's title on matchmaking 138", async () => {
    const { demonwareBuild } = await import("../../../demonware/versions");
    const dw = demonwareBuild();
    expect(dw.auth?.titleId).toBe(5474);
    expect(dw.lobbyProtocol).toBe(210);
    expect(dw.matchMakingService).toBe(138);
    expect(dw.lobbyPorts).toEqual([3074]);
  });
});
