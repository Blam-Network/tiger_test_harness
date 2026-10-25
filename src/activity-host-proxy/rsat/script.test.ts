import { describe, expect, it } from "vitest";
import {
  buildRequestScriptUpdatesRsat,
  parseRequestScriptUpdates,
} from "./script";

describe("script message helpers", () => {
  it("round-trips RequestScriptUpdates toggle", () => {
    expect(
      parseRequestScriptUpdates(buildRequestScriptUpdatesRsat(true))
    ).toEqual({ toggle: true });
    expect(
      parseRequestScriptUpdates(buildRequestScriptUpdatesRsat(false))
    ).toEqual({ toggle: false });
    expect(parseRequestScriptUpdates(Buffer.alloc(0))).toBeNull();
  });
});
