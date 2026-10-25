// biome-ignore-all lint/complexity/useLiteralKeys: reaches the session's private members
import { Socket } from "node:net";
import { vi } from "vitest";
import {
  ACTIVITY_HOST_MANAGER_START_TYPE,
  ActivityHostManager,
} from "../activity-host-proxy/activity-host-manager";
import type { ActivityHostMessageType } from "../activity-host-proxy/messages";
import { PlayerHosts } from "../activity-host-proxy/player-hosts";
import { ActivityHostProxySession } from "../activity-host-proxy/session";
import { activityHostBuild } from "../activity-host-proxy/versions";
import type { RawBapMessage } from "../lib/bap-wire/codec";
import { BitBuilder } from "./bit-builder";
import { captureEvents } from "./capture-events";

export const IDENTITY = {
  account: 0x100000001n,
  character: 0x200000002n,
  machine: Buffer.from("7c1e52a389ce0000", "hex"),
  player: Buffer.from("91aa24169863498d", "hex"),
};

// Manager start request (type 3) whose player-configuration stream carries
// the account soid at the live capture's bit 8367 with the character soid
// after it (live: 32 bits later, overlapping; the seeded soids share the
// dword).
export function startRequest(
  account: bigint,
  character: bigint
): RawBapMessage {
  const stream = Buffer.alloc(1068, 0);
  const soids = new BitBuilder().write(account, 64).write(character, 64);
  const packed = new BitBuilder().write(0, 8367).append(soids).toBuffer();
  packed.copy(stream);
  const inner = Buffer.alloc(
    activityHostBuild().startRequest.START_REQUEST_PAYLOAD_SIZE,
    0
  );
  Buffer.from("0005051780000000", "hex").copy(inner);
  inner.writeUInt16BE(
    stream.length,
    activityHostBuild().startRequest.START_REQUEST_STREAM_SIZE_OFFSET
  );
  stream.copy(
    inner,
    activityHostBuild().startRequest.START_REQUEST_STREAM_OFFSET
  );
  const body = Buffer.alloc(3095, 0);
  body[0] = ACTIVITY_HOST_MANAGER_START_TYPE;
  inner.copy(body, 1);
  return { msgType: 6, sequence: 1, body };
}

export function makeSession(manager?: ActivityHostManager) {
  const captured = captureEvents();
  const socket = new Socket();
  const session = new ActivityHostProxySession(
    socket,
    manager ?? new ActivityHostManager()
  );
  // Fresh hosts per test, as if a start request for an unknown player had
  // arrived, so the anonymous grant state does not leak between tests.
  const boundHosts = new PlayerHosts();
  session["bound"] = { host: boundHosts.fah, hosts: boundHosts, kind: "FAH" };
  session["joinIdentity"] = { ...IDENTITY };
  session["send"] = vi.fn();
  const pushes: {
    kind: ActivityHostMessageType;
    payload: Buffer;
    label?: string;
  }[] = [];
  session["pushAh"] = (
    _id: bigint,
    kind: ActivityHostMessageType,
    payload: Buffer,
    label?: string
  ) => {
    pushes.push({ kind, payload, label });
  };
  const close = () => {
    session["keepalive"].stop();
    socket.emit("close");
    socket.destroy();
  };
  return { session, pushes, close, captured };
}
