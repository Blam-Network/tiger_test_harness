# Activities in PS4 pre-alpha 38464.14.02.28.1027.betath

Read from the build's own packages (`D:/Games/ps4/betath-38464/packages`) with tiger's gibbon reader (`v38464_14_02_28_1027_betath`). Activity table is the investment globals' activities slot (class 0x808018E8), definitions class 0x808017F9.

## Summary

- 244 activity rows. 228 have a name string; 16 have none (empty name, e.g. the Crucible playlists and a few unnamed rows).
- 77 distinct names. Several rows share one name: a name is the bundle/scenario, rows are variants (level, mode, hopper).
- 11 scenario_client tags (class 0x80800719) exist in the packages: orbit, ambient_bootstrap, cosmo_portal_1, cosmo_patrols_1, ambient_cosmo, city_tower_default1, ambient_city_tower, pvp_factory, ambient_pvp_factory, pvp_marsbattle, ambient_pvp_marsbattle. Five of them are activity-table names, covering 27 rows. The other six (orbit, ambient_*) are not named by any activity row.
- Every other row (story missions, other portals, other patrols, other Crucible maps, raid, tests) has a definition but no scenario_client or bundles in these packages, so it cannot load.
- Level: `activity_level` from the definition. For story/portal/patrol rows it is the required level. For Crucible rows it is 0/1/5/10/15, which looks like a per-mode value, not a character level (unconfirmed).
- Type: `activity_type` byte. Names for the numbers are my reading of the rows using them, not from the data; the names of the Crucible mode numbers 5-9 are unknown. 5/8/9 are 3v3 (max 6), 6/7 are 6v6 (max 12).
- Destination: `destination_index` into the client destination table (18 rows, name hashes only, not cracked). Labels below come from the activity names using each index.

## Loadable activities

| Scenario | Rows | Destination (scenario) | What it is |
|---|---|---|---|
| city_tower_default1 | 0, 220, 229, 240 | city_tower | Tower (social space). Rows 0, 220, 229, 240. |
| cosmo_patrols_1 | 4, 239 | cosmo | Cosmodrome patrol (level 4). Rows 4, 239. |
| pvp_factory | 53, 54, 55, 56, 57, 219, 221, 230, 231, 241 | pvp_factory | Crucible map Factory; one row per mode (53-57), plus 219, 221, 230, 231, 241 (extra rows, level 0). |
| pvp_marsbattle | 88, 89, 90, 91, 92, 242 | pvp_marsbattle | Crucible map Mars Battle; one row per mode (88-92), plus 242. |
| cosmo_portal_1 | 183, 184, 185, 186, 238 | cosmo | Cosmodrome portal; row 183 level 6, plus 184-186 at 20/22/24 (higher-level variants); 238 duplicate. |

Scenario-only (no activity row; the client starts them itself): orbit, ambient_bootstrap, ambient_cosmo, ambient_city_tower, ambient_pvp_factory, ambient_pvp_marsbattle. Unnamed rows 3 (type 3, destination index 6) and 179 (type 15, destination index 3) are candidates for orbit but this is not confirmed.

## Crucible playlists and modes

- Playlist rows 8-12 (type 10, destination Crucible, no name): each lists 25 map rows. Row 8 -> mode-A rows (type 5), 9 -> type 6, 10 -> type 9, 11 -> type 7, 12 -> type 8. Playlist levels are 9, 7, 11, 5, 13. Hoppers: 3v3 playlists (8, 10, 12) use hopper tags 0x808F63CC (8) and 0x808F63CD (10, 12), 6v6 (9, 11) use 0x808F63D9; portal rows use 0x808F63D4.
- Rows 232, 233, 243 are further unnamed playlists (1-2 entries each, level 0): 232 -> row 230 (pvp_factory type 7), 233 -> row 231 (pvp_factory type 5), 243 -> rows 241, 242 (pvp_factory, pvp_marsbattle type 7).
- Portal playlists: rows 180-182 (type 2, Cosmodrome, level 20/22/24) each list the six portal rows of that level (cosmo, moon_2, venus_1, venus_2, mars_1, mars_2).
- Maps with five mode rows each (types 5, 6, 9, 7, 8): pvp_academy_vault, pvp_anomaly, pvp_arena_hive, pvp_cabal_camp, pvp_city_defense, pvp_colony_ship, pvp_cosmobattle, pvp_den, pvp_factory, pvp_gladiator, pvp_greenhouse, pvp_hellmouth, pvp_hive, pvp_hive_moon, pvp_longshot, pvp_marsbattle, pvp_moonbase, pvp_oasis, pvp_refinery, pvp_rooftops, pvp_shroud, pvp_venus_hcc, pvp_venus_shores, pvp_vex_tube, pvp_wall, pvp_wilderness_town. pvp_mining has only types 5 and 6. pvp_intro (rows 177, 178) is type 4.
- Chained rows (next_activity): 162 -> 163, 170 -> 171, 172 -> 173, 175 -> 176, 236 -> 237.

