# Hard wipe: which phases are armed (2.3.1 captures, 2026-10-21)

From the story_common `hard_wipe_globals` row, field u0 ("hard wipe enabled"), matched to our TU0 phase
scripts by Lifetime phase hash (`unknown4` = signed fnv1 of the phase name; 0 misses). All ON edges and
17 of 19 OFF edges sit exactly on a phase start, so u0 is a per-phase flag: `@hard_wipe()` on the `.esp`.
Paths are under `fukugen-daihon/destiny1/v41375_14_07_03_1501_live/es/`.

| Activity | Armed phases (`.esp`) | Evidence |
|---|---|---|
| act_cosmo_m0_5_hangar | `_mission2` phase01_hangar | one run |
| act_cosmo_m1_dome_a | `_mission1` phase00, `_mission2` phase01 | on from activity start |
| act_cosmo_m2_dome_c | `_mission3` phase02, `_mission4` phase03 | one run |
| act_cosmo_m4_dome_c | `_mission2` phase01, `_mission3` phase02 | one run |
| cosmo_portal1_activity | `_mission2` .. `_mission7` (phase01 .. phase06) | one run |
| act_mars_m01_valley | `_mission2` .. `_mission5` (plains_intro, plains_base, checkpoint, checkpoint_boss) | one run |
| act_mars_m05_warbase | `_mission5` .. `_mission8` (6_gatehouse, 7_warbase_goto, 7_5_warbase, 8_warbase) | u0 goes off mid-phase_8_warbase when `pf_kill_boss` ends (u2 0 -> 2 in the same frame) |
| act_mars_m06_subway | `_mission4` .. `_mission7` (lobby_s, lobby_n, subway_goto, subway) | one run |
| act_mars_m07_lowergarden | `_mission4`, `_mission5` (uppergarden, lowergarden); `_mission7` .. `_mission9` (hopdown, darkness, climax) | two intervals, cinematic between is off |
| act_moon_m1_launchtubes | `_mission7` door_launchtubes, `_mission8` 5_launchtubes | one run |
| act_moon_m3_lowercitadel | `_mission2` .. `_mission4` (lowercitadel, strength, strength_b) | one run |
| act_moon_m5_strength | `_mission6` strength_start, `_mission7` 4_strength | one run |
| moon_portal_2 | `_mission2` .. `_mission6` (phase01 .. phase05) | phase05 (the end phase) stays on; every other mission's last phase is off |
| act_venus_m01_engineering | `_mission4` entrance_vex_conflux, `_mission5` entrance_resist_vex | one run |
| act_venus_m07_northern_tides | `_mission2` .. `_mission4` (southern_tides_goto, ascend_steps, boss) | two runs agree |
| venus_strike_1_activity (venus_portal_1) | `_mission1` .. `_mission4` (engineering, engineering_trans, dig_site, ruins) | on from activity start |
| act_cosmo_m0_highway | none | 7 runs, never on |

Alpha counterparts (`v36735_13_12_02_1953_alpha/es/venus/`):
- `strike_1_activity/venus_strike_1_mission1..3` (engineering, dig_site, ruins): armed, as the Nexus
  (same phase names). `mission4_temp` (end_phase): not armed.
- `chapter_2_activity/venus_chapter_2_mission3` (southern tides) and `_mission4` (northern tides
  miniboss): probably armed, matched by area and encounter to m07, not by name. `_mission1`, `_mission2`:
  no counterpart.

Not marked: intros, cinematics, `_goto` traversal phases listed as off, and outro / complete phases.
Scratch: session scratchpad `hardwipe3\` (phases.py, edges.py, perphase.py).
