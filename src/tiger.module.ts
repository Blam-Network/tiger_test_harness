import { Module } from "@nestjs/common";
import { ActivityHostProxyModule } from "./activity-host-proxy/activity-host-proxy.module";
import { BungieAccessProtocolModule } from "./bungie-access-protocol/bungie-access-protocol.module";
import { DatamineModule } from "./datamine/datamine.module";
import { DemonwareModule } from "./demonware/demonware.module";
import { SignonModule } from "./signon/signon.module";

@Module({
  imports: [
    SignonModule,
    DatamineModule,
    BungieAccessProtocolModule,
    ActivityHostProxyModule,
    DemonwareModule,
  ],
  exports: [
    SignonModule,
    DatamineModule,
    BungieAccessProtocolModule,
    ActivityHostProxyModule,
    DemonwareModule,
  ],
})
export class TigerModule {}
