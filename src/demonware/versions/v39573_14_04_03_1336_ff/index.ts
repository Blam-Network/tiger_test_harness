import type { DemonwareBuild } from "../demonware-build";

// The Alpha Trial's Demonware title (0xA4DE17), not the pre-alpha's 5475.
const DEMONWARE_TITLE_ID = 5474;

// panther-ps4-lobby.<env>.demonware.net:3074 (0xA4E2E4).
const LOBBY_PORTS = [3074] as const;

// stun.<region>.demonware.net, UDP 3074, the same packets as the other PS4
// builds (nat-discovery.ts). The secondary port is ours to pick.
const NAT_DISCOVERY_PORTS = { primary: 3074, secondary: 3075 } as const;

// bdAuth task ids: asked with 46, answered with 47 (0x1493B6C), code 700.
const AUTH_TASK_REQUEST = 46;
const AUTH_TASK_REPLY = 47;
const AUTH_CODE_OK = 700;

// bdAuthTicket magic (0x250BE78, bytes DE AD BD EF).
const AUTH_TICKET_MAGIC = 0xef_bd_ad_de;

export function loadDemonwareBuild(): DemonwareBuild {
  return {
    auth: {
      authCodeOk: AUTH_CODE_OK,
      authTaskReply: AUTH_TASK_REPLY,
      authTaskRequest: AUTH_TASK_REQUEST,
      authTicketMagic: AUTH_TICKET_MAGIC,
      titleId: DEMONWARE_TITLE_ID,
    },
    lobbyPorts: LOBBY_PORTS,
    // Header 200,200,210,210 (sub_14AB1E0), the key schedule lobby-210.ts
    // implements.
    lobbyProtocol: 210,
    // DW 3.5 asks bdMatchMaking on 138, as the Alpha Trial does (0x1497E69).
    matchMakingService: 138,
    natDiscoveryPorts: NAT_DISCOVERY_PORTS,
  };
}
