import { Module } from "@nestjs/common";
import { ILoggerSymbol } from "../ILogger";
import { ShutdownObserver } from "../ShutdownObserver";
import { loggerWithPrefix } from "../utils/logger";
import { BungieAccessProtocolServerService } from "./bungie-access-protocol-server.service";

@Module({
  providers: [
    BungieAccessProtocolServerService,
    loggerWithPrefix("BungieAccessProtocol"),
    ShutdownObserver,
  ],
  exports: [BungieAccessProtocolServerService, ILoggerSymbol, ShutdownObserver],
})
export class BungieAccessProtocolModule {}
