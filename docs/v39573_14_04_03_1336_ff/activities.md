# Activities in PS4 39573.14.04.03.1336.ff

Read from the build's own packages (`D:/Games/ps4/ff-39573/packages`, 76 .pkg). gibbon has no ff folder yet, so this was read with a scratch copy of gibbon's betath reader (`v38464_14_02_28_1027_betath`) with two changes: the tag block marker is 0x80800184 (betath 0x80800165), and class checks are recorded instead of enforced, because ff renumbers its class ids. Every block and struct pointer landed on the marker, and each betath class mapped to exactly one ff class, so no layout drift was found. The betath struct layouts hold for everything read here: activity table and definitions, matchmaking, playlists, client activity display entries, localized strings, director destinations, scenario_client, slice descriptors, blueprint sets and activity bundles.

Class ids that moved (betath -> ff), for the gibbon ff folder: activity table 0x808018E8 -> 0x80801915, table entry 0x80801878 -> 0x808018A7, definition tag 0x80801848 -> 0x80801872, definition 0x808017F9 -> 0x8080181E, scenario_client 0x80800719 -> 0x80800616, investment globals 0x808016B8 -> 0x80801750, client globals 0x80803429 -> 0x80803389, manifest package 0x80800169 -> 0x80800188, client destination row 0x80803391 -> 0x80803392, director destination entry 0x8080181A -> 0x80801841, node 0x808018EB -> 0x80801918, node activity 0x80801761 -> 0x8080177D, node state 0x80801772 -> 0x80801791, playlist 0x80801895 -> 0x808018C0, playlist entry 0x8080173F -> 0x8080175E, matchmaking 0x808016E0 -> 0x80801700, localized strings entry 0x8080347A -> 0x80803473. Unchanged: 0x8080000B, 0x80800070.

Layout changes outside the activity definition: the client globals (the investment_globals manifest root) have 51 slots (betath 50), so from slot 2 on each client slot is betath's + 1: client activity display table 3, client destinations 5, item displays 26, localized strings 45. Slot 2 is a new 56-byte tag. Investment globals slots are unchanged (director destinations 2, activities 3); slot 40 is empty.

## Summary

- 309 activity rows (betath 244). 292 have a name string, 17 have none.
- 71 distinct names (betath 77).
- 9 scenario_client tags (class 0x80800616): ambient_bootstrap, orbit, cosmo_portal_1, cosmo_patrols_1, ambient_cosmo, city_tower_default1, ambient_city_tower, dlc_test_activity, ambient_dlc_test_map. Four are activity-table names (cosmo_portal_1, cosmo_patrols_1, city_tower_default1, dlc_test_activity), covering 16 rows. orbit, ambient_bootstrap and the ambient_* tags are not named by any row. Every scenario's bundles are present and readable (checked by walking scenario_client -> slice descriptors -> blueprint sets -> bundles).
- No Crucible scenario in the packages: the only pvp package is `globals_pvp`. pvp_factory and pvp_marsbattle, loadable in betath, are not loadable here. Newly loadable: dlc_test_activity (scenario destination `dlc_test_destination`, packages `dlc_test_map_*`).
- Display name: the client activity display table (client globals slot 3, one entry per activity id, struct class 0x808034B2) holds name and description string refs into the localized strings. ff's string banks keep only the strings of shipped content (25 rows resolve). A name with `*` is the same string key looked up in betath's banks; `?` means neither build has it.
- Type: `activity_type`. ff adds a new type 3 (strike playlist; betath used 2 for both strikes and their playlists) and a new type 0, so every betath type >= 3 is +1 here (social 3 -> 4, pvp intro 4 -> 5, crucible modes 5-9 -> 6-10, crucible playlist 10 -> 11, raid 12 -> 13, patrol 13 -> 14, 15 -> 16). Type names are my reading of the rows, not from the data. Type 0 is the fourth row of each story mission (same level, no completion flag); what it means is unknown.
- Destination: `destination_index`. It no longer indexes the client destination table by row (that table still has all 19 rows, Moon and Mars included). Matching activity hashes against betath: ff 1 = betath 1 (Cosmodrome), 3 = 3, 4 = 10 (Crucible), 5 = 12 (City tower), 6 = 13 (Venus). Every Moon, Mars and cinematic row is 255. So the index looks like it goes into a compacted list of the destinations this build ships (0 and 2 unused by any row). Which table that is was not found.
- Level: `activity_level`. Story levels are lower than betath (Cosmodrome 1-4, Moon 7-8, Venus 10-11, Mars 13-15), and strikes now start at 8 (Cosmodrome). The float after the level (betath `unknown0c`, always 50 * (level + 1) there) no longer follows that rule.
- Director node: `Dd.n` is director destination d (investment globals slot 2), node n. D0 (name hash 0x0248BE86) is the dev/test map, D1 (0xA67020CB) the full map, D2 (0x3DA7A9E3) is new in ff and replaces betath's D2 (0x4EB4C784). See below.

## Loadable activities

| Scenario | Rows | Destination (scenario) | Bundles | What it is |
|---|---|---|---|---|
| city_tower_default1 | 0, 285, 294, 305 | city_tower | 5 | Tower. Rows 0 (D1), 285, 294 (D0, test_mm_city_tower), 305 (D2). |
| cosmo_patrols_1 | 10, 304 | cosmo | 71 | Explore Cosmodrome (patrol, level 4). Row 10 (D1) and 304 (D2). |
| cosmo_portal_1 | 240, 241, 242, 258, 264, 270, 276, 303 | cosmo | 46 | Strike Den of Devils. Rows 240-242 (levels 8/10/12, strike ladder), 258/264/270/276 (18/20/22/24, members of strike playlists 236-239), 303 (level 8, D2 node). |
| dlc_test_activity | 288, 301 | dlc_test_destination | 2 | DLC Test Activity, 9 players. Row 288 (D0, Venus index) and 301 (D2, Cosmodrome index, next 302). |

Scenario-only (no activity row): orbit (11 bubbles, 1 bundle), ambient_bootstrap, ambient_cosmo (43 bundles), ambient_city_tower (5), ambient_dlc_test_map (1). Tower has 5 bundles per scenario (betath 6); cosmo_patrols_1 71 (betath 69), cosmo_portal_1 46 (betath 47).

## Director D2 (new in ff)

| Node | Hash | Activity | States (state/requirement tokens) |
|---|---|---|---|
| 0 | 0x46775164 | 229 act_cosmo_m0_highway | 2/0 |
| 1 | 0x854393B8 | 151 act_cosmo_m0_5_hangar | 2/0 |
| 2 | 0x854393B9 | 155 act_cosmo_m1_dome_a | 2/0 |
| 3 | 0x854393BA | 159 act_cosmo_m2_dome_c | 2/0 |
| 4 | 0x854393BC | 301 dlc_test_activity | 2/2, 3/1 |
| 5 | 0x410A07B0 | 304 cosmo_patrols_1 | 3/1 |
| 6 | 0x881EB920 | 303 cosmo_portal_1 | 3/1 |
| 7 | 0x6796A864 | 305 city_tower_default1 | 3/1 |

