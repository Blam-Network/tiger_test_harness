import { describe, expect, it } from "vitest";
import {
  buildIpDiscoveryReply,
  buildNatTypeReply,
  parseNatRequest,
} from "./nat-discovery";

// Shapes from the PS4 alpha.
describe("Demonware NAT discovery", () => {
  it("reads the two requests", () => {
    expect(parseNatRequest(Buffer.from([30, 2, 0]))).toEqual({
      kind: "ip_discovery",
    });
    expect(parseNatRequest(Buffer.from([20, 2, 0, 3]))).toEqual({
      kind: "nat_type",
      test: 3,
    });
    expect(parseNatRequest(Buffer.from([20, 1, 0, 3]))).toBeUndefined();
  });

  it("tells the client its own address", () => {
    expect(
      buildIpDiscoveryReply({ address: "127.0.0.3", port: 3074 }).toString(
        "hex"
      )
    ).toBe("1f02007f000003020c");
  });

  it("names the secondary address after the client's", () => {
    expect(
      buildNatTypeReply(
        { address: "127.0.0.3", port: 3074 },
        { address: "127.0.0.1", port: 3075 }
      ).toString("hex")
    ).toBe("1502007f000003020c7f000001030c");
  });
});
