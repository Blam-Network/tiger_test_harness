import { c } from "@craftycodie/cstruct";
import { Inject, Injectable } from "@nestjs/common";
import type { RawBapMessage } from "../bungie-access-protocol/codec";
import type ILogger from "../ILogger";
import { ILoggerSymbol } from "../ILogger";
import { type ActivityHostKind, ActivityHostService } from "./activity-host";
import { formatActivityHostTag } from "./config";
import {
  formatStartRequest,
  type ParsedStartRequest,
  parseStartRequest,
} from "./start-request";

// activity host manager startup request ?
export const ACTIVITY_HOST_MANAGER_START_TYPE = 3;
// TODO: what is this
export const ACTIVITY_HOST_MANAGER_RESPONSE_TYPE = 2;

const ActivityHostManagerResponse = c.struct({
  type: c.u8(),
  activityHostId: c.u64(),
  session: c.String(128),
});

export function parseActivityHostManagerRequest(body: Buffer): {
  type: number;
  payload: Buffer;
} | null {
  if (body.length < 1) {
    return null;
  }
  return {
    type: body[0],
    payload: Buffer.from(body.subarray(1)),
  };
}

export function buildActivityHostManagerResponse(
  activityHostId: bigint
): Buffer {
  return c.write(
    ActivityHostManagerResponse,
    {
      type: ACTIVITY_HOST_MANAGER_RESPONSE_TYPE,
      activityHostId,
      session: formatActivityHostTag(activityHostId),
    },
    "big"
  );
}

@Injectable()
export class ActivityHostManager {
  readonly fah = new ActivityHostService();
  gah: ActivityHostService | undefined;
  private fahBound = false;
  private startRequest: ParsedStartRequest | undefined;

  constructor(@Inject(ILoggerSymbol) private readonly logger: ILogger) {}

  bindSession(): ActivityHostKind {
    if (!this.fahBound) {
      this.fahBound = true;
      return "FAH";
    }
    this.ensureGah();
    return "GAH";
  }

  unbindSession(kind: ActivityHostKind): void {
    if (kind === "FAH") {
      this.fahBound = false;
    }
  }

  ensureGah(): ActivityHostService {
    this.gah ??= new ActivityHostService();
    return this.gah;
  }

  host(kind: ActivityHostKind): ActivityHostService {
    return kind === "GAH" ? this.ensureGah() : this.fah;
  }

  getStartRequest(): ParsedStartRequest | undefined {
    return this.startRequest;
  }

  handle(message: RawBapMessage, kind: ActivityHostKind): Buffer | null {
    try {
      const req = parseActivityHostManagerRequest(message.body);
      if (!req) {
        this.logger.warn(
          `AH manager req absorbed (short body ${message.body.length}B)`
        );
        return null;
      }

      if (req.type === ACTIVITY_HOST_MANAGER_START_TYPE) {
        const parsed = parseStartRequest(req.payload);
        this.startRequest = parsed ?? undefined;
        if (parsed) {
          this.logger.log(
            `AH manager start req (${req.payload.length}B ` +
              `${formatStartRequest(parsed)})`
          );
        } else {
          this.logger.warn(
            `AH manager start req unparsed (${req.payload.length}B ` +
              `head=${hexPreview(req.payload, 16)})`
          );
        }
      }

      const host = this.host(kind);
      const body = buildActivityHostManagerResponse(host.id);
      this.logger.log(
        `AH manager rsp (seq ${message.sequence.toString(16)}, ` +
          `reqType=${req.type} req=${message.body.length}B ` +
          `head=${hexPreview(req.payload, 16)} ` +
          `ah=0x${host.id.toString(16)} ${kind}, body ${body.length}B)`
      );
      return body;
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      this.logger.warn(`AH manager rsp FAILED, absorbed: ${m}`);
      return null;
    }
  }
}

function hexPreview(buf: Buffer, max = 64): string {
  const slice = buf.subarray(0, max);
  const hex = slice.toString("hex");
  return buf.length > max ? `${hex}…(${buf.length}B)` : hex;
}
