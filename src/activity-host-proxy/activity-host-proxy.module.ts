import { Module } from "@nestjs/common";
import { ShutdownObserver } from "../shutdown-observer";
import { ActivityHostManager } from "./activity-host-manager";
import { ActivityHostProxyServerService } from "./activity-host-proxy-server.service";

@Module({
  providers: [
    ActivityHostManager,
    ActivityHostProxyServerService,
    ShutdownObserver,
  ],
  exports: [ActivityHostProxyServerService, ShutdownObserver],
})
export class ActivityHostProxyModule {}
