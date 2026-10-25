import { Module } from "@nestjs/common";
import { ShutdownObserver } from "../shutdown-observer";
import { DemonwareServerService } from "./demonware-server.service";

@Module({
  providers: [DemonwareServerService, ShutdownObserver],
  exports: [DemonwareServerService, ShutdownObserver],
})
export class DemonwareModule {}
