import * as http from "node:http";
import { DapSession } from "@blamnetwork/bullshcript/destiny1/debug";
import { event_message, event_warning } from "@blamnetwork/datamine";
import { WebSocketServer } from "ws";
import { resolveDebugHttpPort } from "../env";
import "./commands";
import "./debug-players";
import "./debug-server-info";
import { scriptDebugger } from "./script-debugger";

// The script debugger's socket for the game server:
//
//   ws://127.0.0.1:8099/debug/dap   DAP + tiger/*, one JSON message per frame
//
// Loopback only: it exposes live session state.
const DEBUG_HTTP_PORT = resolveDebugHttpPort();
const DEBUG_HOSTNAME = "127.0.0.1";

export function createDebugServer(): Promise<http.Server> {
  const server = http.createServer((_req, res) => {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found - the script debugger connects to ws /debug/dap");
  });

  const dap = new WebSocketServer({ noServer: true });
  dap.on("connection", (ws) => {
    const session = new DapSession(scriptDebugger, (message) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(message, bigintAsHex));
      }
    });
    event_message("debug: Script debugger attached");
    ws.on("message", (data) => {
      try {
        session.handle(JSON.parse(String(data)));
      } catch (error) {
        event_warning(
          "debug: Script debugger: bad message: %s",
          error instanceof Error ? error.message : String(error)
        );
      }
    });
    ws.on("close", () => {
      session.close();
      event_message("debug: Script debugger detached");
    });
  });

  server.on("upgrade", (req, socket, head) => {
    if ((req.url ?? "").split("?")[0] !== "/debug/dap") {
      socket.destroy();
      return;
    }
    dap.handleUpgrade(req, socket, head, (ws) =>
      dap.emit("connection", ws, req)
    );
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(DEBUG_HTTP_PORT, DEBUG_HOSTNAME, () => {
      event_message(
        "debug: Script debugger on ws://%s:%d/debug/dap",
        DEBUG_HOSTNAME,
        DEBUG_HTTP_PORT
      );
      resolve(server);
    });
  });
}

// Row state carries bigints (character keys, FAH ids); JSON has none.
function bigintAsHex(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? `0x${value.toString(16)}` : value;
}
