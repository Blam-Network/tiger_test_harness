import { fnv1 } from "@blamnetwork/bullshcript/destiny1/common";
import { expect, it } from "vitest";
import { e_build } from "../../../builds";
import { describeBuild, hasPackages } from "../../../test-support/build";
import { e_server_message_network_id as neutral } from "../../rsat/constants";
import { e_server_message_network_id } from "./server-message-ids";

const BUILD = e_build.v36735_13_12_02_1953_alpha;
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

it("names all 56 messages of the table", () => {
  expect(named).toHaveLength(56);
  expect(
    e_server_message_network_id._server_message_network_id_director_get_activity_list
  ).toBe(101);
  expect(
    e_server_message_network_id._server_message_network_id_inventory_destroy_item
  ).toBe(401);
});

describeBuild(BUILD, "alpha server message table", () => {
  it.skipIf(!hasPackages(BUILD))(
    "names every message by its name hash and network id",
    async () => {
      const {
        serverMessageByNameHash,
        serverMessageByNetworkId,
        serverMessages,
      } = await import("../../../content/server-messages");
      expect(serverMessages()).toHaveLength(named.length);
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
});
