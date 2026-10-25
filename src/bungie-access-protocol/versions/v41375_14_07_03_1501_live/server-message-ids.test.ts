import { fnv1 } from "@blamnetwork/bullshcript/destiny1/common";
import { expect, it } from "vitest";
import {
  serverMessageByNameHash,
  serverMessageByNetworkId,
  serverMessages,
} from "../../../content/server-messages";
import { describeWithPackages } from "../../../test-support/build";
import { e_server_message_network_id } from "./server-message-ids";
import { ZERO_REPLY_BODIES } from "./zero-replies";

const PREFIX = "_server_message_network_id_";

describeWithPackages("server message network ids", () => {
  it("names every message by its name hash and network id", () => {
    const named = Object.entries(e_server_message_network_id).filter(
      ([, value]) => typeof value === "number"
    ) as [string, number][];
    expect(named.length).toBeGreaterThan(0);
    for (const [key, networkId] of named) {
      const name = key.slice(PREFIX.length);
      const message = serverMessageByNetworkId(networkId);
      expect(message?.nameHash, name).toBe(fnv1(name));
      expect(serverMessageByNameHash(fnv1(name))?.networkId, name).toBe(
        networkId
      );
    }
  });

  it("has a zero reply body for every message the table has", () => {
    const ids = serverMessages().map((m) => m.networkId);
    expect(ids.length).toBe(66);
    expect(
      Object.keys(ZERO_REPLY_BODIES)
        .map(Number)
        .sort((a, b) => a - b)
    ).toEqual([...ids].sort((a, b) => a - b));
  });
});
