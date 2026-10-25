import type { DemonwareBuild } from "../demonware-build";

// Destiny's PS4 Demonware title (0x9CE7CA).
const DEMONWARE_TITLE_ID = 5474;

// The client dials panther-ps4-lobby.<env>.demonware.net:3074 (0x9CEAE5),
// authenticated or not. It has no LSP, so no 1020/1021/1011.
const LOBBY_PORTS = [3074] as const;

// stun.<region>.demonware.net, UDP 3074 (nat-discovery.ts). The client gives
// up with error 143 transport_method_invalid (marionberry) when nothing
// answers. We pick the secondary port; the first NAT type reply tells it.
const NAT_DISCOVERY_PORTS = { primary: 3074, secondary: 3075 } as const;

// bdAuth task ids: the PS4 client asks with 46 and the reply must carry 47
// (checked at 0x13FE4BD), then code 700.
const AUTH_TASK_REQUEST = 46;
const AUTH_TASK_REPLY = 47;
const AUTH_CODE_OK = 700;

// bdAuthTicket magic, checked at 0x13FE626 (bytes DE AD BD EF).
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
    // The 210 handshake: client header sub_1418180, records sub_1415CC0
    // (lobby-210.ts).
    lobbyProtocol: 210,
    // DW 36: the alpha asks bdMatchMaking's tasks (1, 2, 3, 5, 10) on 138.
    matchMakingService: 138,
    natDiscoveryPorts: NAT_DISCOVERY_PORTS,
  };
}
