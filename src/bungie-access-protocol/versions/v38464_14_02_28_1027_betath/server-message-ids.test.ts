import { fnv1 } from "@blamnetwork/bullshcript/destiny1/common";
import { expect, it } from "vitest";
import { e_build } from "../../../builds";
import { describeBuild, hasPackages } from "../../../test-support/build";
import {
  catalogEncode,
  readRsatCatalog,
  sampleValue,
} from "../../../test-support/rsat-catalog";
import {
  hasRsatDescriptors,
  rsatDescriptorsPath,
} from "../../../test-support/rsat-descriptors";
import { e_server_message_network_id as neutral } from "../../rsat/constants";
import { e_server_message_network_id } from "./server-message-ids";
import { ZERO_REPLY_BODIES } from "./zero-replies";

const BUILD = e_build.v38464_14_02_28_1027_betath;
const PREFIX = "_server_message_network_id_";

const named = Object.entries(e_server_message_network_id).filter(
  ([, value]) => typeof value === "number"
) as [string, number][];

// The ids the build-neutral code routes on are this build's, where it has them.
it("agrees with the ids the neutral code routes on", () => {
  for (const [key, networkId] of Object.entries(neutral)) {
    if (typeof networkId !== "number") {
      continue;
    }
    const own = (
      e_server_message_network_id as Record<string, number | string>
    )[key];
    if (own !== undefined) {
      expect(own, key).toBe(networkId);
    }
  }
});

describeBuild(BUILD, "38464 server message table", () => {
  it.skipIf(!hasPackages(BUILD))(
    "names every message by its name hash and network id",
    async () => {
      const { serverMessageByNameHash, serverMessageByNetworkId } =
        await import("../../../content/server-messages");
      for (const [key, networkId] of named) {
        const name = key.slice(PREFIX.length);
        expect(serverMessageByNetworkId(networkId)?.nameHash, name).toBe(
          fnv1(name)
        );
        expect(serverMessageByNameHash(fnv1(name))?.networkId, name).toBe(
          networkId
        );
      }
    }
  );

  // Each zero reply is the status-0 body of the response schema the table
  // names, as the eboot's catalog encodes it.
  it.skipIf(!(hasPackages(BUILD) && hasRsatDescriptors(BUILD)))(
    "has the catalog's zero reply body for every message the table has",
    async () => {
      const { serverMessages } = await import(
        "../../../content/server-messages"
      );
      const catalog = readRsatCatalog(rsatDescriptorsPath(BUILD));
      const messages = serverMessages();
      expect(
        Object.keys(ZERO_REPLY_BODIES)
          .map(Number)
          .sort((a, b) => a - b)
      ).toEqual(messages.map((m) => m.networkId).sort((a, b) => a - b));
      for (const { networkId, responseSchema } of messages) {
        const id = (responseSchema >>> 0).toString(16);
        const { bits, bytes } = catalogEncode(
          catalog,
          responseSchema,
          sampleValue(catalog, id, "zero")
        );
        expect(ZERO_REPLY_BODIES[networkId], `${networkId}`).toEqual({
          bits,
          hex: bytes.toString("hex"),
        });
      }
    }
  );
});
