import { Module } from "@nestjs/common";
import { InvestmentModule } from "../investment/investment.module";
import { ShutdownObserver } from "../shutdown-observer";
import { BungieAccessProtocolServerService } from "./bungie-access-protocol-server.service";

@Module({
  imports: [InvestmentModule],
  providers: [BungieAccessProtocolServerService, ShutdownObserver],
  exports: [BungieAccessProtocolServerService, ShutdownObserver],
})
export class BungieAccessProtocolModule {}
