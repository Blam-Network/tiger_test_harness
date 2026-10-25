import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";

// The script debugger's socket: DAP requests in, responses and events out.
const PORT = 18_099;

describe("debug server /debug/dap", () => {
  let server: Server;

  beforeAll(async () => {
    process.env.WEB_TIGER_DEBUG_PORT = String(PORT);
    const { createDebugServer } = await import("./debug-server");
    server = await createDebugServer();
    // the first import of the server pulls bullshcript's whole build in
  });

  afterAll(() => {
    server?.close();
  });

  it("answers initialize and lists targets", async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/debug/dap`);
    const messages: { command?: string; event?: string; body?: unknown }[] = [];
    await new Promise<void>((resolve, reject) => {
      ws.on("open", () => resolve());
      ws.on("error", reject);
    });
    const done = new Promise<void>((resolve) => {
      ws.on("message", (data) => {
        messages.push(JSON.parse(String(data)));
        if (messages.some((m) => m.command === "tiger/targets")) {
          resolve();
        }
      });
    });
    ws.send(JSON.stringify({ seq: 1, type: "request", command: "initialize" }));
    ws.send(
      JSON.stringify({ seq: 2, type: "request", command: "tiger/players" })
    );
    ws.send(
      JSON.stringify({ seq: 3, type: "request", command: "tiger/targets" })
    );
    await done;
    ws.close();
    expect(messages.find((m) => m.command === "initialize")).toMatchObject({
      body: { supportsLogPoints: true },
    });
    expect(messages.some((m) => m.event === "initialized")).toBe(true);
    expect(messages.find((m) => m.command === "tiger/players")).toMatchObject({
      body: { players: [] },
    });
    expect(messages.find((m) => m.command === "tiger/targets")).toMatchObject({
      body: { targets: [] },
    });
  });
});
