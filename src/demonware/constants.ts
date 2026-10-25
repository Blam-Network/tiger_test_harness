// Destiny Xbox 360 Demonware 3 LSG framing constants.

// First client packet after TCP connect (`bdLobbyConnection::serializeClientHeader`).
export const CLIENT_HEADER_MAGIC = 200;

export const DEFAULT_SERVER_MAX_MSG = 0x1_0000;

// Lobby / LSG control message types (body[0] after encrypt flag).
export const MSG_LOBBY_TASK_REPLY = 1;
export const MSG_LSG_CONNECTION_ID = 4;
export const MSG_CLIENT_INIT_BLOB = 7;

// DW3 typed byte-buffer type tags (s1x `byte_buffer.cpp`).
export const DTYPE_BYTE = 3;
export const DTYPE_UINT32 = 8;
export const DTYPE_INT64 = 9;
export const DTYPE_UINT64 = 10;
export const DTYPE_BLOB = 0x13;

// bdMatchMaking task ids. Its service id is the build's (matchMakingService).
export const MM_CREATE_SESSION = 1;
export const MM_UPDATE_SESSION = 2;
export const MM_DELETE_SESSION = 3;
export const MM_FIND_SESSIONS = 5;
export const MM_SUBMIT_PERFORMANCE = 9;
export const MM_GET_PERFORMANCE = 10;

// Bring-up connection / session ids (fixed large u64s).
export const FAKE_CONNECTION_ID = 0x1337_1337_1337_1337n;
export const FAKE_DW_SESSION_ID = 0x1337_1337_1337_0001n;
