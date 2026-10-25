# PS4 pre-alpha 38464 sign-on, Demonware, BAP and client patches

2026-10-22. `D:/Games/ps4/betath-38464/eboot.bin` (38464.14.02.28.1027.betath, sha256 e74778c8...). Read from
the ELF bytes (capstone, `.eh_frame_hdr` function starts, `DT_SCE_RELA` relocations) and the headless IDA on
`eboot-ida.elf` (:13345). IDA address = ELF vaddr. Every key comparison below was read in disassembly.
Protos: `proto/v38464_14_02_28_1027_betath/{signon,content_manifest,client_config,xetrov}.proto`.
Reference: `docs/v40662_14_05_19_1414_pubalpha/signon-demonware.md` (the Alpha Trial, "alpha" below).

## 1. Sign-on
- URL (sub_7561F0): same scheme as the alpha. i = random 0..15, `https://www%d.%s/%s`, www(i/2+1), host table
  0x2A89000 ([0] signon.gravityshavings.net, [1] signon.deadorbit.net), path `SignOn?platform=%s&build=%s`
  filled with `orbis` and the build (0x7566A1-0x7566B3). Build = line 12 of the version blob (0x2A1A800, sub_62A200):
  `38464.14.02.28.1027.betath`. POST via sub_707DD0, response buffer 0x4000. An override list sits at
  signon+0x4035 (125-byte entries, count +0x48C2).
- Request (sub_756410, nanopb 0x2441B10): fields 1-8, 11, 12, 13, 15. No 17/18 (the alpha has them). 1 = 13;
  2 callback = platform token; 3 language (8); 4 callback = previous security_token; 5 = UI string (sub_759240,
  sent only when not empty); 6 = the build string (sub_628390); 7 bool; 11 email; 12 queue token echo; 13 FNV-1a 64
  of the session id (sub_6DDB70); 15 response field 10 echo.
- Platform token is NOT the PSN OAuth reply. The signon platform state (sub_17F5290 / sub_17F56E0) calls
  sceNpAuthGetAuthorizationCode with client id `431cc77e-18d7-4abc-9e1f-e32188128783` (sub_72DD90), scope
  `psn:s2s` (sub_72DDA0), and sends the code string (strlen, 0x17F58D7) as field 2 (0x17F8822: state 3, +0xA8/+0xB0).
- Response (sub_754C10, nanopb 0x2A91C30): fields 1-8, 10. No 12. Type jump table 0x7555EC: 0 success (field 2,
  sub_755610), 1 queue (field 3, sub_755AD0), 2 error (field 7, sub_755E40), 3 -> state 7. Field 8 prompt flags
  0x4/0x8/0x10 as in the alpha. Ticket (0x2A91D20): 1-7 required, 9 optional, no field 11. Keys copied to
  signon+0x4882/+0x4892. BAP address: ipv4 (+0x258) byte-swapped into signon+0x48A8 only when non-zero
  (0x75594D), port +0x25C; swapped back at connect (0xFC8584); both must be non-zero (0xFC7F6B, 0xFC7F70).
  Same encoding as the alpha (127.0.0.1 = 0x0100007F). Port override global 0x2E737E2 wins when set (sub_74BC00).
- Field 4 (0x2441C40): cookie, social_matchmaking_id, field 3 a callback that decodes Engine Configuration
  (0x2A916D0) in place (sub_755600 -> sub_74BA30).
- Required-field twist present (0x15CA520-0x15CA55F): same as the alpha.

## 2. Content manifest
- Engine Configuration field 1 (0x2A89110) has two fields: 1 bytes 4096, 2 manifest url 256 (+4104). No guid.
- content_check (sub_8AFCA0): url null -> error; url empty -> "Game will proceed with an empty content
  manifest" (0x8AFFB9), state 3, no fetch. So a server may omit the url.
- Fetch: GET (sub_17F9A40 -> sub_707030), 65536-byte buffer. Decode sub_17F9BF0 at 0x17F9CDE: nanopb 0x2BC5170
  from byte 0 of the body. No signature header, no signature flag, no guid check. Lists 1-4 only: list 1 entry
  {id, string 128, u32}, list 3 package {offer_id, name 256} (no package_id/header_value), list 4 as alpha.
- A failed download logs and moves on (0x8AFEC3, state 3).

## 3. PSN OAuth
- Only on the Demonware path. bdAuthPS4 getSCEAccessToken (sub_146AB20): same endpoint
  `https://auth.api.{sp-int|prod-qa|np}.ac.playstation.net/2.0/oauth/token`, same body
  (`grant_type=authorization_code&...&scope=openid&redirect_uri=orbis%3A%2F%2Fgames`), x-www-form-urlencoded.
  Reply keys `scope`, `id_token` (handleGetAccessTokenReply sub_146B3F0). Same as the alpha.