## Comparison with the May 2014 Alpha Trial

Alpha Trial loadable set: city_tower_default1, cosmo_portal_1, cosmo_patrols_1, act_cosmo_m1_dome_a, pvp_factory, pvp_moonbase.

- Still loadable here: city_tower_default1, cosmo_portal_1, cosmo_patrols_1, pvp_factory.
- New: pvp_marsbattle (Crucible, Mars Battle), plus the orbit and ambient_bootstrap scenarios and ambient_* scenarios as separate tags.
- Missing here: act_cosmo_m1_dome_a (row 148 exists, no scenario_client) and pvp_moonbase (rows 95-99 exist, no scenario_client).

## All activities by destination

### Destination index 1: Cosmodrome (name hash 0x648999f4, 23 rows)

| Index | Name | Type | Level | Players (fireteam) | Loadable |
|---|---|---|---|---|---|
| 4 | cosmo_patrols_1 | patrol | 4 | 1-3 (fireteam 3) | YES |
| 148 | act_cosmo_m1_dome_a | story/mission | 2 | 1-3 (fireteam 3) | no |
| 149 | act_cosmo_m2_dome_c | story/mission | 3 | 1-3 (fireteam 3) | no |
| 150 | act_cosmo_m3_refinery | story/mission | 4 | 1-3 (fireteam 3) | no |
| 151 | act_cosmo_m4_dome_c | story/mission | 8 | 1-3 (fireteam 3) | no |
| 172 | act_cosmo_m0_highway | story/mission | 1 | 1-3 (fireteam 3) | no |
| 173 | act_city_tower_cine_101 | cinematic; story/mission | 1 | 1-3 (fireteam 3) | no |
| 174 | action_mock | test; story/mission | 4 | 1-3 (fireteam 3) | no |
| 175 | action_mock | test; story/mission | 14 | 1-3 (fireteam 3) | no |
| 180 | (no name) | portal (strike/playlist-style) | 20 | 1-3 (fireteam 3) | no |
| 181 | (no name) | portal (strike/playlist-style) | 22 | 1-3 (fireteam 3) | no |
| 182 | (no name) | portal (strike/playlist-style) | 24 | 1-3 (fireteam 3) | no |
| 183 | cosmo_portal_1 | portal (strike/playlist-style) | 6 | 1-3 (fireteam 3) | YES |
| 184 | cosmo_portal_1 | portal (strike/playlist-style) | 20 | 1-3 (fireteam 3) | YES |
| 185 | cosmo_portal_1 | portal (strike/playlist-style) | 22 | 1-3 (fireteam 3) | YES |
| 186 | cosmo_portal_1 | portal (strike/playlist-style) | 24 | 1-3 (fireteam 3) | YES |
| 217 | action_mock | test; none (255) | 1 | 1-9 (fireteam 6) | no |
| 234 | (no name) | story/mission | 1 | 1-9 (fireteam 3) | no |
| 235 | (no name) | story/mission | 1 | 1-9 (fireteam 3) | no |
| 236 | dlc_test_activity | test; story/mission | 1 | 1-9 (fireteam 3) | no |
| 237 | (no name) | story/mission | 1 | 1-9 (fireteam 3) | no |
| 238 | cosmo_portal_1 | portal (strike/playlist-style) | 6 | 1-3 (fireteam 3) | YES |
| 239 | cosmo_patrols_1 | patrol | 4 | 1-3 (fireteam 3) | YES |

### Destination index 3: unknown (index 3) (name hash 0x5ec025c8, 1 rows)

| Index | Name | Type | Level | Players (fireteam) | Loadable |
|---|---|---|---|---|---|
| 179 | (no name) | unknown (15) | 1 | 0-3 (fireteam 0) | no |

### Destination index 4: Osiris cinematic (name hash 0xa98627d2, 1 rows)

| Index | Name | Type | Level | Players (fireteam) | Loadable |
|---|---|---|---|---|---|
| 1 | cinematic_osiris_default1 | cinematic; social/tower | 0 | 1-9 (fireteam 6) | no |

