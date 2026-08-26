import { Module } from "@nestjs/common";
import { ILoggerSymbol } from "../ILogger";
import { ShutdownObserver } from "../ShutdownObserver";
import { loggerWithPrefix } from "../utils/logger";
import { ActivityHostManager } from "./activity-host-manager";
import { ActivityHostProxyServerService } from "./activity-host-proxy-server.service";

@Module({
  providers: [
    ActivityHostManager,
    ActivityHostProxyServerService,
    loggerWithPrefix("ActivityHostProxy"),
    ShutdownObserver,
  ],
  exports: [ActivityHostProxyServerService, ILoggerSymbol, ShutdownObserver],
})
export class ActivityHostProxyModule {}
