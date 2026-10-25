// The bdAuth ("auth3") exchange, as read off a build's own code.
export interface DemonwareAuth {
  // Reply code the client takes as success.
  authCodeOk: number;
  // bdAuth task id the reply must carry.
  authTaskReply: number;
  // bdAuth task id the client asks with.
  authTaskRequest: number;
  // First word of the client ticket, which is checked.
  authTicketMagic: number;
  titleId: number;
}

// What the client's Demonware connection expects of a build.
export interface DemonwareBuild {
  // Absent in a build whose client never asks for an auth ticket: auth
  // requests are answered 404.
  auth?: DemonwareAuth;
  lobbyPorts: readonly number[];
  // The lobby connection's protocol: 200 is plaintext frames after an 8-byte
  // header, 210 an authenticated handshake and encrypted records
  // (lobby-210.ts).
  lobbyProtocol: 200 | 210;
  // The lobby service id bdMatchMaking answers on (its tasks: 1 create, 2
  // update, 3 delete, 5 find, 9/10 performance).
  matchMakingService: number;
  // Absent in a build that runs no Demonware address and NAT type discovery
  // (stun.<region>.demonware.net): the UDP ports of its primary and secondary
  // addresses.
  natDiscoveryPorts?: { primary: number; secondary: number };
}
