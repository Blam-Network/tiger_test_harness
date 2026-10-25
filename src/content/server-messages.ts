// The server message table, read off the disc packages on first use. A
// message is the request and response schema a network id carries over BAP.
import type { ServerMessage } from "./model/investment";
import { contentBuild } from "./versions";

export type { ServerMessage } from "./model/investment";

let messages: readonly ServerMessage[] | undefined;
let byId: ReadonlyMap<number, ServerMessage> | undefined;
let byHash: ReadonlyMap<number, ServerMessage> | undefined;

export function serverMessages(): readonly ServerMessage[] {
  if (!messages) {
    messages = contentBuild().readers.serverMessages();
  }
  return messages ?? [];
}

// The message a network id names, undefined for one the build lacks.
export function serverMessageByNetworkId(
  networkId: number
): ServerMessage | undefined {
  byId ??= new Map(serverMessages().map((m) => [m.networkId, m]));
  return byId.get(networkId);
}

export function serverMessageByNameHash(
  nameHash: number
): ServerMessage | undefined {
  byHash ??= new Map(serverMessages().map((m) => [m.nameHash, m]));
  return byHash.get(nameHash >>> 0);
}
