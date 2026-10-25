import { describe, expect, it } from "vitest";
import "./commands";
import { scriptDebugger } from "./script-debugger";

// /teleport is the server's own console command: it moves players, which no
// script host can.
describe("the debugger's /teleport", () => {
  it("is offered, and checks its arguments", () => {
    expect(scriptDebugger.commandList().map((c) => c.verb)).toContain(
      "teleport"
    );
    const run = (line: string) =>
      (
        scriptDebugger as unknown as {
          extraCommands: Map<
            string,
            { run(args: string[], target: string): string }
          >;
        }
      ).extraCommands
        .get("teleport")
        ?.run(line.split(" ").filter(Boolean), "act_cosmo_m4_dome_c#1");
    expect(run("")).toMatch(/^usage/);
    expect(run("14.x")).toMatch(/^usage/);
    expect(run("14.2 spawn_control_room")).toBe(
      "no activity for act_cosmo_m4_dome_c#1"
    );
  });

  it("offers /kick, which needs an activity", () => {
    const kick = (
      scriptDebugger as unknown as {
        extraCommands: Map<
          string,
          { run(args: string[], target: string): string }
        >;
      }
    ).extraCommands.get("kick");
    expect(kick?.run([], "nowhere#1")).toBe("no activity for nowhere#1");
  });
});
