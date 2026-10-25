# PS4 39573 (ff) sign-on, Demonware and BAP

2026-10-23. `D:/Games/ps4/ff-39573/eboot.bin` (39573.14.04.03.1336.ff, sha256 c45ad51d...), the decrypted eboot of
the "Music Player Demo" dump (CUSA00515). Read from the ELF bytes (capstone, `DT_SCE_RELA` relocations); IDA address
= ELF vaddr. Every key comparison below was read in disassembly. Protos:
`proto/v39573_14_04_03_1336_ff/{signon,content_manifest,client_config,xetrov}.proto`.
"pre-alpha" = betath 38464 (`docs/v38464_14_02_28_1027_betath/signon-demonware.md`), "Alpha Trial" = pubalpha 40662.

In short: the pre-alpha's protobuf tables, byte for byte, with the Alpha Trial's sign-on token, Demonware title
and matchmaking service, and a required, signed content manifest.

## 1. Sign-on
- URL (sub_761400): i = random 0..15, `https://www%d.%s/%s` (0x254A669), www(i/2+1), host table 0x2B1E0B0
  ([0] signon.gravityshavings.net, [1] signon.deadorbit.net), path `SignOn?platform=%s&build=%s` (0x254A61D). Build =
  line 12 of the version blob, `39573.14.04.03.1336.ff` (0x2AB1CB7). Override list at signon+0x4045 (125-byte entries,
  0x7614A1), as in the pre-alpha.
