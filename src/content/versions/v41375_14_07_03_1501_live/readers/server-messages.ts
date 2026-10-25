// The server message table (investment globals slot "server_messages"). A
// message is the request and response schema a network id carries over BAP.
import type { ContentReaders } from "../../content-build";
import type { InvestmentGlobals } from "./investment-globals";

export function serverMessageReaders(
  investment: InvestmentGlobals
): Pick<ContentReaders, "serverMessages"> {
  return {
    serverMessages() {
      return investment
        .table("server_messages", "s_server_message_table")
        .messages.map((row: any) => ({
          nameHash: row.name_hash,
          networkId: row.network_id,
          requestSchema: row.request_schema,
          responseSchema: row.response_schema,
        }));
    },
  };
}
