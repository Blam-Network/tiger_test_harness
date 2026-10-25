import { c } from "@craftycodie/cstruct";
import type { NotificationHeaders } from "../activity-host-build";

// Client -> AH (wire 8, codec sub_828343C8). The session id is the frame's;
// variant 1 = {u8 variant, u32 kind, u32 length, u32 unknown (0 in every join
// seen), payload}.
const ClientToActivityHostNotificationHeader = c.struct({
  sessionId: c.u64(),
  variant: c.u8(),
  kind: c.u32(),
  length: c.u32(),
  unknown: c.u32(),
});

// AH -> client (wire 0x64, decode sub_82834570).
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
      c.write(
        ClientToActivityHostNotificationHeader,
        { ...fields, unknown: 0 },
        "big"
      ),
  },
  hostToClient: {
    size: c.sizeof(ActivityHostToClientNotificationHeader),
    read: (body) => c.read(ActivityHostToClientNotificationHeader, body, "big"),
    write: (fields) =>
      c.write(ActivityHostToClientNotificationHeader, fields, "big"),
  },
};