State numbers per gibbon: 0 hidden, 1-2 teaser, 3 available, 4 completed; the last row whose requirement holds wins. So D2 shows the first four story missions (highway, hangar, dome_a, dome_c) as teasers, and offers patrol, strike, Tower and the DLC test once their requirement holds. Rows 229, 151, 155 and 159 have no scenario_client, so those nodes cannot launch. D2 has no Crucible node (betath's D2 had playlist 243); the matching ff playlist 308 (rows 306, 307) is still in the table but no node points at it.

## Playlists and hoppers

- Crucible playlists 14-18 (type 11, no name; betath strings Rumble, Clash, Skirmish, Control, Salvage) each list 25 map rows of one mode: 14 -> type 6, 15 -> 7, 16 -> 10, 17 -> 8, 18 -> 9. Levels 9, 7, 11, 5, 13.
- Small Crucible playlists: 297 (Dominion Playlist) -> 295, 298 (FFA Playlist) -> 296, 308 (Control *) -> 306, 307.
- Strike playlists 236-239 (type 3, Cosmodrome index, levels 18/20/22/24) each list the six strikes at that level: cosmo_portal_1, moon_portal_2, venus_portal_1, venus_portal_2, mars_portal_1, mars_portal_2 (betath had three, at 20/22/24).
- Chained rows (next_activity): 203-205 -> 207 (northern tides -> act_cinematic_queen_102), 224-226 -> 228 (lowergarden -> cine_end), 229 -> 230 (highway -> cine_reveal), 231 -> 232 (action_mock -> act_cinematic_queen_101), 301 -> 302.
- Crucible maps: the same 27 as betath, each with five mode rows (types 6, 7, 10, 8, 9) except pvp_mining (6, 7 only); pvp_intro rows 233-234 (type 5). Extra rows: pvp_factory 284, 286, 295, 296, 306; pvp_gladiator 287; pvp_marsbattle 307.

Hoppers (matchmaking hopper tag, the rows using it, by type):

| Hopper | Rows | Types (count) |
|---|---|---|
| 0x808FC3EA | 1 | social/tower (1) |
| 0x808FC3EF | 29 | crucible mode A (3v3) (28), crucible playlist (1) |
| 0x808FC3F0 | 54 | crucible mode C (6v6) (1), crucible mode D (3v3) (25), crucible mode E (3v3) (26), crucible playlist (2) |
| 0x808FC3F2 | 1 | crucible mode B (6v6) (1) |
| 0x808FC3F9 | 4 | strike playlist (4) |
| 0x808FC3FB | 42 | strike (portal) (42) |
| 0x808FC3FE | 3 | social/tower (3) |
| 0x808FC3FF | 1 | strike (portal) (1) |
| 0x808FC401 | 2 | crucible mode A (3v3) (1), crucible playlist (1) |
| 0x808FC402 | 1 | strike (portal) (1) |
| 0x808FC403 | 61 | crucible mode B (6v6) (26), crucible mode C (6v6) (30), crucible mode D (3v3) (1), crucible playlist (4) |

## Comparison with betath (38464.14.02.28.1027.betath)

Loadable in betath: city_tower_default1, cosmo_portal_1, cosmo_patrols_1, pvp_factory, pvp_marsbattle. Loadable in ff: city_tower_default1, cosmo_portal_1, cosmo_patrols_1, dlc_test_activity.

- Lost: pvp_factory, pvp_marsbattle and their ambient scenarios (ff ships no pvp map packages). Nothing in ff's Crucible can load.
- Gained: dlc_test_activity and ambient_dlc_test_map (`dlc_test_map_*` packages).
- Table grew 244 -> 309 rows and is reordered: activity hashes carry over but indices do not (cosmo_patrols_1 4 -> 10, Crucible playlists 8-12 -> 14-18, cosmo_portal_1 183 -> 240, Tower 0 stays 0). Match by hash, never by betath index.
- New names: act_cosmo_m0_5_hangar (rows 151-154, level 2), moon_portal_1 (rows 7-9, levels 22/26/28, min 3 players, no display string), cine_reveal (230, after the highway mission), cine_end (228, after lowergarden). New venus_portal_1 rows 4-6 at 22/26/28 with min 3 players: with 7-9 these look like a harder matchmade strike tier (unconfirmed).
- Removed names: venus_raid_1 (Vault of Glass, 3 rows), act_cosmo_m3_refinery, act_venus_m03_thieves_den, act_mars_m02_rubicon, act_mars_m04_checkpoint, act_city_tower_cine_101, act_city_tower_cine_103, venus_treasure_archive / north_tides / ketch (9 rows). The only raid-type row left is transition_test_activity 293.
- Story missions: four rows each (three type 1 with a completion flag, one type 0 without) where betath had one.
- Strikes: each has its own level ladder (cosmo 8/10/12, moon_2 10/12/14, venus_1 and venus_2 12/14/16, mars_1 14/16/18, mars_2 16/18/20) plus one row per playlist level 18-24. betath had a base level plus 20/22/24.
- Types and destination indices renumbered, story levels lowered (see Summary).
- Director: D2 is new (0x3DA7A9E3, 8 nodes, above). D1 has 47 nodes (betath 49), D0 11 (betath 10).

## All activities by destination

### Destination index 1: Cosmodrome (38 rows)

| Index | Name | Display name | Type | Level | Players (fireteam) | Director node | Loadable | Notes |
|---|---|---|---|---|---|---|---|---|
| 10 | cosmo_patrols_1 | Explore Cosmodrome | patrol | 4 | 1-3 (fireteam 3) | D1.20 | YES |  |
| 151 | act_cosmo_m0_5_hangar | ? | story/mission | 2 | 1-3 (fireteam 3) | D1.1, D2.1 | no |  |
| 152 | act_cosmo_m0_5_hangar | ? | story/mission | 2 | 1-3 (fireteam 3) |  | no |  |
| 153 | act_cosmo_m0_5_hangar | ? | story/mission | 2 | 1-3 (fireteam 3) |  | no |  |
| 154 | act_cosmo_m0_5_hangar | ? | story variant (type 0) | 2 | 1-3 (fireteam 3) |  | no |  |
| 155 | act_cosmo_m1_dome_a | Restoration * | story/mission | 3 | 1-3 (fireteam 3) | D1.2, D2.2 | no |  |
| 156 | act_cosmo_m1_dome_a | Restoration * | story/mission | 3 | 1-3 (fireteam 3) |  | no |  |
| 157 | act_cosmo_m1_dome_a | Restoration * | story/mission | 3 | 1-3 (fireteam 3) |  | no |  |
| 158 | act_cosmo_m1_dome_a | Restoration * | story variant (type 0) | 3 | 1-3 (fireteam 3) | D1.2 | no |  |
| 159 | act_cosmo_m2_dome_c | The Warmind * | story/mission | 4 | 1-3 (fireteam 3) | D1.3, D2.3 | no |  |
| 160 | act_cosmo_m2_dome_c | The Warmind * | story/mission | 4 | 1-3 (fireteam 3) |  | no |  |
| 161 | act_cosmo_m2_dome_c | The Warmind * | story/mission | 4 | 1-3 (fireteam 3) |  | no |  |
| 162 | act_cosmo_m2_dome_c | The Warmind * | story variant (type 0) | 4 | 1-3 (fireteam 3) | D1.3, D1.15 | no |  |
| 163 | act_cosmo_m4_dome_c | The Last Array * | story/mission | 4 | 1-3 (fireteam 3) | D1.4 | no |  |
| 164 | act_cosmo_m4_dome_c | The Last Array * | story/mission | 4 | 1-3 (fireteam 3) |  | no |  |
| 165 | act_cosmo_m4_dome_c | The Last Array * | story/mission | 4 | 1-3 (fireteam 3) |  | no |  |
| 166 | act_cosmo_m4_dome_c | The Last Array * | story variant (type 0) | 4 | 1-3 (fireteam 3) | D1.4, D1.16 | no |  |
| 229 | act_cosmo_m0_highway | ? | story/mission | 1 | 1-3 (fireteam 3) | D1.0, D2.0 | no | next 230 |
| 230 | cine_reveal | ? | cinematic; story/mission | 1 | 1-3 (fireteam 3) | D1.0 | no |  |
| 231 | action_mock | tower_venus1 * | test; story/mission | 1 | 1-3 (fireteam 3) |  | no | next 232 |
| 236 | (no name) | ? | strike playlist | 18 | 1-3 (fireteam 3) | D1.46 | no | playlist 258, 261, 262, 263, 259, 260; hopper 0x808FC3F9 |
| 237 | (no name) | Level 20 Playlist * | strike playlist | 20 | 1-3 (fireteam 3) | D1.30 | no | playlist 264, 267, 268, 269, 265, 266; hopper 0x808FC3F9 |
| 238 | (no name) | Level 22 Playlist * | strike playlist | 22 | 1-3 (fireteam 3) | D1.31 | no | playlist 270, 273, 274, 275, 271, 272; hopper 0x808FC3F9 |
| 239 | (no name) | Level 24 Playlist * | strike playlist | 24 | 1-3 (fireteam 3) | D1.32 | no | playlist 276, 279, 280, 281, 277, 278; hopper 0x808FC3F9 |
| 240 | cosmo_portal_1 | Den of Devils | strike (portal) | 8 | 1-3 (fireteam 3) | D1.24 | YES | hopper 0x808FC3FB |
| 241 | cosmo_portal_1 | Den of Devils | strike (portal) | 10 | 1-3 (fireteam 3) |  | YES | hopper 0x808FC3FB |
| 242 | cosmo_portal_1 | Den of Devils | strike (portal) | 12 | 1-3 (fireteam 3) |  | YES | hopper 0x808FC3FB |
| 258 | cosmo_portal_1 | Den of Devils | strike (portal) | 18 | 1-3 (fireteam 3) |  | YES | hopper 0x808FC3FB |
| 264 | cosmo_portal_1 | Den of Devils | strike (portal) | 20 | 1-3 (fireteam 3) |  | YES | hopper 0x808FC3FB |
| 270 | cosmo_portal_1 | Den of Devils | strike (portal) | 22 | 1-3 (fireteam 3) |  | YES | hopper 0x808FC3FB |
| 276 | cosmo_portal_1 | Den of Devils | strike (portal) | 24 | 1-3 (fireteam 3) |  | YES | hopper 0x808FC3FB |
| 282 | action_mock |  | test; none (255) | 1 | 1-9 (fireteam 6) |  | no |  |
| 299 | (no name) |  | story/mission | 0 | 1-9 (fireteam 6) |  | no |  |
| 300 | (no name) | DLC Teaser | story/mission | 1 | 1-9 (fireteam 3) | D0.10 | no |  |
| 301 | dlc_test_activity | DLC Test Activity | test; story/mission | 1 | 1-9 (fireteam 3) | D2.4 | YES | next 302 |
| 302 | (no name) | ? | story/mission | 1 | 1-9 (fireteam 3) |  | no |  |
| 303 | cosmo_portal_1 | Den of Devils | strike (portal) | 8 | 1-3 (fireteam 3) | D2.6 | YES | hopper 0x808FC402 |
| 304 | cosmo_patrols_1 | Explore Cosmodrome | patrol | 4 | 1-3 (fireteam 3) | D2.5 | YES |  |

### Destination index 3: unknown (index 3) (1 rows)

| Index | Name | Display name | Type | Level | Players (fireteam) | Director node | Loadable | Notes |
|---|---|---|---|---|---|---|---|---|
| 235 | (no name) | Book Three * | unknown (16) | 1 | 0-3 (fireteam 0) | D0.1 | no |  |

### Destination index 4: Crucible (147 rows)

| Index | Name | Display name | Type | Level | Players (fireteam) | Director node | Loadable | Notes |
|---|---|---|---|---|---|---|---|---|
| 14 | (no name) | Rumble * | crucible playlist | 9 | 1-6 (fireteam 3) | D1.36 | no | playlist of 25; hopper 0x808FC3EF |
| 15 | (no name) | Clash * | crucible playlist | 7 | 1-12 (fireteam 6) | D1.35 | no | playlist of 25; hopper 0x808FC403 |
| 16 | (no name) | Skirmish * | crucible playlist | 11 | 1-6 (fireteam 3) | D1.37 | no | playlist of 25; hopper 0x808FC3F0 |
| 17 | (no name) | Control * | crucible playlist | 5 | 1-12 (fireteam 6) | D1.34 | no | playlist of 25; hopper 0x808FC403 |
| 18 | (no name) | Salvage * | crucible playlist | 13 | 1-6 (fireteam 3) | D1.38 | no | playlist of 25; hopper 0x808FC3F0 |
| 19 | pvp_academy_vault | The Archive * | crucible mode A (3v3) | 5 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3EF |
| 20 | pvp_academy_vault | The Archive * | crucible mode B (6v6) | 5 | 1-12 (fireteam 6) |  | no | hopper 0x808FC403 |
| 21 | pvp_academy_vault | The Archive * | crucible mode E (3v3) | 10 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3F0 |
| 22 | pvp_academy_vault | The Archive * | crucible mode C (6v6) | 1 | 1-12 (fireteam 6) |  | no | hopper 0x808FC403 |
| 23 | pvp_academy_vault | The Archive * | crucible mode D (3v3) | 15 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3F0 |
| 24 | pvp_anomaly | The Anomaly * | crucible mode A (3v3) | 5 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3EF |
| 25 | pvp_anomaly | The Anomaly * | crucible mode B (6v6) | 5 | 1-12 (fireteam 6) |  | no | hopper 0x808FC3F2 |
| 26 | pvp_anomaly | The Anomaly * | crucible mode E (3v3) | 10 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3F0 |
| 27 | pvp_anomaly | The Anomaly * | crucible mode C (6v6) | 1 | 1-12 (fireteam 6) |  | no | hopper 0x808FC403 |
| 28 | pvp_anomaly | The Anomaly * | crucible mode D (3v3) | 15 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3F0 |
| 29 | pvp_arena_hive | Hive Arena * | crucible mode A (3v3) | 5 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3EF |
| 30 | pvp_arena_hive | Hive Arena * | crucible mode B (6v6) | 5 | 1-12 (fireteam 6) |  | no | hopper 0x808FC403 |
| 31 | pvp_arena_hive | Hive Arena * | crucible mode E (3v3) | 10 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3F0 |
| 32 | pvp_arena_hive | Hive Arena * | crucible mode C (6v6) | 1 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3F0 |
| 33 | pvp_arena_hive | Hive Arena * | crucible mode D (3v3) | 15 | 1-12 (fireteam 6) |  | no | hopper 0x808FC403 |
| 34 | pvp_cabal_camp | Firebase Delphi * | crucible mode A (3v3) | 5 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3EF |
| 35 | pvp_cabal_camp | Firebase Delphi * | crucible mode B (6v6) | 5 | 1-12 (fireteam 6) |  | no | hopper 0x808FC403 |
| 36 | pvp_cabal_camp | Firebase Delphi * | crucible mode E (3v3) | 10 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3F0 |
| 37 | pvp_cabal_camp | Firebase Delphi * | crucible mode C (6v6) | 1 | 1-12 (fireteam 6) |  | no | hopper 0x808FC403 |
| 38 | pvp_cabal_camp | Firebase Delphi * | crucible mode D (3v3) | 15 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3F0 |
| 39 | pvp_city_defense | Twilight Gap * | crucible mode A (3v3) | 5 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3EF |
| 40 | pvp_city_defense | Twilight Gap * | crucible mode B (6v6) | 5 | 1-12 (fireteam 6) |  | no | hopper 0x808FC403 |
| 41 | pvp_city_defense | Twilight Gap * | crucible mode E (3v3) | 10 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3F0 |
| 42 | pvp_city_defense | Twilight Gap * | crucible mode C (6v6) | 1 | 1-12 (fireteam 6) |  | no | hopper 0x808FC403 |
| 43 | pvp_city_defense | Twilight Gap * | crucible mode D (3v3) | 15 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3F0 |
| 44 | pvp_colony_ship | Exodus Blue * | crucible mode A (3v3) | 5 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3EF |
| 45 | pvp_colony_ship | Exodus Blue * | crucible mode B (6v6) | 5 | 1-12 (fireteam 6) |  | no | hopper 0x808FC403 |
| 46 | pvp_colony_ship | Exodus Blue * | crucible mode E (3v3) | 10 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3F0 |
| 47 | pvp_colony_ship | Exodus Blue * | crucible mode C (6v6) | 1 | 1-12 (fireteam 6) |  | no | hopper 0x808FC403 |
| 48 | pvp_colony_ship | Exodus Blue * | crucible mode D (3v3) | 15 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3F0 |
| 49 | pvp_cosmobattle | The Dam * | crucible mode A (3v3) | 5 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3EF |
| 50 | pvp_cosmobattle | The Dam * | crucible mode B (6v6) | 5 | 1-12 (fireteam 6) |  | no | hopper 0x808FC403 |
| 51 | pvp_cosmobattle | The Dam * | crucible mode E (3v3) | 10 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3F0 |
| 52 | pvp_cosmobattle | The Dam * | crucible mode C (6v6) | 1 | 1-12 (fireteam 6) |  | no | hopper 0x808FC403 |
| 53 | pvp_cosmobattle | The Dam * | crucible mode D (3v3) | 15 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3F0 |
| 54 | pvp_den | The Den * | crucible mode A (3v3) | 5 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3EF |
| 55 | pvp_den | The Den * | crucible mode B (6v6) | 5 | 1-12 (fireteam 6) |  | no | hopper 0x808FC403 |
| 56 | pvp_den | The Den * | crucible mode E (3v3) | 10 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3F0 |
| 57 | pvp_den | The Den * | crucible mode C (6v6) | 1 | 1-12 (fireteam 6) |  | no | hopper 0x808FC403 |
| 58 | pvp_den | The Den * | crucible mode D (3v3) | 15 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3F0 |
| 59 | pvp_factory | Rustlands * | crucible mode A (3v3) | 5 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3EF |
| 60 | pvp_factory | Rustlands * | crucible mode B (6v6) | 5 | 1-12 (fireteam 6) |  | no | hopper 0x808FC403 |
| 61 | pvp_factory | Rustlands * | crucible mode E (3v3) | 10 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3F0 |
| 62 | pvp_factory | Rustlands * | crucible mode C (6v6) | 1 | 1-12 (fireteam 6) |  | no | hopper 0x808FC403 |
| 63 | pvp_factory | Rustlands * | crucible mode D (3v3) | 15 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3F0 |
| 64 | pvp_gladiator | The Wolves' Den * | crucible mode A (3v3) | 5 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3EF |
| 65 | pvp_gladiator | The Wolves' Den * | crucible mode B (6v6) | 5 | 1-12 (fireteam 6) |  | no | hopper 0x808FC403 |
| 66 | pvp_gladiator | The Wolves' Den * | crucible mode E (3v3) | 10 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3F0 |
| 67 | pvp_gladiator | The Wolves' Den * | crucible mode C (6v6) | 1 | 1-12 (fireteam 6) |  | no | hopper 0x808FC403 |
| 68 | pvp_gladiator | The Wolves' Den * | crucible mode D (3v3) | 15 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3F0 |
| 69 | pvp_greenhouse | Shores of Time * | crucible mode A (3v3) | 5 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3EF |
| 70 | pvp_greenhouse | Shores of Time * | crucible mode B (6v6) | 5 | 1-12 (fireteam 6) |  | no | hopper 0x808FC403 |
| 71 | pvp_greenhouse | Shores of Time * | crucible mode E (3v3) | 10 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3F0 |
| 72 | pvp_greenhouse | Shores of Time * | crucible mode C (6v6) | 1 | 1-12 (fireteam 6) |  | no | hopper 0x808FC403 |
| 73 | pvp_greenhouse | Shores of Time * | crucible mode D (3v3) | 15 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3F0 |
| 74 | pvp_hellmouth | The Hellmouth * | crucible mode A (3v3) | 5 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3EF |
| 75 | pvp_hellmouth | The Hellmouth * | crucible mode B (6v6) | 5 | 1-12 (fireteam 6) |  | no | hopper 0x808FC403 |
| 76 | pvp_hellmouth | The Hellmouth * | crucible mode E (3v3) | 10 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3F0 |
| 77 | pvp_hellmouth | The Hellmouth * | crucible mode C (6v6) | 1 | 1-12 (fireteam 6) |  | no | hopper 0x808FC403 |
| 78 | pvp_hellmouth | The Hellmouth * | crucible mode D (3v3) | 15 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3F0 |
| 79 | pvp_hive | pvp_hive * | crucible mode A (3v3) | 5 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3EF |
| 80 | pvp_hive | pvp_hive * | crucible mode B (6v6) | 5 | 1-12 (fireteam 6) |  | no | hopper 0x808FC403 |
| 81 | pvp_hive | pvp_hive * | crucible mode E (3v3) | 10 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3F0 |
| 82 | pvp_hive | pvp_hive * | crucible mode C (6v6) | 1 | 1-12 (fireteam 6) |  | no | hopper 0x808FC403 |
| 83 | pvp_hive | pvp_hive * | crucible mode D (3v3) | 15 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3F0 |
| 84 | pvp_hive_moon | Grave of the Seven Worlds * | crucible mode A (3v3) | 5 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3EF |
| 85 | pvp_hive_moon | Grave of the Seven Worlds * | crucible mode B (6v6) | 5 | 1-12 (fireteam 6) |  | no | hopper 0x808FC403 |
| 86 | pvp_hive_moon | Grave of the Seven Worlds * | crucible mode E (3v3) | 10 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3F0 |
| 87 | pvp_hive_moon | Grave of the Seven Worlds * | crucible mode C (6v6) | 1 | 1-12 (fireteam 6) |  | no | hopper 0x808FC403 |
| 88 | pvp_hive_moon | Grave of the Seven Worlds * | crucible mode D (3v3) | 15 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3F0 |
| 89 | pvp_longshot | Long Shot * | crucible mode A (3v3) | 5 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3EF |
| 90 | pvp_longshot | Long Shot * | crucible mode B (6v6) | 5 | 1-12 (fireteam 6) |  | no | hopper 0x808FC403 |
| 91 | pvp_longshot | Long Shot * | crucible mode E (3v3) | 10 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3F0 |
| 92 | pvp_longshot | Long Shot * | crucible mode C (6v6) | 1 | 1-12 (fireteam 6) |  | no | hopper 0x808FC403 |
| 93 | pvp_longshot | Long Shot * | crucible mode D (3v3) | 15 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3F0 |
| 94 | pvp_marsbattle | Bastion * | crucible mode A (3v3) | 5 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3EF |
| 95 | pvp_marsbattle | Bastion * | crucible mode B (6v6) | 5 | 1-12 (fireteam 6) |  | no | hopper 0x808FC403 |
| 96 | pvp_marsbattle | Bastion * | crucible mode E (3v3) | 10 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3F0 |
| 97 | pvp_marsbattle | Bastion * | crucible mode C (6v6) | 1 | 1-12 (fireteam 6) |  | no | hopper 0x808FC403 |
| 98 | pvp_marsbattle | Bastion * | crucible mode D (3v3) | 15 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3F0 |
| 99 | pvp_mining | Wraith Mines * | crucible mode A (3v3) | 5 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3EF |
| 100 | pvp_mining | Wraith Mines * | crucible mode B (6v6) | 5 | 1-12 (fireteam 6) |  | no | hopper 0x808FC403 |
| 101 | pvp_moonbase | First Light * | crucible mode A (3v3) | 5 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3EF |
| 102 | pvp_moonbase | First Light * | crucible mode B (6v6) | 5 | 1-12 (fireteam 6) |  | no | hopper 0x808FC403 |
| 103 | pvp_moonbase | First Light * | crucible mode E (3v3) | 10 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3F0 |
| 104 | pvp_moonbase | First Light * | crucible mode C (6v6) | 1 | 1-12 (fireteam 6) |  | no | hopper 0x808FC403 |
| 105 | pvp_moonbase | First Light * | crucible mode D (3v3) | 15 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3F0 |
| 106 | pvp_oasis | City of the Dead * | crucible mode A (3v3) | 5 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3EF |
| 107 | pvp_oasis | City of the Dead * | crucible mode B (6v6) | 5 | 1-12 (fireteam 6) |  | no | hopper 0x808FC403 |
| 108 | pvp_oasis | City of the Dead * | crucible mode E (3v3) | 10 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3F0 |
| 109 | pvp_oasis | City of the Dead * | crucible mode C (6v6) | 1 | 1-12 (fireteam 6) |  | no | hopper 0x808FC403 |
| 110 | pvp_oasis | City of the Dead * | crucible mode D (3v3) | 15 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3F0 |
| 111 | pvp_refinery | The Refinery * | crucible mode A (3v3) | 5 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3EF |
| 112 | pvp_refinery | The Refinery * | crucible mode B (6v6) | 5 | 1-12 (fireteam 6) |  | no | hopper 0x808FC403 |
| 113 | pvp_refinery | The Refinery * | crucible mode E (3v3) | 10 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3F0 |
| 114 | pvp_refinery | The Refinery * | crucible mode C (6v6) | 1 | 1-12 (fireteam 6) |  | no | hopper 0x808FC403 |
| 115 | pvp_refinery | The Refinery * | crucible mode D (3v3) | 15 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3F0 |
| 116 | pvp_rooftops | Blind Watch * | crucible mode A (3v3) | 5 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3EF |
| 117 | pvp_rooftops | Blind Watch * | crucible mode B (6v6) | 5 | 1-12 (fireteam 6) |  | no | hopper 0x808FC403 |
| 118 | pvp_rooftops | Blind Watch * | crucible mode E (3v3) | 10 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3F0 |
| 119 | pvp_rooftops | Blind Watch * | crucible mode C (6v6) | 1 | 1-12 (fireteam 6) |  | no | hopper 0x808FC403 |
| 120 | pvp_rooftops | Blind Watch * | crucible mode D (3v3) | 15 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3F0 |
| 121 | pvp_shroud | Shroud * | crucible mode A (3v3) | 5 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3EF |
| 122 | pvp_shroud | Shroud * | crucible mode B (6v6) | 5 | 1-12 (fireteam 6) |  | no | hopper 0x808FC403 |
| 123 | pvp_shroud | Shroud * | crucible mode E (3v3) | 10 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3F0 |
| 124 | pvp_shroud | Shroud * | crucible mode C (6v6) | 1 | 1-12 (fireteam 6) |  | no | hopper 0x808FC403 |
| 125 | pvp_shroud | Shroud * | crucible mode D (3v3) | 15 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3F0 |
| 126 | pvp_venus_hcc | Asylum * | crucible mode A (3v3) | 5 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3EF |
| 127 | pvp_venus_hcc | Asylum * | crucible mode B (6v6) | 5 | 1-12 (fireteam 6) |  | no | hopper 0x808FC403 |
| 128 | pvp_venus_hcc | Asylum * | crucible mode E (3v3) | 10 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3F0 |
| 129 | pvp_venus_hcc | Asylum * | crucible mode C (6v6) | 1 | 1-12 (fireteam 6) |  | no | hopper 0x808FC403 |
| 130 | pvp_venus_hcc | Asylum * | crucible mode D (3v3) | 15 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3F0 |
| 131 | pvp_venus_shores | Drowned Kingdom * | crucible mode A (3v3) | 5 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3EF |
| 132 | pvp_venus_shores | Drowned Kingdom * | crucible mode B (6v6) | 5 | 1-12 (fireteam 6) |  | no | hopper 0x808FC403 |
| 133 | pvp_venus_shores | Drowned Kingdom * | crucible mode E (3v3) | 10 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3F0 |
| 134 | pvp_venus_shores | Drowned Kingdom * | crucible mode C (6v6) | 1 | 1-12 (fireteam 6) |  | no | hopper 0x808FC403 |
| 135 | pvp_venus_shores | Drowned Kingdom * | crucible mode D (3v3) | 15 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3F0 |
| 136 | pvp_vex_tube | The Lighthouse * | crucible mode A (3v3) | 5 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3EF |
| 137 | pvp_vex_tube | The Lighthouse * | crucible mode B (6v6) | 5 | 1-12 (fireteam 6) |  | no | hopper 0x808FC403 |
| 138 | pvp_vex_tube | The Lighthouse * | crucible mode E (3v3) | 10 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3F0 |
| 139 | pvp_vex_tube | The Lighthouse * | crucible mode C (6v6) | 1 | 1-12 (fireteam 6) |  | no | hopper 0x808FC403 |
| 140 | pvp_vex_tube | The Lighthouse * | crucible mode D (3v3) | 15 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3F0 |
| 141 | pvp_wall | The Scar * | crucible mode A (3v3) | 5 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3EF |
| 142 | pvp_wall | The Scar * | crucible mode B (6v6) | 5 | 1-12 (fireteam 6) |  | no | hopper 0x808FC403 |
| 143 | pvp_wall | The Scar * | crucible mode E (3v3) | 10 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3F0 |
| 144 | pvp_wall | The Scar * | crucible mode C (6v6) | 1 | 1-12 (fireteam 6) |  | no | hopper 0x808FC403 |
| 145 | pvp_wall | The Scar * | crucible mode D (3v3) | 15 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3F0 |
| 146 | pvp_wilderness_town | Freeholder's Stand * | crucible mode A (3v3) | 5 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3EF |
| 147 | pvp_wilderness_town | Freeholder's Stand * | crucible mode B (6v6) | 5 | 1-12 (fireteam 6) |  | no | hopper 0x808FC403 |
| 148 | pvp_wilderness_town | Freeholder's Stand * | crucible mode E (3v3) | 10 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3F0 |
| 149 | pvp_wilderness_town | Freeholder's Stand * | crucible mode C (6v6) | 1 | 1-12 (fireteam 6) |  | no | hopper 0x808FC403 |
| 150 | pvp_wilderness_town | Freeholder's Stand * | crucible mode D (3v3) | 15 | 1-6 (fireteam 3) |  | no | hopper 0x808FC3F0 |
| 284 | pvp_factory | MM TEST FACTORY * | crucible mode A (3v3) | 0 | 1-12 (fireteam 6) |  | no | hopper 0x808FC3EF |
| 286 | pvp_factory | Dominion | crucible mode C (6v6) | 0 | 1-12 (fireteam 6) |  | no | hopper 0x808FC403 |
| 287 | pvp_gladiator | ? | crucible mode C (6v6) | 0 | 1-12 (fireteam 6) |  | no | hopper 0x808FC403 |
| 295 | pvp_factory | Dominion | crucible mode C (6v6) | 0 | 1-12 (fireteam 6) |  | no | hopper 0x808FC403 |
| 296 | pvp_factory | FFA | crucible mode A (3v3) | 0 | 1-6 (fireteam 3) |  | no | hopper 0x808FC401 |
| 297 | (no name) | Dominion Playlist | crucible playlist | 0 | 1-12 (fireteam 6) | D0.9 | no | playlist 295; hopper 0x808FC403 |
| 298 | (no name) | FFA Playlist | crucible playlist | 0 | 1-6 (fireteam 3) | D0.6 | no | playlist 296; hopper 0x808FC401 |
| 306 | pvp_factory | Rustlands * | crucible mode C (6v6) | 0 | 1-12 (fireteam 6) |  | no | hopper 0x808FC403 |
| 307 | pvp_marsbattle | Bastion * | crucible mode C (6v6) | 0 | 1-12 (fireteam 6) |  | no | hopper 0x808FC403 |
| 308 | (no name) | Control * | crucible playlist | 0 | 1-12 (fireteam 6) |  | no | playlist 306, 307; hopper 0x808FC403 |

### Destination index 5: City tower (6 rows)

| Index | Name | Display name | Type | Level | Players (fireteam) | Director node | Loadable | Notes |
|---|---|---|---|---|---|---|---|---|
| 0 | city_tower_default1 | Tower | social/tower | 0 | 1-16 (fireteam 6) | D1.40 | YES | hopper 0x808FC3EA |
| 233 | pvp_intro | The Crucible (PVP) * | pvp intro | 5 | 1-1 (fireteam 1) | D1.33 | no |  |
| 234 | pvp_intro | An Invitation * | pvp intro | 5 | 1-1 (fireteam 1) | D1.33 | no |  |
| 285 | city_tower_default1 | ? | social/tower | 0 | 1-16 (fireteam 6) |  | YES | hopper 0x808FC3FE |
| 294 | city_tower_default1 | test_mm_city_tower | social/tower | 1 | 1-16 (fireteam 6) | D0.8 | YES | hopper 0x808FC3FE |
| 305 | city_tower_default1 | Tower | social/tower | 1 | 1-16 (fireteam 6) | D2.7 | YES | hopper 0x808FC3FE |

### Destination index 6: Venus (47 rows)

| Index | Name | Display name | Type | Level | Players (fireteam) | Director node | Loadable | Notes |
|---|---|---|---|---|---|---|---|---|
| 4 | venus_portal_1 |  | strike (portal) | 22 | 3-3 (fireteam 3) | D1.44 | no |  |
| 5 | venus_portal_1 |  | strike (portal) | 26 | 3-3 (fireteam 3) | D1.44 | no |  |
| 6 | venus_portal_1 |  | strike (portal) | 28 | 3-3 (fireteam 3) | D1.44 | no |  |
| 12 | venus_patrols_1 | Explore Venus * | patrol | 11 | 1-3 (fireteam 3) | D1.22 | no |  |
| 187 | act_venus_m01_engineering | Ishtar Collective * | story/mission | 10 | 1-3 (fireteam 3) | D1.10 | no |  |
| 188 | act_venus_m01_engineering | Ishtar Collective * | story/mission | 10 | 1-3 (fireteam 3) |  | no |  |
| 189 | act_venus_m01_engineering | Ishtar Collective * | story/mission | 10 | 1-3 (fireteam 3) |  | no |  |
| 190 | act_venus_m01_engineering | Ishtar Collective * | story variant (type 0) | 10 | 1-3 (fireteam 3) | D1.10 | no |  |
| 191 | act_venus_m02_southern_tides | The Waking Ruins * | story/mission | 10 | 1-3 (fireteam 3) | D1.11 | no |  |
| 192 | act_venus_m02_southern_tides | The Waking Ruins * | story/mission | 10 | 1-3 (fireteam 3) |  | no |  |
| 193 | act_venus_m02_southern_tides | The Waking Ruins * | story/mission | 10 | 1-3 (fireteam 3) |  | no |  |
| 194 | act_venus_m02_southern_tides | The Waking Ruins * | story variant (type 0) | 10 | 1-3 (fireteam 3) | D1.11 | no |  |
| 195 | act_venus_m05_vault | The Archive * | story/mission | 11 | 1-3 (fireteam 3) | D1.12 | no |  |
| 196 | act_venus_m05_vault | The Archive * | story/mission | 11 | 1-3 (fireteam 3) |  | no |  |
| 197 | act_venus_m05_vault | The Archive * | story/mission | 11 | 1-3 (fireteam 3) |  | no |  |
| 198 | act_venus_m05_vault | The Archive * | story variant (type 0) | 11 | 1-3 (fireteam 3) | D1.12 | no |  |
| 199 | act_venus_m06_ketch | Scourge of Winter * | story/mission | 11 | 1-3 (fireteam 3) | D1.13 | no |  |
| 200 | act_venus_m06_ketch | Scourge of Winter * | story/mission | 11 | 1-3 (fireteam 3) |  | no |  |
| 201 | act_venus_m06_ketch | Scourge of Winter * | story/mission | 11 | 1-3 (fireteam 3) |  | no |  |
| 202 | act_venus_m06_ketch | Scourge of Winter * | story variant (type 0) | 11 | 1-3 (fireteam 3) | D1.13 | no |  |
| 203 | act_venus_m07_northern_tides | Eye of a Gate Lord * | story/mission | 11 | 1-3 (fireteam 3) | D1.14 | no | next 207 |
| 204 | act_venus_m07_northern_tides | Eye of a Gate Lord * | story/mission | 11 | 1-3 (fireteam 3) |  | no | next 207 |
| 205 | act_venus_m07_northern_tides | Eye of a Gate Lord * | story/mission | 11 | 1-3 (fireteam 3) |  | no | next 207 |
| 206 | act_venus_m07_northern_tides | Eye of a Gate Lord * | story variant (type 0) | 11 | 1-3 (fireteam 3) | D1.14 | no |  |
| 207 | act_cinematic_queen_102 | venus7_outro * | cinematic; story/mission | 11 | 1-3 (fireteam 3) | D1.14 | no |  |
| 232 | act_cinematic_queen_101 | tower_venus1_outro * | cinematic; story/mission | 1 | 1-3 (fireteam 3) |  | no |  |
| 246 | venus_portal_1 | The Nexus * | strike (portal) | 12 | 1-3 (fireteam 3) | D1.26 | no | hopper 0x808FC3FB |
| 247 | venus_portal_1 | ? | strike (portal) | 14 | 1-3 (fireteam 3) |  | no | hopper 0x808FC3FB |
| 248 | venus_portal_1 | ? | strike (portal) | 16 | 1-3 (fireteam 3) |  | no | hopper 0x808FC3FB |
| 249 | venus_portal_2 | Venus 2 Test Strike * | strike (portal) | 12 | 1-3 (fireteam 3) | D1.27 | no | hopper 0x808FC3FB |
| 250 | venus_portal_2 | Venus 2 Test Strike * | strike (portal) | 14 | 1-3 (fireteam 3) |  | no | hopper 0x808FC3FB |
| 251 | venus_portal_2 | Venus 2 Test Strike * | strike (portal) | 16 | 1-3 (fireteam 3) |  | no | hopper 0x808FC3FB |
| 262 | venus_portal_1 | The Nexus * | strike (portal) | 18 | 1-3 (fireteam 3) |  | no | hopper 0x808FC3FB |
| 263 | venus_portal_2 | Venus 2 Test Strike * | strike (portal) | 18 | 1-3 (fireteam 3) |  | no | hopper 0x808FC3FB |
| 268 | venus_portal_1 | The Nexus * | strike (portal) | 20 | 1-3 (fireteam 3) |  | no | hopper 0x808FC3FB |
| 269 | venus_portal_2 | Venus 2 Test Strike * | strike (portal) | 20 | 1-3 (fireteam 3) |  | no | hopper 0x808FC3FB |
| 274 | venus_portal_1 | The Nexus * | strike (portal) | 22 | 1-3 (fireteam 3) |  | no | hopper 0x808FC3FB |
| 275 | venus_portal_2 | Venus 2 Test Strike * | strike (portal) | 22 | 1-3 (fireteam 3) |  | no | hopper 0x808FC3FB |
| 280 | venus_portal_1 | The Nexus * | strike (portal) | 24 | 1-3 (fireteam 3) |  | no | hopper 0x808FC3FB |
| 281 | venus_portal_2 | Venus 2 Test Strike * | strike (portal) | 24 | 1-3 (fireteam 3) |  | no | hopper 0x808FC3FB |
| 283 | takehome_map | ? | test; story/mission | 1 | 1-3 (fireteam 3) |  | no |  |
| 288 | dlc_test_activity | DLC Test Activity | test; story/mission | 1 | 1-9 (fireteam 9) | D0.2 | YES |  |
| 289 | perf_warp_ruins | Perf Warp Ruins * | test; story/mission | 1 | 1-9 (fireteam 9) | D0.0 | no |  |
| 290 | transition_test_activity | test_mm_story0 | test; story/mission | 1 | 1-3 (fireteam 3) | D0.3 | no |  |
| 291 | transition_test_activity | test_mm_strike0 | test; strike (portal) | 1 | 1-3 (fireteam 3) | D0.4 | no | hopper 0x808FC3FF |
| 292 | transition_test_activity | test_mm_patrol0 | test; patrol | 1 | 1-3 (fireteam 3) | D0.5 | no |  |
| 293 | transition_test_activity | test_mm_raid0 | test; raid | 1 | 1-6 (fireteam 6) | D0.7 | no |  |

### Destination index 255: none (255) (70 rows)

| Index | Name | Display name | Type | Level | Players (fireteam) | Director node | Loadable | Notes |
|---|---|---|---|---|---|---|---|---|
| 1 | cinematic_osiris_default1 | Osiris * | cinematic; social/tower | 0 | 1-9 (fireteam 6) |  | no |  |
| 2 | cinematic_queen_default1 | Queen * | cinematic; social/tower | 0 | 1-9 (fireteam 6) |  | no |  |
| 3 | (no name) | Rasputin * | social/tower | 0 | 1-9 (fireteam 6) |  | no |  |
| 7 | moon_portal_1 |  | strike (portal) | 22 | 3-3 (fireteam 3) | D1.45 | no |  |
| 8 | moon_portal_1 |  | strike (portal) | 26 | 3-3 (fireteam 3) | D1.45 | no |  |
| 9 | moon_portal_1 |  | strike (portal) | 28 | 3-3 (fireteam 3) | D1.45 | no |  |
| 11 | moon_patrols_1 | Explore the Moon * | patrol | 8 | 1-3 (fireteam 3) | D1.21 | no |  |
| 13 | mars_patrols_1 | Explore Mars * | patrol | 15 | 1-3 (fireteam 3) | D1.23 | no |  |
| 167 | act_moon_m1_launchtubes | Guardians Lost * | story/mission | 7 | 1-3 (fireteam 3) | D1.5 | no |  |
| 168 | act_moon_m1_launchtubes | Guardians Lost * | story/mission | 7 | 1-3 (fireteam 3) |  | no |  |
| 169 | act_moon_m1_launchtubes | Guardians Lost * | story/mission | 7 | 1-3 (fireteam 3) |  | no |  |
| 170 | act_moon_m1_launchtubes | Guardians Lost * | story variant (type 0) | 7 | 1-3 (fireteam 3) | D1.5, D1.17 | no |  |
| 171 | act_moon_m3_lowercitadel | Ring of Living Stone * | story/mission | 7 | 1-3 (fireteam 3) | D1.6 | no |  |
| 172 | act_moon_m3_lowercitadel | Ring of Living Stone * | story/mission | 7 | 1-3 (fireteam 3) |  | no |  |
| 173 | act_moon_m3_lowercitadel | Ring of Living Stone * | story/mission | 7 | 1-3 (fireteam 3) |  | no |  |
| 174 | act_moon_m3_lowercitadel | Ring of Living Stone * | story variant (type 0) | 7 | 1-3 (fireteam 3) | D1.6, D1.18 | no |  |
| 175 | act_moon_m4_uppercitadel | The Swarm Princes * | story/mission | 8 | 1-3 (fireteam 3) | D1.7 | no |  |
| 176 | act_moon_m4_uppercitadel | The Swarm Princes * | story/mission | 8 | 1-3 (fireteam 3) |  | no |  |
| 177 | act_moon_m4_uppercitadel | The Swarm Princes * | story/mission | 8 | 1-3 (fireteam 3) |  | no |  |
| 178 | act_moon_m4_uppercitadel | The Swarm Princes * | story variant (type 0) | 8 | 1-3 (fireteam 3) | D1.7 | no |  |
| 179 | act_moon_m5_strength | Chamber of Night * | story/mission | 8 | 1-3 (fireteam 3) | D1.8 | no |  |
| 180 | act_moon_m5_strength | Chamber of Night * | story/mission | 8 | 1-3 (fireteam 3) |  | no |  |
| 181 | act_moon_m5_strength | Chamber of Night * | story/mission | 8 | 1-3 (fireteam 3) |  | no |  |
| 182 | act_moon_m5_strength | Chamber of Night * | story variant (type 0) | 8 | 1-3 (fireteam 3) | D1.8 | no |  |
| 183 | act_moon_m6_reactor | Shrine of Oryx * | story/mission | 8 | 1-3 (fireteam 3) | D1.9 | no |  |
| 184 | act_moon_m6_reactor | Shrine of Oryx * | story/mission | 8 | 1-3 (fireteam 3) |  | no |  |
| 185 | act_moon_m6_reactor | Shrine of Oryx * | story/mission | 8 | 1-3 (fireteam 3) |  | no |  |
| 186 | act_moon_m6_reactor | Shrine of Oryx * | story variant (type 0) | 8 | 1-3 (fireteam 3) | D1.9 | no |  |
| 208 | act_mars_m01_valley | Exclusion Zone * | story/mission | 13 | 1-3 (fireteam 3) | D1.15 | no |  |
| 209 | act_mars_m01_valley | Exclusion Zone * | story/mission | 13 | 1-3 (fireteam 3) |  | no |  |
| 210 | act_mars_m01_valley | Exclusion Zone * | story/mission | 13 | 1-3 (fireteam 3) |  | no |  |
| 211 | act_mars_m01_valley | Exclusion Zone * | story variant (type 0) | 13 | 1-3 (fireteam 3) |  | no |  |
| 212 | act_mars_m03_penthouse | Buried City of Freehold * | story/mission | 14 | 1-3 (fireteam 3) | D1.16 | no |  |
| 213 | act_mars_m03_penthouse | Buried City of Freehold * | story/mission | 14 | 1-3 (fireteam 3) |  | no |  |
| 214 | act_mars_m03_penthouse | Buried City of Freehold * | story/mission | 14 | 1-3 (fireteam 3) |  | no |  |
| 215 | act_mars_m03_penthouse | Buried City of Freehold * | story variant (type 0) | 14 | 1-3 (fireteam 3) |  | no |  |
| 216 | act_mars_m05_warbase | Primus Shauull * | story/mission | 15 | 1-3 (fireteam 3) | D1.17 | no |  |
| 217 | act_mars_m05_warbase | Primus Shauull * | story/mission | 15 | 1-3 (fireteam 3) |  | no |  |
| 218 | act_mars_m05_warbase | Primus Shauull * | story/mission | 15 | 1-3 (fireteam 3) |  | no |  |
| 219 | act_mars_m05_warbase | Primus Shauull * | story variant (type 0) | 15 | 1-3 (fireteam 3) |  | no |  |
| 220 | act_mars_m06_subway | Sol Divisive * | story/mission | 14 | 1-3 (fireteam 3) | D1.18 | no |  |
| 221 | act_mars_m06_subway | Sol Divisive * | story/mission | 14 | 1-3 (fireteam 3) |  | no |  |
| 222 | act_mars_m06_subway | Sol Divisive * | story/mission | 14 | 1-3 (fireteam 3) |  | no |  |
| 223 | act_mars_m06_subway | Sol Divisive * | story variant (type 0) | 14 | 1-3 (fireteam 3) |  | no |  |
| 224 | act_mars_m07_lowergarden | The Black Garden * | story/mission | 15 | 1-3 (fireteam 3) | D1.19 | no | next 228 |
| 225 | act_mars_m07_lowergarden | The Black Garden * | story/mission | 15 | 1-3 (fireteam 3) |  | no | next 228 |
| 226 | act_mars_m07_lowergarden | The Black Garden * | story/mission | 15 | 1-3 (fireteam 3) |  | no | next 228 |
| 227 | act_mars_m07_lowergarden | The Black Garden * | story variant (type 0) | 15 | 1-3 (fireteam 3) | D1.19 | no |  |
| 228 | cine_end | mars7_outro * | cinematic; story/mission | 15 | 1-3 (fireteam 3) | D1.19 | no |  |
| 243 | moon_portal_2 | The Summoning Pits * | strike (portal) | 10 | 1-3 (fireteam 3) | D1.25 | no | hopper 0x808FC3FB |
| 244 | moon_portal_2 | ? | strike (portal) | 12 | 1-3 (fireteam 3) |  | no | hopper 0x808FC3FB |
| 245 | moon_portal_2 | ? | strike (portal) | 14 | 1-3 (fireteam 3) |  | no | hopper 0x808FC3FB |
| 252 | mars_portal_1 | Dust Palace * | strike (portal) | 14 | 1-3 (fireteam 3) | D1.28 | no | hopper 0x808FC3FB |
| 253 | mars_portal_1 | ? | strike (portal) | 16 | 1-3 (fireteam 3) |  | no | hopper 0x808FC3FB |
| 254 | mars_portal_1 | ? | strike (portal) | 18 | 1-3 (fireteam 3) |  | no | hopper 0x808FC3FB |
| 255 | mars_portal_2 | Mars 2 TEMP STRING * | strike (portal) | 16 | 1-3 (fireteam 3) | D1.29 | no | hopper 0x808FC3FB |
| 256 | mars_portal_2 | ? | strike (portal) | 18 | 1-3 (fireteam 3) |  | no | hopper 0x808FC3FB |
| 257 | mars_portal_2 | ? | strike (portal) | 20 | 1-3 (fireteam 3) |  | no | hopper 0x808FC3FB |
| 259 | mars_portal_1 | Dust Palace * | strike (portal) | 18 | 1-3 (fireteam 3) |  | no | hopper 0x808FC3FB |
| 260 | mars_portal_2 | Mars 2 TEMP STRING * | strike (portal) | 18 | 1-3 (fireteam 3) |  | no | hopper 0x808FC3FB |
| 261 | moon_portal_2 | The Summoning Pits * | strike (portal) | 18 | 1-3 (fireteam 3) |  | no | hopper 0x808FC3FB |
| 265 | mars_portal_1 | Dust Palace * | strike (portal) | 20 | 1-3 (fireteam 3) |  | no | hopper 0x808FC3FB |
| 266 | mars_portal_2 | Mars 2 TEMP STRING * | strike (portal) | 20 | 1-3 (fireteam 3) |  | no | hopper 0x808FC3FB |
| 267 | moon_portal_2 | The Summoning Pits * | strike (portal) | 20 | 1-3 (fireteam 3) |  | no | hopper 0x808FC3FB |
| 271 | mars_portal_1 | Dust Palace * | strike (portal) | 22 | 1-3 (fireteam 3) |  | no | hopper 0x808FC3FB |
| 272 | mars_portal_2 | Mars 2 TEMP STRING * | strike (portal) | 22 | 1-3 (fireteam 3) |  | no | hopper 0x808FC3FB |
| 273 | moon_portal_2 | The Summoning Pits * | strike (portal) | 22 | 1-3 (fireteam 3) |  | no | hopper 0x808FC3FB |
| 277 | mars_portal_1 | Dust Palace * | strike (portal) | 24 | 1-3 (fireteam 3) |  | no | hopper 0x808FC3FB |
| 278 | mars_portal_2 | Mars 2 TEMP STRING * | strike (portal) | 24 | 1-3 (fireteam 3) |  | no | hopper 0x808FC3FB |
| 279 | moon_portal_2 | The Summoning Pits * | strike (portal) | 24 | 1-3 (fireteam 3) |  | no | hopper 0x808FC3FB |

Destination indices 0 and 2 have no activity rows.