### Destination index 5: Queen cinematic (name hash 0xdc483e01, 1 rows)

| Index | Name | Type | Level | Players (fireteam) | Loadable |
|---|---|---|---|---|---|
| 2 | cinematic_queen_default1 | cinematic; social/tower | 0 | 1-9 (fireteam 6) | no |

### Destination index 6: unknown (index 6) (name hash 0xd772a967, 1 rows)

| Index | Name | Type | Level | Players (fireteam) | Loadable |
|---|---|---|---|---|---|
| 3 | (no name) | social/tower | 0 | 1-9 (fireteam 6) | no |

### Destination index 8: Mars (name hash 0x7ecccdc9, 18 rows)

| Index | Name | Type | Level | Players (fireteam) | Loadable |
|---|---|---|---|---|---|
| 7 | mars_patrols_1 | patrol | 17 | 1-3 (fireteam 3) | no |
| 164 | act_mars_m01_valley | story/mission | 15 | 1-3 (fireteam 3) | no |
| 165 | act_mars_m02_rubicon | story/mission | 18 | 1-3 (fireteam 3) | no |
| 166 | act_mars_m03_penthouse | story/mission | 16 | 1-3 (fireteam 3) | no |
| 167 | act_mars_m04_checkpoint | story/mission | 19 | 1-3 (fireteam 3) | no |
| 168 | act_mars_m05_warbase | story/mission | 19 | 1-3 (fireteam 3) | no |
| 169 | act_mars_m06_subway | story/mission | 17 | 1-3 (fireteam 3) | no |
| 170 | act_mars_m07_lowergarden | story/mission | 20 | 1-3 (fireteam 3) | no |
| 171 | act_city_tower_cine_103 | cinematic; story/mission | 20 | 1-3 (fireteam 3) | no |
| 199 | mars_portal_1 | portal (strike/playlist-style) | 16 | 1-3 (fireteam 3) | no |
| 200 | mars_portal_1 | portal (strike/playlist-style) | 20 | 1-3 (fireteam 3) | no |
| 201 | mars_portal_1 | portal (strike/playlist-style) | 22 | 1-3 (fireteam 3) | no |
| 202 | mars_portal_1 | portal (strike/playlist-style) | 24 | 1-3 (fireteam 3) | no |
| 203 | mars_portal_2 | portal (strike/playlist-style) | 19 | 1-3 (fireteam 3) | no |
| 204 | mars_portal_2 | portal (strike/playlist-style) | 20 | 1-3 (fireteam 3) | no |
| 205 | mars_portal_2 | portal (strike/playlist-style) | 22 | 1-3 (fireteam 3) | no |
| 206 | mars_portal_2 | portal (strike/playlist-style) | 24 | 1-3 (fireteam 3) | no |
| 207 | mars_portal_1 | portal (strike/playlist-style) | 24 | 1-3 (fireteam 3) | no |

### Destination index 9: Moon (name hash 0xedde656a, 10 rows)

| Index | Name | Type | Level | Players (fireteam) | Loadable |
|---|---|---|---|---|---|
| 5 | moon_patrols_1 | patrol | 10 | 1-3 (fireteam 3) | no |
| 152 | act_moon_m1_launchtubes | story/mission | 5 | 1-3 (fireteam 3) | no |
| 153 | act_moon_m3_lowercitadel | story/mission | 7 | 1-3 (fireteam 3) | no |
| 154 | act_moon_m4_uppercitadel | story/mission | 6 | 1-3 (fireteam 3) | no |
| 155 | act_moon_m5_strength | story/mission | 10 | 1-3 (fireteam 3) | no |
| 156 | act_moon_m6_reactor | story/mission | 14 | 1-3 (fireteam 3) | no |
| 187 | moon_portal_2 | portal (strike/playlist-style) | 8 | 1-3 (fireteam 3) | no |
| 188 | moon_portal_2 | portal (strike/playlist-style) | 20 | 1-3 (fireteam 3) | no |
| 189 | moon_portal_2 | portal (strike/playlist-style) | 22 | 1-3 (fireteam 3) | no |
| 190 | moon_portal_2 | portal (strike/playlist-style) | 24 | 1-3 (fireteam 3) | no |

### Destination index 10: Crucible (name hash 0xaf5b9d5e, 147 rows)

