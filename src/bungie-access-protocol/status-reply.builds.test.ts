import { decodeServerMessage } from "@blamnetwork/rsat";
import { expect, it } from "vitest";
import { buildFolder, e_build } from "../builds";
import { describeEachBuild } from "../test-support/build";
import { bapOf } from "../test-support/build-modules";

// The builds with a world-server reply table (the alpha has none).
const BUILDS = [
  e_build.v38464_14_02_28_1027_betath,
  e_build.v39573_14_04_03_1336_ff,
  e_build.v40662_14_05_19_1414_pubalpha,
  e_build.v41375_14_07_03_1501_live,
];

// A nid the build's reply table lacks.
const MISSING_NID: Partial<Record<e_build, number>> = {
  [e_build.v41375_14_07_03_1501_live]: 101,
};

describeEachBuild(
  "world-server status-0 fallback",
  (build) => {
    const folder = buildFolder(build);

    it("equals the hand-built 105 ack", async () => {
      const { statusReplyBody } = await import(
        `./versions/${folder}/zero-replies.ts`
      );
      const { buildDirectorCompleteBinkActivityResponseBody } = await import(
        `./versions/${folder}/messages.ts`
      );
      expect(statusReplyBody(105)).toEqual(
        buildDirectorCompleteBinkActivityResponseBody()
      );
    });

    it("decodes with the nid's response schema", async () => {
      const { statusReplyBody } = await import(
        `./versions/${folder}/zero-replies.ts`
      );
      const body = statusReplyBody(505);
      expect(body).not.toBeNull();
      const { networkId, value } = decodeServerMessage(
        body ?? Buffer.alloc(0),
        (await bapOf[build]()).schemas.SignoutCharacterResponse
      );
      expect(networkId).toBe(505);
      expect(value).toBeDefined();
    });

    it("has no reply for a nid the table does not have", async () => {
      const { statusReplyBody } = await import(
        `./versions/${folder}/zero-replies.ts`
      );
      expect(statusReplyBody(MISSING_NID[build] ?? 102)).toBeNull();
    });
  },
  BUILDS
);
