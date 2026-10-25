import { event_message, event_warning } from "@blamnetwork/datamine";
import { Controller, Post, Req, Res } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import {
  buildAuthReply,
  createAuthSession,
  isDestinyTitle,
  parseAuthRequest,
} from "../../demonware/auth";
import { demonwareBuild } from "../../demonware/versions";

// panther-xbox360-auth3.<env>.demonware.net/auth/ lands here: Sunrise's XHttp
// hooks send every https request to this port.
@ApiTags("Demonware Auth")
@Controller("/auth")
export class DemonwareAuthController {
  @Post()
  auth(@Req() req: Request, @Res() res: Response) {
    const values = demonwareBuild().auth;
    if (!values) {
      event_warning("demonware:auth: this build has no auth, answering 404");
      return res.status(404).end();
    }
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    const request = parseAuthRequest(body);
    if (!request || request.authTask !== values.authTaskRequest) {
      event_warning("demonware:auth: bad request %s", body.toString("utf8"));
      return res.status(400).end();
    }

    if (!isDestinyTitle(request)) {
      event_warning(
        "demonware:auth: title %s, expected %s",
        request.titleId,
        values.titleId
      );
    }

    const session = createAuthSession(request.ivSeed);
    event_message(
      "demonware:auth: title=%s iv_seed=%s -> session %s",
      request.titleId,
      request.ivSeed,
      session.id
    );

    const reply = buildAuthReply(session);
    res.set("Content-Type", "application/json");
    res.set("Content-Length", Buffer.byteLength(reply).toString());
    return res.status(200).send(reply);
  }
}
