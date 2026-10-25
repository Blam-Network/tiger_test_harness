import {
  enumToJson,
  fromBinary,
  type JsonValue,
  toJson,
} from "@bufbuild/protobuf";
import { bapBuild, type XetrovEventProtos } from "./versions";

function xetrov() {
  return bapBuild().protos.xetrov;
}

// The build's event schemas, if it has them.
function eventProtos(): XetrovEventProtos | undefined {
  const protos = xetrov();
  return "XetrovClientEventSchema" in protos ? protos : undefined;
}

function trimTrailingZeros(buf: Buffer): Buffer {
  let end = buf.length;
  while (end > 0 && buf[end - 1] === 0) {
    end -= 1;
  }
  return end === buf.length ? buf : buf.subarray(0, end);
}

function tryFromBinary<T>(
  decode: (bytes: Uint8Array) => T,
  buf: Buffer
): T | undefined {
  try {
    return decode(buf);
  } catch {
    const trimmed = trimTrailingZeros(buf);
    if (trimmed.length === 0 || trimmed.length === buf.length) {
      return;
    }
    try {
      return decode(trimmed);
    } catch {
      return;
    }
  }
}

function packedTypeJson(protos: XetrovEventProtos, type: number): JsonValue {
  try {
    return enumToJson(protos.XetrovEventTypeSchema, type);
  } catch {
    return type;
  }
}

// Runs of 4+ printable ASCII bytes, in order.
function printableRuns(buf: Buffer): string[] {
  return buf.toString("latin1").match(/[\x20-\x7e]{4,}/g) ?? [];
}

// The build string a client_to_xetrov_notification says it is (event
// field 17), if the body decodes that far. Never throws.
export function xetrovBuild(body: Buffer): string | undefined {
  try {
    const protos = eventProtos();
    if (!protos) {
      return;
    }
    const envelope = tryFromBinary(
      (bytes) => fromBinary(xetrov().ClientToXetrovNotificationSchema, bytes),
      body
    );
    if (!envelope) {
      return;
    }
    let eventBytes = Buffer.from(envelope.event);
    if (envelope.event.length > 0) {
      const packed = tryFromBinary(
        (bytes) => fromBinary(protos.XetrovPackedEventSchema, bytes),
        eventBytes
      );
      if (packed && packed.payload.length > 0) {
        eventBytes = Buffer.from(packed.payload);
      }
    }
    const event = tryFromBinary(
      (bytes) => fromBinary(protos.XetrovClientEventSchema, bytes),
      eventBytes
    );
    return event?.build || undefined;
  } catch {
    return;
  }
}

// One-line log of a client_to_xetrov_notification body. Never throws.
export function formatXetrovNotification(body: Buffer): string {
  try {
    const protos = eventProtos();
    const envelope = tryFromBinary(
      (bytes) => fromBinary(xetrov().ClientToXetrovNotificationSchema, bytes),
      body
    );
    if (envelope && envelope.event.length > 0) {
      const packed =
        protos &&
        tryFromBinary(
          (bytes) => fromBinary(protos.XetrovPackedEventSchema, bytes),
          Buffer.from(envelope.event)
        );
      const usePacked = Boolean(packed && packed.payload.length > 0);
      const eventBytes = usePacked
        ? Buffer.from(packed?.payload ?? [])
        : Buffer.from(envelope.event);
      const event =
        protos &&
        tryFromBinary(
          (bytes) => fromBinary(protos.XetrovClientEventSchema, bytes),
          eventBytes
        );
      const out: Record<string, JsonValue> = {
        reserved1: envelope.reserved1,
        reserved2: envelope.reserved2,
      };
      if (envelope.reserved3 !== 0n) {
        out.reserved3 = envelope.reserved3.toString();
      }
      if (usePacked && packed && protos) {
        out.type = packedTypeJson(protos, packed.type);
      }
      try {
        out.event =
          event && protos
            ? toJson(protos.XetrovClientEventSchema, event)
            : `<${eventBytes.length}B>`;
      } catch {
        out.event = `<${eventBytes.length}B>`;
      }
      // Undecoded events (type 6 on an activity host failure) still
      // carry readable text: keep it.
      if (typeof out.event === "string") {
        out.strings = printableRuns(eventBytes);
        out.hex = eventBytes.subarray(0, 512).toString("hex");
      }
      return `xetrov ${body.length}B ${JSON.stringify(out)}`;
    }

    const event =
      protos &&
      tryFromBinary(
        (bytes) => fromBinary(protos.XetrovClientEventSchema, bytes),
        body
      );
    if (event && protos) {
      try {
        const eventJson = toJson(protos.XetrovClientEventSchema, event);
        if (
          typeof eventJson === "object" &&
          eventJson !== null &&
          Object.keys(eventJson).length > 0
        ) {
          return `xetrov ${body.length}B ${JSON.stringify(eventJson)}`;
        }
      } catch {
        // Sparse required fields — still not a useful log.
      }
    }

    const head = body.subarray(0, 24).toString("hex");
    return `xetrov ${body.length}B decode failed head=${head}`;
  } catch (err) {
    const why = err instanceof Error ? err.message : String(err);
    const head = body.subarray(0, 24).toString("hex");
    return `xetrov ${body.length}B decode failed (${why}) head=${head}`;
  }
}
