import { event_message } from "@blamnetwork/datamine";
import { Controller, Get, Post, Req, Res } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { SignonService } from "../services/signon.service";

// Express routing is case-insensitive, so this also serves a client's
// POST /SignOn?platform=xenon&build=<build>.
@ApiTags("Sign On")
@Controller("/signon")
export class SignonController {
  constructor(private readonly signonService: SignonService) {}

  @Get()
  getSignon(@Req() req: Request, @Res() res: Response) {
    return this.signon(req, res);
  }

  @Post()
  postSignon(@Req() req: Request, @Res() res: Response) {
    return this.signon(req, res);
  }

  private signon(req: Request, res: Response) {
    const requestBody = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(typeof req.body === "string" ? req.body : "");

    event_message(
      "signon: %s platform=%s build=%s body=%s",
      req.method,
      String(req.query.platform),
      String(req.query.build),
      requestBody.toString("hex")
    );

    const request = this.signonService.parseSignonRequest(requestBody);
    const queryBuild =
      typeof req.query.build === "string" ? req.query.build : undefined;
    if (
      !this.signonService.acceptsClientBuild(
        queryBuild?.trim() || request?.build
      )
    ) {
      return res.status(403).send();
    }

    const body = this.signonService.buildSuccessSignonResponse();
    res.set("Content-Type", "application/octet-stream");
    res.set("Content-Length", body.length.toString());
    return res.status(200).send(body);
  }
}
