import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from "@nestjs/common";
import { AppLoggerMiddleware } from "../middleware/app-logger.middleware";
import { ShutdownObserver } from "../shutdown-observer";
import { DatamineController } from "./controllers/datamine.controller";
import { DatamineService } from "./services/datamine.service";

@Module({
  controllers: [DatamineController],
  providers: [DatamineService, ShutdownObserver],
  exports: [DatamineService, ShutdownObserver],
})
export class DatamineModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AppLoggerMiddleware).forRoutes("*");
  }
}