- Request (sub_761620, nanopb 0x24D31D0, identical to the pre-alpha's 0x2441B10): 1 = 13 (0x76168C); 2 callback
  (0x761D20) = platform token; 3 language (8); 4 previous security_token; 5 UI string (sub_7648C0, only when not
  empty); 6 the build (sub_628340); 7 bool; 11 email; 12 queue token echo; 13 sub_6E54D0 (session id FNV-1a 64);
  15 response field 10 echo. No 17/18.
- Platform token = the PSN OAuth reply, as in the Alpha Trial (the pre-alpha sent the bare NP code). The signon
  platform state (sub_183DA50) logs "Sending auth ticket request" and calls bdAuthPS4 retrieveSCEAccessToken
  (sub_1493AC0) with client id `431cc77e-18d7-4abc-9e1f-e32188128783` (sub_738490), client secret (sub_7384A0) and
  scope `openid` (sub_7384B0). At status 700 (0x183DCFC) it copies out the reply (sub_1493CA0, 0x1000) and sends it,
  strlen'd, as field 2 (token state 0x3CC4120: state 3, +0x28/+0x30, read by sub_1840CD0). The server does not
  check it.
- Response (sub_75FD90, decode 0x75FF73, nanopb 0x2B26E20 = the pre-alpha's): type > 3 is unknown (0x75FF84), jump
  table 0x7607FC: 0 success (sub_760820), 1 queue, 2 error, 3 another state. Ticket 0x2B26F10: 1-7 required, 9
  optional, no 11. BAP ipv4 (+0x258) taken only when non-zero (0x760B5D), byte-swapped (movbe 0x760B61) into
  signon+0x48B8, port +0x25C into +0x48BC. Same encoding as the other builds (127.0.0.1 = 0x0100007F).
- Field 4 (0x24D3300): cookie, social_matchmaking_id required, field 3 the Engine Configuration (0x2B26820). The
  Engine Configuration gained a few defaulted fields over the pre-alpha's (5.2, 15.38, 16.235, 41.17-21); field 1
  (0x2B1E1C0) is the pre-alpha's: 1 bytes 4096, 2 manifest url. No guid.
- Required-field twist (0x72DB00): same bytes as the pre-alpha's 0x15CA520.

## 2. Content manifest
- Required. content_check (sub_8C3320): url null → "Could not obtain content manifest url" (error 0x16/0x36,
  0x8C3850); url empty → sub_852B40 (`mov al,1; ret`) → "Signon server failed to provide content manifest URL."
  (0x8C380F, error 0x16/0x6A). The pre-alpha went on with an empty manifest; the string for that is still logged
  first (0x2570A05).
- Decode sub_18420C0: nanopb 0x2C42C10 = the pre-alpha's 0x2BC5170 (lists 1-4, list 3 = {offer_id, name 256}, no
  package_id/header_value, no guid), decoded state 0x49620 bytes, entries with a name counted up to 0x31F.
- **Signed.** 0x1842149 `lea rcx, 0x3CC4A18; cmp byte [rcx],0; je 0x1842746`. 0x3CC4A18 is BSS with no other
  reference, so it is always 0 and the je is always taken: body ≤ 0x107 bytes → "Not enough data to do signature
  check"; else a 0x108-byte header (8 + 256-byte signature, the Alpha Trial's layout) is verified over the rest by
  sub_1627890 against the key list (sub_6C8D50 count, sub_6C8D60 key i), "Signature check failed" (0x18429B9) on no
  match. The polarity is the reverse of the Alpha Trial's (there the flag is 1 in .data and 1 means check). A private
  server cannot sign, so the client needs a patch: NOP the `je` at 0x1842153 (`0F 84 ED 05 00 00` → 6×`90`; file
  bytes at vaddr 0x1842153, d1port address 0x1C42153). The server sends a bare protobuf, as for the Alpha Trial.

## 3. PSN OAuth
- bdAuthPS4 is DW 3.5 (`DemonWare\35\bdLobby\bdAuth\bdAuthPS4.cpp`; the pre-alpha is 3.4, the Alpha Trial 3.6).
  retrieveSCEAccessToken sets task 46 (0x1493B6C), status 700 (0x1493B62); NP auth code via the import stub
  0x1FA5B28 (also called by sub_157E780 / sub_157E950 with `psn:s2s`). Reply body at +0x230C, copied by
  sub_1494800.

## 4. Demonware
- bdAuth built at 0xA4DE24: sub_1493110(this, **5474** (0x1562, 0xA4DE17), auth3 hosts, port 443 (0x1BB)). Title 5474
  = the Alpha Trial's; the pre-alpha used 5475. Hosts panther-ps4-auth3.{dev,cert,prod}.demonware.net, env picked at
  0xA4F52B (lobby and auth3 together).
- makeAuth (sub_1492320): `auth_task` (+0x14), `iv_seed`, `title_id` (+0x10), all as strings (flag 1), then
  `extra_data` from vfunc +0x30 = sub_1494730: {`version` (+0x18, sub_1492670), `token` (+0x230C, the OAuth reply),
  `online_id` (+0x1E64)}.
- Reply (sub_1492690, from handleReply sub_1494110 with 47/128 at 0x1494182): HTTP 200 (0x1492702), auth_task == 47
  (0x14927CA), code == 700 (0x14927FC), iv_seed present, client_ticket and server_ticket each 128 bytes (0x1492888,
  0x14928EC), extra_data check vfunc +0x28 = sub_1492C30 `mov al,1`, magic 0xEFBDADDE (0x250BE78, checked
  0x1492933).
- Lobby: panther-ps4-lobby.<env>.demonware.net, port 3074 (`mov edx, 0xC02` at 0xA4E2E4, the only one in the DW
  integration). Protocol 210: client header 200,200,210,210 (sub_14AB1E0, 0x14AB27A-0x14AB2D2), server must pick 210
  (0x14A95E5, process210ExpectedServerHeader). CLIENTCHAL expands 16 bytes (0x14A9B0C), BDDATA 72 (0x14A9B4D): the
  key schedule lobby-210.ts implements.
- **bdMatchMaking service id 138** (0x8A) in every bdMatchMaking task (0x1497E69 ... 0x1499D76; tasks 1-5, 8-16), as
  in the Alpha Trial. No 21 anywhere among the 376 lobby task builders.
- NAT discovery: IP request [30][u16 2] (0x14F1FA0), reply version 2 checked (0x14F20E1); NAT type request
  [20][u16 2][u8 test] (0x14F8B40). Byte for byte the pre-alpha's serializers.

## 5. BAP
- client_config request 0x12 (0xA1E7D0, body a u64 BE, movbe 0xA1E847), response 0x13 (0xA1E890), decoded by
  0xA1E8D0 with the signon field 4 table 0x24D3300.
- xetrov 0xAB (0xA2D1F0), encoded at 0xA2D24A with nanopb 0x24D7F10 (identical to the pre-alpha's 0x2446650).
- Account id translation reply (sub_A1BD10): type 7 (0xA1BF61), 0xFF (0xA1BF6E), the pre-alpha's shape.
- Checksums: sub_1989DB0 (login_account response) compares the response's +0x10/+0x14 (0x1989F44, 0x1989F51) with
  the investment globals tag's +0x430/+0x434 (sub_17C62B0 returns +0x410, then +0x20/+0x24). A mismatch logs
  "investment:globals: verify checksums failed" (0x26AF875) only. The tag (investment_globals 0x808FC063 in this
  build's packages, read with gibbon v39573 `s_investment_globals` unknown430/434) holds schema **0x5AB15DC3**
  (1521573315) and content **0x3D77CF98** (1031262104). The pre-alpha's are 0xD6909BCC / 0x03BA02E6.

## 6. Activity Host map
- Names: table 0x2C3C040 (getter sub_183B290, asserts id < 43), the Alpha Trial's 43 names in the same order.
- Send sub_1818AB0 (the pre-alpha's sub_17D2C00, same bytes): edx = id, ecx = class handle (loaded from the class
  handle global), r9 = size. Receive table 0x2C3BEC0 ({u64 id, handler}, the pre-alpha's ids). Handle = the
  `rsat-descriptors.json` handle with that checksum. ff handle / checksum / size, then the pre-alpha's checksum when
  it differs:
  - 0 80800D64 ad8f7e0e 1536; 1 80800E76 e10d3778 2592; 2 80800DC1 bd20504f 8
  - **3 80800E98 709b5d86 248** (pre-alpha e79029e2); **4 80800A58 e8334abb 408** (pre-alpha 207bda50)
  - 6 raw (handle -1, 0x1818257); 7 808004B1 3a4ad118 8 (by checksum; the handler 0x182FA80 decodes it inside);
    8 request_activity_host raw, 1864 bytes (0x181AEEC); 15 raw, 1 byte (0x181598D)
  - 11 replicate_membership: handler 0x182FEE0 → sub_182ACA0 decodes 808009ED 49134a0e (20720)
  - 12 80800BB9 632d482d 816; 13 80800A1D 15781e7a 16; 14 80800E84 e38d20b1 16; 17 808009E7 0be1e2c8 8;
    18 80800B41 4943fcda 568; 19 80800D21 a288d9f7 4; 20 80800E22 d0a993cc 1536; 22 80800C2D 776952f7 40;
    23 80800D58 abc780d6 1544; 24 80800D10 9fb6f3e5 1540; 25 80800E31 d325c75f 1544; 26 80800CB8 8fef1eb3 1540;
    27 80800D31 a4fae5df 4; 28 80800C9C 8b13c2fc 4; 29 80800B09 41491b36 4; 30 80800CD2 94b8bb41 1544;
    31 80800CF6 99cc48c0 1540; 32 80800A22 16ba3407 1540
  - **33 abdicate_authority 80800A3D 1b4fa5fa 528** (sent here, 0x1820EB7; not seen in the pre-alpha)
  - 35 80800A17 146cee39 8; 36 80800BD0 66d02bfa 4
  - **37 send_client_heartbeat 80800D06 9dbed534 55440** (pre-alpha f06b5751 52864, Alpha Trial 58480)
  - 38 script_state 808052E5 5f216e71 8196; 39 80800C0A 70af6842 272; 40 80800EC9 f09dc6e5 1; 41 80800CAE 8dae4109 4;
    42 80800ADC 38031cdc 1
  - Every checksum not marked is the pre-alpha's. Not seen: 5 (handler sub_18308B0 is a stub), 9, 10 (handler
    0x1F53320, no schema in its first 0x400 bytes), 16, 21, 34.

## Open
- Heartbeat 37 and join 3/4 layout changes against the pre-alpha (compare their members in the catalogs); request
  activity host raw layout; xetrov event table; the manifest GET buffer size.
