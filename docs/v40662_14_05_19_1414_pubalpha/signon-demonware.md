# PS4 alpha 40662 sign-on and Demonware

2026-10-21. `eboot.bin` (CUSA00942, 40662.14.05.19.1414.pubalpha), idalib :13342. IDA address = ELF vaddr
(segment 1 vaddr is already 0x400000). The IDB has no relocations applied: .data pointers were resolved
from the ELF `DT_SCE_RELA` table (R_X86_64_RELATIVE, offsets equal IDA addresses). Protos:
`proto/v40662_14_05_19_1414_pubalpha/{signon,content_manifest,client_config,xetrov}.proto`.

## nanopb
- 0.2.x layout, packed 23-byte fields: u32 tag, u8 type, u8 data_offset, i8 size_offset, u32 data_size,
  u32 array_size, u64 ptr. HTYPE 0x00/0x10/0x20/0x30 = required/optional/repeated/callback; LTYPE
  0 varint, 4 bytes, 5 string, 6 submsg. Bytes fields carry an 8-byte size_t header (max = data_size - 8).
- Required check (0x4CE300-0x4CE37E): a missing required field fails only if it has no default (ptr 0)
  and is not a submessage. So ticket fields 1-7 and configuration 1-2 are enforced; Engine Configuration
  fields all have defaults.

## 1. Sign-on
- URL (sub_715970 0x715C2B-0x715CDB): index i = random 0..15; `https://www%d.%s/%s` with www(i/2+1)
  and host table qword_205FDE0 (reloc: [0] signon.gravityshavings.net, [1] signon.deadorbit.net) picked by
  i&1, path `SignOn?platform=%s&build=%s` then filled with `orbis` and the build (line 12 of the version
  blob = `40662.14.05.19.1414.pubalpha`, sub_475D20). Retry bumps i, wraps at 15 (0x715930). An override
  list at signon+16456 (125-byte entries) exists, source not traced. Port 443 (https).
- Method: request type 2 (sub_4CA360) -> sub_4CB0D0 -> sub_1402590 POST, Content-Type
  `application/octet-stream`. Response buffer 0x4000. HTTP failure 503/509 -> retry state, else error
  (sub_716340).
- Request (nanopb 0x1B9FA90, filled 0x7159AD-0x715B8C): 1 = 13; 2 callback bytes = platform token; 3
  string 8 (language); 4 callback bytes = previous security_token (sub_716450); 5 string 64; 6 string 64
  (`-1` default, sub_B83A80); 7 bool; 11 email 255; 12 bytes 256 = queue field 7 echo; 13 FNV-1a-64 of the
  session id; 15 repeated u32 <=64 (response field 10 echo); 17 string 64; 18 string 256.
- Platform token: NOT an NP ticket. bdAuthPS4::retrieveSCEAccessToken (sub_13FF7C0, task 46): NP auth
  code via sceNpAuthGetAuthorizationCode (sub_13FF090, scope `openid`), then POST
  `https://auth.api.{sp-int|prod-qa|np}.ac.playstation.net/2.0/oauth/token` (sub_13FF550), body
  `grant_type=authorization_code&client_id=..&client_secret=..&code=..&scope=openid&redirect_uri=orbis%3A%2F%2Fgames`.
  Reply must be JSON with `scope` and `id_token` (handleGetAccessTokenReply 0x14000C0). The raw reply
  body (+0x230C, <2048) is copied out by getSCEAccessTokenData (sub_13FF9A0) and sent as field 2
  (sub_712650 requires status 700). Env from NP issuer id: 1 dev/sp-int, 8 cert/prod-qa, 0x100 prod/np.
- Response (nanopb 0x205FA30, sub_714F80): type 0 needs field 2 (sub_7153C0); 1 = queue (field 3);
  2 = error (field 7); 3 = state 8. Ticket: 1-3 bytes <=16, 4 bytes <=512 (heap copy, keep non-empty),
  5 u64 expiry (refresh at max(min, expiry-now-margin), sub_713460), 6 bap_ipv4, 7 bap_port, new 9
  {3x fixed32, unused} and 11 u64 seconds-from-now (overrides 5). Field 4 {u64, u32, EngineConfiguration}
  is the same table as BAP client_config_response, so names cookie / social_matchmaking_id. Field 5
  logged as silo_id, 6 as signon_server_reported_content_version, 8 prompt flags (0x7152B5).

