import type { DemonwareBuild } from "../demonware-build";

// This build's Demonware title (0xA19F67), one up from the Alpha Trial's.
const DEMONWARE_TITLE_ID = 5475;

// panther-ps4-lobby.<env>.demonware.net:3074 (0xA1A3F4).
const LOBBY_PORTS = [3074] as const;

// stun.<region>.demonware.net, UDP 3074, the same packets as the Alpha
// Trial's (nat-discovery.ts). The secondary port is ours to pick.
const NAT_DISCOVERY_PORTS = { primary: 3074, secondary: 3075 } as const;

// bdAuth task ids: asked with 46, answered with 47 (0x146A6C9), code 700.
const AUTH_TASK_REQUEST = 46;
const AUTH_TASK_REPLY = 47;
const AUTH_CODE_OK = 700;

// bdAuthTicket magic (0x247A4F8, bytes DE AD BD EF).
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
    // Header 200,200,210,210 (sub_14829A0), the key schedule lobby-210.ts
    // implements.
    lobbyProtocol: 210,
    // DW 3.4 asks bdMatchMaking on 21, as the Xbox builds do (0x146EA5C).
    matchMakingService: 21,
    natDiscoveryPorts: NAT_DISCOVERY_PORTS,
  };
}
