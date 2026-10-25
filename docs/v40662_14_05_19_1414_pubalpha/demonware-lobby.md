# Demonware lobby, PS4 alpha 40662

The alpha dials `panther-ps4-lobby.<env>.demonware.net:3074` (0x9CEAE5) and speaks lobby protocol **210**, not
the plaintext 200 flow web-tiger's lobby serves for the Xbox builds.

- `process210ExpectedServerHeader` (sub_14164B0) parses the server header ack and kills the connection unless the
  server picks protocol 210 (`ERR: Server selected protocol %i, client requires %i.`, 0x1416D4F).
- The 210 flow then runs an authenticated handshake (`process210ExpectedServerAuthDone`) and record layer
  (`process210ExpectedRecord`, `getMessageToDispatch210` sub_14156B0, `sendTask210` sub_1413AB0).
- The 200 routines are still in the image (`sendTask200` around 0x1414637, `getMessageToDispatch200`
  sub_1417070), but sub_14164B0 itself calls into sub_1417070 (0x1416AB2, 0x1416AF3), so the 200 code is not
  simply an alternative flow a byte could select. Not traced further.
- lobbyService+0x53C / conn+0x158 is not the switch: its only value setter (0x14110C0) has no caller and the
  other writes zero it (0x140E6B0, 0x140E7F2). `demonware_encryption_enabled` (byte_2338C7A, default 1 at
  0x7512F4) goes to the bdNet start parameters (0x7515B8 in sub_7513F0), not the lobby connection.

- The client header (sub_1418180) is five u32s and a u64: 200, 200, 210, 210, then conn+156 and conn+520 (true
  meanings unknown; the pairs read as a supported protocol range). web-tiger's 200 lobby reads the first two as
  its magic and max message size and answers with a connection id, which the client drops (cattle, seen
  2026-10-22). The only server-header handler is the 210 one; no 200 handshake handler exists in this build, so
  there is no plaintext flow to steer the client onto.
- The lobby is required: without it the client stops before character select with cattle (148
  demonware_connection_timeout), after signon and Demonware auth both succeed.

Served by `src/demonware/lobby-210.ts` (2026-10-22): the client authenticates on every connect ("authenticated
with auth session N"). The handshake, key schedule and record layout are described at the top of that file.

Earlier open question: how web-tiger serves this client's lobby (a protocol 210 server, or getting the client onto the 200
path), and whether anything before character select needs the lobby at all.
