import { randomInt, randomUUID } from "node:crypto";
import { event_message } from "@blamnetwork/datamine";
import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Res,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Response } from "express";

// The PSN WebAPI calls a PS4 client makes through sceNpWebApi when its
// runtime signs in locally instead of to a PSN stand-in: the runtime points
// its WebAPI base at this host. Answers match what the client got from
// ShadNet. Nothing reads sessions or presence back (there are no
// invitations), so nothing is kept.

// The presence fields a client writes.
const PRESENCE_KINDS = new Set(["gameStatus", "gameData"]);

// A PSN session id: three hex digits and a UUID, 40 lowercase characters.
// The client parses it into 18 bytes and asserts that printing them back with
// "%03x-%08x-%04x-%04x-%02x%02x-%02x%02x%02x%02x%02x%02x" gives the same
// string, so any other shape halts it.
function newSessionId(): string {
  return `${randomInt(0x10_00).toString(16).padStart(3, "0")}-${randomUUID()}`;
}

// application/json with no charset, as ShadNet sends it.
function sendJson(res: Response, value: object) {
  // res.set would add a charset.
  res.setHeader("Content-Type", "application/json");
  return res.status(200).send(Buffer.from(JSON.stringify(value)));
}

@ApiTags("PSN WebAPI")
@Controller("/v1")
export class PsnWebApiController {
  // userProfile: the friend list, always empty.
  @Get("users/:onlineId/friendList")
  friendList(
    @Param("onlineId") onlineId: string,
    @Query("offset") offset: string | undefined,
    @Res() res: Response
  ) {
    const start = Number(offset ?? 0);
    if (!Number.isInteger(start) || start < 0) {
      return res.status(400).end();
    }
    event_message("psn:webapi: friendList for %s", onlineId);
    return sendJson(res, { friendList: [], size: 0, start, totalResults: 0 });
  }

  // userProfile: presence/gameStatus and presence/gameData.
  @Put("users/:onlineId/presence/:kind")
  presence(
    @Param("onlineId") onlineId: string,
    @Param("kind") kind: string,
    @Res() res: Response
  ) {
    if (!PRESENCE_KINDS.has(kind)) {
      return res.status(404).end();
    }
    event_message("psn:webapi: presence %s for %s", kind, onlineId);
    return res.status(204).end();
  }

  // sessionInvitation: create. The body is multipart (session JSON and
  // image). The client keeps sessionId (newSessionId) and puts it back into
  // the path.
  @Post("sessions")
  createSession(@Res() res: Response) {
    const sessionId = newSessionId();
    event_message("psn:webapi: session %s created", sessionId);
    return sendJson(res, { sessionId });
  }

  @Put("sessions/:sessionId")
  updateSession(@Param("sessionId") sessionId: string, @Res() res: Response) {
    event_message("psn:webapi: session %s updated", sessionId);
    return res.status(204).end();
  }

  @Delete("sessions/:sessionId")
  deleteSession(@Param("sessionId") sessionId: string, @Res() res: Response) {
    event_message("psn:webapi: session %s deleted", sessionId);
    return res.status(204).end();
  }
}