## 2. Content manifest
- Required: sub_B4D240 returns 1, so an empty URL is fatal ("Signon server failed to provide content
  manifest URL.", 0xB85D4A). URL = Engine Configuration 1.2 (+4104), guid 1.3 (+4360) (sub_7146A0/E0).
- GET (sub_4C9E00 type 0), buffer 321864. Signature flag unk_1FF14B4 = 1 in .data, no writer: body =
  u32 1, u32 0, 256-byte RSA-PSS (SHA-256, salt 16) over the rest, checked against a runtime key list
  (sub_541DB0, 0x719977). A private server cannot sign: this is the PS4 twin of the Xbox byte
  0x833DB860 that Sunrise clears; on PS4 the same byte must be 0 client-side or no manifest passes.
- Manifest (nanopb 0x20600B0): lists 1 (<=64), 2 (<=64), 3 packages (<=800, same shape as Xbox), 4
  (<=256), 5 guid. Guid must be present and equal 1.3 (0x719E2D); ids in lists 1 and 2 must be unique.

## 3. client_config / xetrov / datamine
- BAP ids unchanged: client_config 0x12/0x13 (0x997510/0x997560), xetrov 0xAB (0x9A03E0), secure hello
  0x19/0x1A, queuez register 0x79. client_config request is a raw u64 BE (0x997530); response decodes
  with 0x1B99460 (cookie, social_matchmaking_id, engine configuration). Xetrov envelope 0x1BA67C0
  matches Xbox; inner event table not dumped.
- Datamine upload defaults are in Engine Configuration: field 3 {1, 0, dm-partnernet.upload.deadorbit.net,
  /ticket_drop, 32556, 1} and field 20.6 dm-tiger.upload.deadorbit.net. Same as Xbox.

## 4. Demonware
- bdAuthPS4 built at 0x9CE7D7: title id 0x1562 = 5474 (+16, sub_13FDE00), port 443, hosts
  panther-ps4-auth3.{dev,cert,prod}.demonware.net (env from NP issuer id; retail = prod).
- authorizePS4 (sub_13FEEE0): NP auth code -> PSN OAuth (as above) -> makeAuth (sub_13FE010) POST
  `https://<auth3>:443/auth/`, application/json: `{"auth_task":"46","iv_seed":"<u32>","title_id":"5474",
  "extra_data":"<json string>"}`; values are strings (setUInt64 asString=1, sub_1406650). extra_data
  (0x1400440) = `{"version":"0","token":"{\"scope\":..,\"id_token\":..}","online_id":"<psn id>"}`.
- Reply (sub_13FE380, args 47/128): HTTP 200, JSON; auth_task == 47 (0x13FE4BD), code == 700 (0x13FE4EF),
  iv_seed present, client_ticket and server_ticket base64 each exactly 128 bytes (0x13FE57B, 0x13FE5DF),
  extra_data NOT checked (vfunc 0x13FE920 returns 1), magic 0xEFBDADDE (0x13FE626). getUInt64 accepts
  number or string. Client ticket layout unchanged (sub_1406F50: u32 magic, u8, u32 title, u32, u32,
  u64, u64, 64 name, 24 key, 3, 4).
- Lobby: panther-ps4-lobby.<env>.demonware.net, DNS lookup then port 0xC02 = 3074 (0x9CEAE5), same port
  for the authed (0x9CEB4A) and anonymous (0x9CEC8B) branches. No LSP, so 1020/1021/1011 are not used.
  Same DW 3.6 lobby code (sendTask200, getMessageToDispatch200). STUN stun.{us,eu,jp,au}.demonware.net.
- Lobby encryption: per-connection flag conn+0x158 set from lobbyService+0x53C (0x140B212); its source is
  not traced. demonware_encryption_enabled defaults to 1 (0x7512F4). Xbox was plaintext; check the first
  PS4 frames before assuming.

## 5. BAP
- Address from the ticket: sub_6436A0/sub_6436B0 -> sub_F05BA0 (0xF05D5F); both must be non-zero. The
  value is byte-swapped twice (0x715520, 0xF05D74) and logged as `%3d.%3d.%3d.%3d` from the low byte up:
  127.0.0.1 = 0x0100007F, the encoding web-tiger already uses.
- Session keys land at signon+16831/16847 as on Xbox. Secure hello response (0x99A890): u32 BE length ==
  body-4, <= 0x5C, matches our 0x50 + 16 + 32 + 32 reply.

## 6. Other gates
- PSN OAuth endpoint twice (signon token, DW auth). PSN WebAPI session calls (`/v1/sessions...`) and
  NP tasks (check_plus, parental controls, PSN availability) exist; not traced as gates.

## Open
- Lobby encryption source; xetrov event table; meaning of request 5/17/18 and ticket 9; HTTPS
  certificate handling in bdHTTP (libhttp) for signon/auth3/PSN hosts.