| Index | Name | Type | Level | Players (fireteam) | Loadable |
|---|---|---|---|---|---|
| 8 | (no name) | crucible playlist | 9 | 1-6 (fireteam 3) | no |
| 9 | (no name) | crucible playlist | 7 | 1-12 (fireteam 6) | no |
| 10 | (no name) | crucible playlist | 11 | 1-6 (fireteam 3) | no |
| 11 | (no name) | crucible playlist | 5 | 1-12 (fireteam 6) | no |
| 12 | (no name) | crucible playlist | 13 | 1-6 (fireteam 3) | no |
| 13 | pvp_academy_vault | crucible mode A (3v3) | 5 | 1-6 (fireteam 3) | no |
| 14 | pvp_academy_vault | crucible mode B (6v6) | 5 | 1-12 (fireteam 6) | no |
| 15 | pvp_academy_vault | crucible mode E (3v3) | 10 | 1-6 (fireteam 3) | no |
| 16 | pvp_academy_vault | crucible mode C (6v6) | 1 | 1-12 (fireteam 6) | no |
| 17 | pvp_academy_vault | crucible mode D (3v3) | 15 | 1-6 (fireteam 3) | no |
| 18 | pvp_anomaly | crucible mode A (3v3) | 5 | 1-6 (fireteam 3) | no |
| 19 | pvp_anomaly | crucible mode B (6v6) | 5 | 1-12 (fireteam 6) | no |
| 20 | pvp_anomaly | crucible mode E (3v3) | 10 | 1-6 (fireteam 3) | no |
| 21 | pvp_anomaly | crucible mode C (6v6) | 1 | 1-12 (fireteam 6) | no |
| 22 | pvp_anomaly | crucible mode D (3v3) | 15 | 1-6 (fireteam 3) | no |
| 23 | pvp_arena_hive | crucible mode A (3v3) | 5 | 1-6 (fireteam 3) | no |
| 24 | pvp_arena_hive | crucible mode B (6v6) | 5 | 1-12 (fireteam 6) | no |
| 25 | pvp_arena_hive | crucible mode E (3v3) | 10 | 1-6 (fireteam 3) | no |
| 26 | pvp_arena_hive | crucible mode C (6v6) | 1 | 1-6 (fireteam 3) | no |
| 27 | pvp_arena_hive | crucible mode D (3v3) | 15 | 1-12 (fireteam 6) | no |
| 28 | pvp_cabal_camp | crucible mode A (3v3) | 5 | 1-6 (fireteam 3) | no |
| 29 | pvp_cabal_camp | crucible mode B (6v6) | 5 | 1-12 (fireteam 6) | no |
| 30 | pvp_cabal_camp | crucible mode E (3v3) | 10 | 1-6 (fireteam 3) | no |
| 31 | pvp_cabal_camp | crucible mode C (6v6) | 1 | 1-12 (fireteam 6) | no |
| 32 | pvp_cabal_camp | crucible mode D (3v3) | 15 | 1-6 (fireteam 3) | no |
| 33 | pvp_city_defense | crucible mode A (3v3) | 5 | 1-6 (fireteam 3) | no |
| 34 | pvp_city_defense | crucible mode B (6v6) | 5 | 1-12 (fireteam 6) | no |
| 35 | pvp_city_defense | crucible mode E (3v3) | 10 | 1-6 (fireteam 3) | no |
| 36 | pvp_city_defense | crucible mode C (6v6) | 1 | 1-12 (fireteam 6) | no |
| 37 | pvp_city_defense | crucible mode D (3v3) | 15 | 1-6 (fireteam 3) | no |
| 38 | pvp_colony_ship | crucible mode A (3v3) | 5 | 1-6 (fireteam 3) | no |
| 39 | pvp_colony_ship | crucible mode B (6v6) | 5 | 1-12 (fireteam 6) | no |
| 40 | pvp_colony_ship | crucible mode E (3v3) | 10 | 1-6 (fireteam 3) | no |
| 41 | pvp_colony_ship | crucible mode C (6v6) | 1 | 1-12 (fireteam 6) | no |
| 42 | pvp_colony_ship | crucible mode D (3v3) | 15 | 1-6 (fireteam 3) | no |
| 43 | pvp_cosmobattle | crucible mode A (3v3) | 5 | 1-6 (fireteam 3) | no |
| 44 | pvp_cosmobattle | crucible mode B (6v6) | 5 | 1-12 (fireteam 6) | no |
| 45 | pvp_cosmobattle | crucible mode E (3v3) | 10 | 1-6 (fireteam 3) | no |
| 46 | pvp_cosmobattle | crucible mode C (6v6) | 1 | 1-12 (fireteam 6) | no |
| 47 | pvp_cosmobattle | crucible mode D (3v3) | 15 | 1-6 (fireteam 3) | no |
| 48 | pvp_den | crucible mode A (3v3) | 5 | 1-6 (fireteam 3) | no |
| 49 | pvp_den | crucible mode B (6v6) | 5 | 1-12 (fireteam 6) | no |
| 50 | pvp_den | crucible mode E (3v3) | 10 | 1-6 (fireteam 3) | no |
| 51 | pvp_den | crucible mode C (6v6) | 1 | 1-12 (fireteam 6) | no |
| 52 | pvp_den | crucible mode D (3v3) | 15 | 1-6 (fireteam 3) | no |
| 53 | pvp_factory | crucible mode A (3v3) | 5 | 1-6 (fireteam 3) | YES |
| 54 | pvp_factory | crucible mode B (6v6) | 5 | 1-12 (fireteam 6) | YES |
| 55 | pvp_factory | crucible mode E (3v3) | 10 | 1-6 (fireteam 3) | YES |
| 56 | pvp_factory | crucible mode C (6v6) | 1 | 1-12 (fireteam 6) | YES |
| 57 | pvp_factory | crucible mode D (3v3) | 15 | 1-6 (fireteam 3) | YES |
| 58 | pvp_gladiator | crucible mode A (3v3) | 5 | 1-6 (fireteam 3) | no |
| 59 | pvp_gladiator | crucible mode B (6v6) | 5 | 1-12 (fireteam 6) | no |
| 60 | pvp_gladiator | crucible mode E (3v3) | 10 | 1-6 (fireteam 3) | no |
| 61 | pvp_gladiator | crucible mode C (6v6) | 1 | 1-12 (fireteam 6) | no |
| 62 | pvp_gladiator | crucible mode D (3v3) | 15 | 1-6 (fireteam 3) | no |
| 63 | pvp_greenhouse | crucible mode A (3v3) | 5 | 1-6 (fireteam 3) | no |
| 64 | pvp_greenhouse | crucible mode B (6v6) | 5 | 1-12 (fireteam 6) | no |
| 65 | pvp_greenhouse | crucible mode E (3v3) | 10 | 1-6 (fireteam 3) | no |
| 66 | pvp_greenhouse | crucible mode C (6v6) | 1 | 1-12 (fireteam 6) | no |
| 67 | pvp_greenhouse | crucible mode D (3v3) | 15 | 1-6 (fireteam 3) | no |
| 68 | pvp_hellmouth | crucible mode A (3v3) | 5 | 1-6 (fireteam 3) | no |
| 69 | pvp_hellmouth | crucible mode B (6v6) | 5 | 1-12 (fireteam 6) | no |
| 70 | pvp_hellmouth | crucible mode E (3v3) | 10 | 1-6 (fireteam 3) | no |
| 71 | pvp_hellmouth | crucible mode C (6v6) | 1 | 1-12 (fireteam 6) | no |
| 72 | pvp_hellmouth | crucible mode D (3v3) | 15 | 1-6 (fireteam 3) | no |
| 73 | pvp_hive | crucible mode A (3v3) | 5 | 1-6 (fireteam 3) | no |
| 74 | pvp_hive | crucible mode B (6v6) | 5 | 1-12 (fireteam 6) | no |
| 75 | pvp_hive | crucible mode E (3v3) | 10 | 1-6 (fireteam 3) | no |
| 76 | pvp_hive | crucible mode C (6v6) | 1 | 1-12 (fireteam 6) | no |
| 77 | pvp_hive | crucible mode D (3v3) | 15 | 1-6 (fireteam 3) | no |
| 78 | pvp_hive_moon | crucible mode A (3v3) | 5 | 1-6 (fireteam 3) | no |
| 79 | pvp_hive_moon | crucible mode B (6v6) | 5 | 1-12 (fireteam 6) | no |
| 80 | pvp_hive_moon | crucible mode E (3v3) | 10 | 1-6 (fireteam 3) | no |
| 81 | pvp_hive_moon | crucible mode C (6v6) | 1 | 1-12 (fireteam 6) | no |
| 82 | pvp_hive_moon | crucible mode D (3v3) | 15 | 1-6 (fireteam 3) | no |
| 83 | pvp_longshot | crucible mode A (3v3) | 5 | 1-6 (fireteam 3) | no |
| 84 | pvp_longshot | crucible mode B (6v6) | 5 | 1-12 (fireteam 6) | no |
| 85 | pvp_longshot | crucible mode E (3v3) | 10 | 1-6 (fireteam 3) | no |
| 86 | pvp_longshot | crucible mode C (6v6) | 1 | 1-12 (fireteam 6) | no |
| 87 | pvp_longshot | crucible mode D (3v3) | 15 | 1-6 (fireteam 3) | no |
| 88 | pvp_marsbattle | crucible mode A (3v3) | 5 | 1-6 (fireteam 3) | YES |
| 89 | pvp_marsbattle | crucible mode B (6v6) | 5 | 1-12 (fireteam 6) | YES |
| 90 | pvp_marsbattle | crucible mode E (3v3) | 10 | 1-6 (fireteam 3) | YES |
| 91 | pvp_marsbattle | crucible mode C (6v6) | 1 | 1-12 (fireteam 6) | YES |
| 92 | pvp_marsbattle | crucible mode D (3v3) | 15 | 1-6 (fireteam 3) | YES |
| 93 | pvp_mining | crucible mode A (3v3) | 5 | 1-6 (fireteam 3) | no |
| 94 | pvp_mining | crucible mode B (6v6) | 5 | 1-12 (fireteam 6) | no |
| 95 | pvp_moonbase | crucible mode A (3v3) | 5 | 1-6 (fireteam 3) | no |
| 96 | pvp_moonbase | crucible mode B (6v6) | 5 | 1-12 (fireteam 6) | no |
| 97 | pvp_moonbase | crucible mode E (3v3) | 10 | 1-6 (fireteam 3) | no |
| 98 | pvp_moonbase | crucible mode C (6v6) | 1 | 1-12 (fireteam 6) | no |
| 99 | pvp_moonbase | crucible mode D (3v3) | 15 | 1-6 (fireteam 3) | no |
| 100 | pvp_oasis | crucible mode A (3v3) | 5 | 1-6 (fireteam 3) | no |
| 101 | pvp_oasis | crucible mode B (6v6) | 5 | 1-12 (fireteam 6) | no |
| 102 | pvp_oasis | crucible mode E (3v3) | 10 | 1-6 (fireteam 3) | no |
| 103 | pvp_oasis | crucible mode C (6v6) | 1 | 1-12 (fireteam 6) | no |
| 104 | pvp_oasis | crucible mode D (3v3) | 15 | 1-6 (fireteam 3) | no |
| 105 | pvp_refinery | crucible mode A (3v3) | 5 | 1-6 (fireteam 3) | no |
| 106 | pvp_refinery | crucible mode B (6v6) | 5 | 1-12 (fireteam 6) | no |
| 107 | pvp_refinery | crucible mode E (3v3) | 10 | 1-6 (fireteam 3) | no |
| 108 | pvp_refinery | crucible mode C (6v6) | 1 | 1-12 (fireteam 6) | no |
| 109 | pvp_refinery | crucible mode D (3v3) | 15 | 1-6 (fireteam 3) | no |
| 110 | pvp_rooftops | crucible mode A (3v3) | 5 | 1-6 (fireteam 3) | no |
| 111 | pvp_rooftops | crucible mode B (6v6) | 5 | 1-12 (fireteam 6) | no |
| 112 | pvp_rooftops | crucible mode E (3v3) | 10 | 1-6 (fireteam 3) | no |
| 113 | pvp_rooftops | crucible mode C (6v6) | 1 | 1-12 (fireteam 6) | no |
| 114 | pvp_rooftops | crucible mode D (3v3) | 15 | 1-6 (fireteam 3) | no |
| 115 | pvp_shroud | crucible mode A (3v3) | 5 | 1-6 (fireteam 3) | no |
| 116 | pvp_shroud | crucible mode B (6v6) | 5 | 1-12 (fireteam 6) | no |
| 117 | pvp_shroud | crucible mode E (3v3) | 10 | 1-6 (fireteam 3) | no |
| 118 | pvp_shroud | crucible mode C (6v6) | 1 | 1-12 (fireteam 6) | no |
| 119 | pvp_shroud | crucible mode D (3v3) | 15 | 1-6 (fireteam 3) | no |
| 120 | pvp_venus_hcc | crucible mode A (3v3) | 5 | 1-6 (fireteam 3) | no |
| 121 | pvp_venus_hcc | crucible mode B (6v6) | 5 | 1-12 (fireteam 6) | no |
| 122 | pvp_venus_hcc | crucible mode E (3v3) | 10 | 1-6 (fireteam 3) | no |
| 123 | pvp_venus_hcc | crucible mode C (6v6) | 1 | 1-12 (fireteam 6) | no |
| 124 | pvp_venus_hcc | crucible mode D (3v3) | 15 | 1-6 (fireteam 3) | no |
| 125 | pvp_venus_shores | crucible mode A (3v3) | 5 | 1-6 (fireteam 3) | no |
| 126 | pvp_venus_shores | crucible mode B (6v6) | 5 | 1-12 (fireteam 6) | no |
| 127 | pvp_venus_shores | crucible mode E (3v3) | 10 | 1-6 (fireteam 3) | no |
| 128 | pvp_venus_shores | crucible mode C (6v6) | 1 | 1-12 (fireteam 6) | no |
| 129 | pvp_venus_shores | crucible mode D (3v3) | 15 | 1-6 (fireteam 3) | no |
| 130 | pvp_vex_tube | crucible mode A (3v3) | 5 | 1-6 (fireteam 3) | no |
| 131 | pvp_vex_tube | crucible mode B (6v6) | 5 | 1-12 (fireteam 6) | no |
| 132 | pvp_vex_tube | crucible mode E (3v3) | 10 | 1-6 (fireteam 3) | no |
| 133 | pvp_vex_tube | crucible mode C (6v6) | 1 | 1-12 (fireteam 6) | no |
| 134 | pvp_vex_tube | crucible mode D (3v3) | 15 | 1-6 (fireteam 3) | no |
| 135 | pvp_wall | crucible mode A (3v3) | 5 | 1-6 (fireteam 3) | no |
| 136 | pvp_wall | crucible mode B (6v6) | 5 | 1-12 (fireteam 6) | no |
| 137 | pvp_wall | crucible mode E (3v3) | 10 | 1-6 (fireteam 3) | no |
| 138 | pvp_wall | crucible mode C (6v6) | 1 | 1-12 (fireteam 6) | no |
| 139 | pvp_wall | crucible mode D (3v3) | 15 | 1-6 (fireteam 3) | no |
| 140 | pvp_wilderness_town | crucible mode A (3v3) | 5 | 1-6 (fireteam 3) | no |
| 141 | pvp_wilderness_town | crucible mode B (6v6) | 5 | 1-12 (fireteam 6) | no |
| 142 | pvp_wilderness_town | crucible mode E (3v3) | 10 | 1-6 (fireteam 3) | no |
| 143 | pvp_wilderness_town | crucible mode C (6v6) | 1 | 1-12 (fireteam 6) | no |
| 144 | pvp_wilderness_town | crucible mode D (3v3) | 15 | 1-6 (fireteam 3) | no |
| 219 | pvp_factory | crucible mode A (3v3) | 0 | 1-12 (fireteam 6) | YES |
| 221 | pvp_factory | crucible mode C (6v6) | 0 | 1-12 (fireteam 6) | YES |
| 222 | pvp_gladiator | crucible mode C (6v6) | 0 | 1-12 (fireteam 6) | no |
| 230 | pvp_factory | crucible mode C (6v6) | 0 | 1-12 (fireteam 6) | YES |
| 231 | pvp_factory | crucible mode A (3v3) | 0 | 1-6 (fireteam 3) | YES |
| 232 | (no name) | crucible playlist | 0 | 1-12 (fireteam 6) | no |
| 233 | (no name) | crucible playlist | 0 | 1-6 (fireteam 3) | no |
| 241 | pvp_factory | crucible mode C (6v6) | 0 | 1-12 (fireteam 6) | YES |
| 242 | pvp_marsbattle | crucible mode C (6v6) | 0 | 1-12 (fireteam 6) | YES |
| 243 | (no name) | crucible playlist | 0 | 1-12 (fireteam 6) | no |

