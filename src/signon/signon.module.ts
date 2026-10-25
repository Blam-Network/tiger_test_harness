import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from "@nestjs/common";
import { AppLoggerMiddleware } from "../middleware/app-logger.middleware";
import { ShutdownObserver } from "../shutdown-observer";
import { ContentManifestController } from "./controllers/content-manifest.controller";
import { DemonwareAuthController } from "./controllers/demonware-auth.controller";
import { PsnOauthController } from "./controllers/psn-oauth.controller";
import { PsnWebApiController } from "./controllers/psn-webapi.controller";
import { SignonController } from "./controllers/signon.controller";
import { SignonService } from "./services/signon.service";

@Module({
  controllers: [
    SignonController,
    DemonwareAuthController,
    ContentManifestController,
    PsnOauthController,
    PsnWebApiController,
  ],
  providers: [SignonService, ShutdownObserver],
  exports: [SignonService, ShutdownObserver],
})
export class SignonModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AppLoggerMiddleware).forRoutes("*");
  }
}