## 4. Demonware (DW 3.4 here; the alpha is DW 3.6)
- Title id **5475** (0x1563, 0xA19F67); alpha 5474. Port 443, hosts panther-ps4-auth3.{dev,cert,prod}.
- makeAuth (sub_1469840): `auth_task`, `iv_seed`, `title_id` as strings, `extra_data` = {version (0, caller
  0xA19FD4), token, online_id} (sub_146B750). Request task 46 (0x146A6C9), reply task 47 (0x146B1B2), code 700
  (0x1469D21), tickets 128 bytes (0x146B1B7, 0x1469E11), magic 0xEFBDADDE (0x247A4F8, checked 0x1469E58), extra_data
  check returns 1 (0x146A150). Same as the alpha.
- Lobby: panther-ps4-lobby.<env>, DNS then port 3074 (0xA1A3F4), same for authed (0xA1A529) and anonymous
  (0xA1A7AB) branches. Protocol 210: client header 200,200,210,210,conn+0x9C,conn+0x208 (sub_14829A0),
  server must pick 210 (0x1480DA5, process210ExpectedServerHeader). CLIENTCHAL expands 16 bytes, BDDATA 72
  (0x14812B4, 0x14812F5): same key schedule shape as lobby-210.ts.
- **bdMatchMaking service id 21** (0x15) in every bdMatchMaking task (0x146EA5C ... 0x1470370; tasks 1-5, 8-16).
  The alpha uses 138; 21 is the Xbox value.
- NAT discovery: IP request [30][u16 2] (sub_14C7A00), reply version 2 checked (0x14C7B41); NAT type request
  [20][u16 2][u8 test] (sub_14CE540). Same as the alpha.

## 5. BAP
- Account id translation reply (deserializer 0x9E88D0, header sub_9E8570): u16 count, u8 type must be 7
  (0x9E8B15), u8 0xFF (0x9E8B22), count PSN nests of 0x120 bits = 36 bytes (sub_75F400), u64 soids. Same as alpha.
- client_config 0x12/0x13, xetrov 0xAB, AH notifications 8 (client->AH) and 0x64 (AH->client): same ids.
- Checksums: the login_account response handler sub_1941F90 (registered at 0x2B92BA0) compares the response's
  +0x10/+0x14 with the investment globals tag's +0x430/+0x434 (sub_1783A40 +0x410, +0x20/+0x24). The tag values are
  logged at load (sub_1780450). They are tag data, not computed by the eboot: investment_globals 0x808F6049
  (gibbon s_investment_globals unknown430/434) holds schema **0xD6909BCC** (3599801292), content **0x03BA02E6**
  (62522086). A mismatch only logs ("verify checksums failed", 0x19422F7); nothing else happens.
  `src/bungie-access-protocol/versions/v38464_14_02_28_1027_betath/checksums.ts` says the client never reads them
  (0x9A7310): wrong for this eboot (0x9A7310 is mid-instruction); send the tag values.

## 6. Activity Host map
- Names: table 0x2BBE840 (getter sub_17F2980), the alpha's 43 names in the same order (day0 enum matches).
- No bitmask switch like the alpha's sub_710E40. Ids come from the send calls (sub_17D2C00: edx = id, ecx =
  class handle, r9 = size) and the receive table 0x2BBE6C0 ({id, handler}). Handle -> checksum via table
  0x2AB2370 (4737 {global, checksum}); checksum -> hash in `rsat-descriptors.json`. This build numbers classes
  its own way (0x25-0x33 below the alpha's hash for the same message).
- id: hash (size) — 0 80800D31 (1536), 1 80800E43 (2592), 2 80800D8E (8), 3 80800E66 (248), 4 80800A33 (408),
  7 80800486 (8, inside the sensor_message handler), 12 80800B92 (816), 13 808009F8 (16), 14 80800E51 (16),
  17 808009C1 (8), 18 80800B15 (568), 19 80800CF1 (4), 20 80800DEC (1536), 22 80800C02 (40), 23 80800D26 (1544),
  24 80800CE0 (1540), 25 80800DFB (1544), 26 80800C8C (1540), 27 80800D00 (4), 28 80800C71 (4), 29 80800AE1 (4),
  30 80800CA6 (1544), 31 80800CC7 (1540), 32 808009FE (1540), 35 808009F1 (8), 36 80800BA7 (4), 37 80800E94
  (52864), 38 80805290 (8196), 39 80800BDF (272), 40 80800E95 (1), 41 80800C82 (4), 42 80800AB5 (1).
- Sizes match the alpha except 37 send_client_heartbeat (52864 here, 58480 alpha). 8 request_activity_host goes
  raw (handle -1, flag 1, 1864 bytes, 0x17D4FEC); the alpha names a schema. 18 incident and 38 script_state have
  schemas here (custom in the alpha). Not seen: 5, 6, 9-11, 15, 16, 21, 33, 34.

## 7. Client patches (d1port)
- None needed: no manifest signature (above), and the job-help routine sub_71CA70 (the alpha's sub_5514D0)
  null-checks the TLS +88 job context (getter sub_6CF8D0, 0x71CB27 `test r14,r14; je 0x71CC54`).
  `staging/d1port_betath/native/guest/betath-38464.xml` records this with no entries; `guest_patches.py --list`
  says "no enabled patch to apply" (exit 1), as expected.

## Open
- Heartbeat 37 layout; request_activity_host raw layout; ids 33/34 senders; xetrov event table.
