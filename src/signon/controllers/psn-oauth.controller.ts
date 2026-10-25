import { randomBytes } from "node:crypto";
import { event_message } from "@blamnetwork/datamine";
import { Controller, Post, Res } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Response } from "express";

// A PS4 client trades its NP authorization code for an OpenID token at
// https://auth.api.<env>.ac.playstation.net/2.0/oauth/token before signon and
// Demonware auth. It needs a JSON reply with scope and id_token and forwards
// the whole body as its platform token, which nothing reads.
@ApiTags("PSN OAuth")
@Controller("/2.0/oauth/token")
export class PsnOauthController {
  @Post()
  token(@Res() res: Response) {
    event_message("signon: PSN OAuth token request");
    const reply = JSON.stringify({
      access_token: randomBytes(16).toString("hex"),
      token_type: "bearer",
      expires_in: 3599,
      scope: "openid",
      id_token: randomBytes(32).toString("base64url"),
    });
    res.set("Content-Type", "application/json");
    return res.status(200).send(reply);
  }
}
