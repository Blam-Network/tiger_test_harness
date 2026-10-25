import { c } from "@craftycodie/cstruct";
import type { NotificationHeaders } from "../activity-host-build";

// Client -> AH (wire 8): variant 1 = {u8 variant, u32 kind, u32 length,
// payload}. Matches the 222-byte join the client sends after manager startup.
const ClientToActivityHostNotificationHeader = c.struct({
  sessionId: c.u64(),
  variant: c.u8(),
  kind: c.u32(),
  length: c.u32(),
});

// AH -> client (wire 0x64), see sub_82B7C828.
const ActivityHostToClientNotificationHeader = c.struct({
  variant: c.u8(),
  sessionId: c.u64(),
  kind: c.u32(),
  length: c.u32(),
});

export const notificationHeaders: NotificationHeaders = {
  clientToHost: {
    size: c.sizeof(ClientToActivityHostNotificationHeader),
    read: (body) => c.read(ClientToActivityHostNotificationHeader, body, "big"),
    write: (fields) =>
      c.write(ClientToActivityHostNotificationHeader, fields, "big"),
  },
  hostToClient: {
    size: c.sizeof(ActivityHostToClientNotificationHeader),
    read: (body) => c.read(ActivityHostToClientNotificationHeader, body, "big"),
    write: (fields) =>
      c.write(ActivityHostToClientNotificationHeader, fields, "big"),
  },
};
