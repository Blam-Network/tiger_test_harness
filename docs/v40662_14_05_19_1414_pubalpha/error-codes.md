# PS4 alpha 40662 error codes

Every error the Alpha Trial client (40662.14.05.19.1414.pubalpha, run on d1port_alpha) has shown, what it
means, and what fixed it. Add a row whenever a new one shows up. Ids and names are the day0 table's
until the alpha's own table is read.

| Code word / text | Error id / name | When | Cause | Status |
|---|---|---|---|---|
| canary | 142 error.no_ethernet_link (day0 id, by code word) | Offline boot, after the loading screen (2026-10-22) | The offline runtime reports no network link; expected without D1_ONLINE_CONFIG | Expected offline |
| marionberry | 143 error.transport_method_invalid (day0 id, by code word) | Online boot, before signon | Demonware address and NAT type discovery (UDP 3074 to stun.<region>.demonware.net) got no answer | Fixed (src/demonware/nat-discovery.ts) |
| "destiny server not available" | not recorded | Online boot, PSN OAuth | The native client's host override JSON was malformed (walk-alpha.sh), so the PSN OAuth POST went out as real HTTPS and failed | Fixed (walk-alpha.sh) |
| cattle | 148 error.demonware_connection_timeout (day0 id, by code word) | After signon and Demonware auth, lobby connect | The client speaks lobby protocol 210 (header 200,200,210,210, sub_1418180; it requires the server to pick 210, sub_14164B0); the server only does the plaintext 200 flow | Fixed (src/demonware/lobby-210.ts) |
| chicken | 161 error.no_investment_connection (day0 id, by code word) | After login_account and fetch_family, 2026-10-22 | The self family subscription threw: the BAP unlock policy was the 41375 build's flag indices, which the alpha's slot tables lack (`no offer slot sets unlock flag 1745`) | Fixed (alpha unlock policy from its own slot tables) |
| centipede | 160 error.no_bap_connection (day0 id, by code word) | Right after director_complete_bink_activity and account id translation | The translation reply was the Xbox one (account type 1, u64 ids); the alpha's reader (sub_996A90) wants type 7 and 36-byte PSN account nests | Fixed (account-id-translate.ts, per-build platformAccount) |
| guest fault 0x9A8296 (no code word) | none | Activity start, job thread | Self character progression rows (8080176B) sent in the 41375 member order: the client's progression lookup (sub_6E6E70) found none and read null | Fixed (alpha values.ts characterProgressionRows) |
