import type { DemonwareBuild } from "../demonware-build";

// Destiny's Demonware title, set in demonware_lobby_update.
const DEMONWARE_TITLE_ID = 18_407;

// 1021 is the lobby port after Demonware auth (demonware_lobby_update); 1020
// is the unauthenticated one.
const LOBBY_PORTS = [1020, 1021, 1011] as const;

// bdAuth task ids: the client asks with 42, the reply must carry 43
// (checked at 0x83078C44) and code 700 (checked at 0x83078CB4).
const AUTH_TASK_REQUEST = 42;
const AUTH_TASK_REPLY = 43;
const AUTH_CODE_OK = 700;

// bdAuthTicket magic, checked at 0x83078E60 (bytes DE AD BD EF).
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
    lobbyProtocol: 200,
    matchMakingService: 21,
  };
}
