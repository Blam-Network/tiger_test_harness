import { c } from "@craftycodie/cstruct";
import type { RawBapMessage } from "../bungie-access-protocol/codec";
import type ILogger from "../ILogger";
import { ActivityHostService } from "./activity-host";
import { FAKE_ACTIVITY_HOST_ID } from "./config";
import {
  formatStartRequest,
  type ParsedStartRequest,
  parseStartRequest,
} from "./start-request";

// activity host manager startup request ?
export const ACTIVITY_HOST_MANAGER_START_TYPE = 3;
// TODO: what is this
export const ACTIVITY_HOST_MANAGER_RESPONSE_TYPE = 2;

// TODO: figure out the body after the id.
const ActivityHostManagerResponse = c.struct({
  type: c.u8(),
  activityHostId: c.u64(),
  _unknown: c.pad(128),
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
    },
    "big"
  );
}

// Currently one TCP session gets one manager.
// in future, there will be shared managers handling multiple sessions.
// or maybe a single manager managing all AHs across all sessions
// well figure this out later.
export class ActivityHostManager {
  readonly fah: ActivityHostService;
  gah: ActivityHostService | undefined;
  private startRequest: ParsedStartRequest | undefined;

  constructor(private readonly logger: ILogger) {
    this.fah = new ActivityHostService(FAKE_ACTIVITY_HOST_ID);
  }

  getStartRequest(): ParsedStartRequest | undefined {
    return this.startRequest;
  }

  handle(message: RawBapMessage): Buffer | null {
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

      const body = buildActivityHostManagerResponse(this.fah.id);
      this.logger.log(
        `AH manager rsp (seq ${message.sequence.toString(16)}, ` +
          `reqType=${req.type} req=${message.body.length}B ` +
          `head=${hexPreview(req.payload, 16)} ` +
          `ah=0x${this.fah.id.toString(16)}, body ${body.length}B)`
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