### Destination index 12: City tower (name hash 0x79cbded5, 6 rows)

| Index | Name | Type | Level | Players (fireteam) | Loadable |
|---|---|---|---|---|---|
| 0 | city_tower_default1 | social/tower | 0 | 1-16 (fireteam 6) | YES |
| 177 | pvp_intro | pvp intro | 5 | 1-1 (fireteam 1) | no |
| 178 | pvp_intro | pvp intro | 5 | 1-1 (fireteam 1) | no |
| 220 | city_tower_default1 | social/tower | 0 | 1-16 (fireteam 6) | YES |
| 229 | city_tower_default1 | social/tower | 1 | 1-16 (fireteam 6) | YES |
| 240 | city_tower_default1 | social/tower | 1 | 1-16 (fireteam 6) | YES |

### Destination index 13: Venus (name hash 0x71aec1dc, 36 rows)

| Index | Name | Type | Level | Players (fireteam) | Loadable |
|---|---|---|---|---|---|
| 6 | venus_patrols_1 | patrol | 14 | 1-3 (fireteam 3) | no |
| 145 | venus_raid_1 | raid | 27 | 1-9 (fireteam 6) | no |
| 146 | venus_raid_1 | raid | 31 | 1-9 (fireteam 6) | no |
| 147 | venus_raid_1 | raid | 32 | 1-9 (fireteam 6) | no |
| 157 | act_venus_m01_engineering | story/mission | 12 | 1-3 (fireteam 3) | no |
| 158 | act_venus_m02_southern_tides | story/mission | 14 | 1-3 (fireteam 3) | no |
| 159 | act_venus_m03_thieves_den | story/mission | 13 | 1-3 (fireteam 3) | no |
| 160 | act_venus_m05_vault | story/mission | 15 | 1-3 (fireteam 3) | no |
| 161 | act_venus_m06_ketch | story/mission | 17 | 1-3 (fireteam 3) | no |
| 162 | act_venus_m07_northern_tides | story/mission | 15 | 1-3 (fireteam 3) | no |
| 163 | act_cinematic_queen_102 | cinematic; story/mission | 15 | 1-3 (fireteam 3) | no |
| 176 | act_cinematic_queen_101 | cinematic; story/mission | 14 | 1-3 (fireteam 3) | no |
| 191 | venus_portal_1 | portal (strike/playlist-style) | 14 | 1-3 (fireteam 3) | no |
| 192 | venus_portal_1 | portal (strike/playlist-style) | 20 | 1-3 (fireteam 3) | no |
| 193 | venus_portal_1 | portal (strike/playlist-style) | 22 | 1-3 (fireteam 3) | no |
| 194 | venus_portal_1 | portal (strike/playlist-style) | 24 | 1-3 (fireteam 3) | no |
| 195 | venus_portal_2 | portal (strike/playlist-style) | 16 | 1-3 (fireteam 3) | no |
| 196 | venus_portal_2 | portal (strike/playlist-style) | 20 | 1-3 (fireteam 3) | no |
| 197 | venus_portal_2 | portal (strike/playlist-style) | 22 | 1-3 (fireteam 3) | no |
| 198 | venus_portal_2 | portal (strike/playlist-style) | 24 | 1-3 (fireteam 3) | no |
| 208 | venus_treasure_archive | story/mission | 0 | 1-3 (fireteam 3) | no |
| 209 | venus_treasure_archive | story/mission | 0 | 1-3 (fireteam 3) | no |
| 210 | venus_treasure_archive | story/mission | 0 | 1-3 (fireteam 3) | no |
| 211 | venus_treasure_north_tides | story/mission | 0 | 1-3 (fireteam 3) | no |
| 212 | venus_treasure_north_tides | story/mission | 0 | 1-3 (fireteam 3) | no |
| 213 | venus_treasure_north_tides | story/mission | 0 | 1-3 (fireteam 3) | no |
| 214 | venus_treasure_ketch | story/mission | 0 | 1-3 (fireteam 3) | no |
| 215 | venus_treasure_ketch | story/mission | 0 | 1-3 (fireteam 3) | no |
| 216 | venus_treasure_ketch | story/mission | 0 | 1-3 (fireteam 3) | no |
| 218 | takehome_map | test; story/mission | 1 | 1-3 (fireteam 3) | no |
| 223 | dlc_test_activity | test; story/mission | 1 | 1-9 (fireteam 9) | no |
| 224 | perf_warp_ruins | test; story/mission | 1 | 1-9 (fireteam 9) | no |
| 225 | transition_test_activity | test; story/mission | 1 | 1-3 (fireteam 3) | no |
| 226 | transition_test_activity | test; portal (strike/playlist-style) | 1 | 1-3 (fireteam 3) | no |
| 227 | transition_test_activity | test; patrol | 1 | 1-3 (fireteam 3) | no |
| 228 | transition_test_activity | test; raid | 1 | 1-6 (fireteam 6) | no |

Destination 0, 2, 7, 11, 14-17 have no activity rows. Destination name hashes are not cracked (fnv1 guesses for common words found only `raid`, a false match).
