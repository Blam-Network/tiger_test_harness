import { Controller, HttpCode, Post, Put, Req, Res } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { DatamineService } from "../services/datamine.service";

@ApiTags("Datamine")
@Controller()
export class DatamineController {
  constructor(private readonly datamineService: DatamineService) {}

  // Datamine upload endpoint (dm-*.upload.deadorbit.net).
  @Put("/ticket_drop")
  @Post("/ticket_drop")
  @HttpCode(200)
  async ticketDrop(@Req() req: Request, @Res() res: Response) {
    const body = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(typeof req.body === "string" ? req.body : "");

    const result = await this.datamineService.absorbTicketDrop(body, {
      method: req.method,
      host: req.headers.host,
    });
    res.set("Content-Type", "application/json");
    return res.status(200).json(result);
  }
}
