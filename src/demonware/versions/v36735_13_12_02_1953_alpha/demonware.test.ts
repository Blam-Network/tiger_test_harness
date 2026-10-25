import { expect, it } from "vitest";
import { e_build } from "../../../builds";
import { describeBuild } from "../../../test-support/build";

describeBuild(e_build.v36735_13_12_02_1953_alpha, "alpha demonware", () => {
  it("listens on the lobby ports 1020 and 1011", async () => {
    const { resolveDemonwareLobbyPorts } = await import("../../config");
    expect(resolveDemonwareLobbyPorts()).toEqual([1020, 1011]);
  });

  it("has no auth3", async () => {
    const { demonwareBuild } = await import("..");
    expect(demonwareBuild().auth).toBeUndefined();
  });
});
