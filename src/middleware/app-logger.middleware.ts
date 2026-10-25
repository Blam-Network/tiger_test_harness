import { event_status } from "@blamnetwork/datamine";
import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

@Injectable()
export class AppLoggerMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const { ip, method } = request;
    const userAgent = request.get("user-agent") || "";

    response.on("close", () => {
      const headers = JSON.stringify(request.headers);

      event_status(
        "http: %s %s %d - %s %s %s",
        method,
        request.originalUrl,
        response.statusCode,
        userAgent,
        ip,
        headers
      );
    });

    next();
  }
}
