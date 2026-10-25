# Patrol assert: idle PlayerObjective nav slot refs (betath 38464)

2026-10-22. PS4 pre-alpha 38464.14.02.28.1027.betath, IDA `eboot-ida.elf` (headless :13345, addresses = guest offsets).

## Symptom

`cosmo_patrols_1` (activity 239): the FAH binds, then the GAH binds and joins, the script host starts ("script host drive for cosmo_patrols_1") and pushes the world's sensor applies (class-5 payloads of 17923B to the FAH and 12579B to the GAH). The client processes PAH membership update 11, logs `discarded auth update because we are expecting an initial update` twice and asserts with an empty message (crash `crash_folder_20261022_015651`, client log `windowed-20261022T105656Z-exit139.log` ~9470).

Stack, innermost first, past the reporter (0x6DE373 sub_6DE300, 0x62A9B3, 0x62ABF0 sub_62AB70):
`0x1605BE5` sub_1605BA0 -> `0xB1EB2C` sub_B1EAB0 -> `0xB3306E` (player objective client handler, no IDA function) -> `0x762385` sub_7622C0 (delegate call) -> `0x18E4FEB` sub_18E4F10 -> `0x1821F2B` sub_1821A70 -> `0x1821A6B` sub_1821A60 -> `0x181FD2F` sub_181E2A0 -> `0x17EF371` sub_17EEEC0 -> ... sub_10C22F0.

## The check

- The handler around 0xB32D00-0xB3308E logs `activities:sensors:player_objective:client: ...` (e.g. "clearing public event music state because the player is no longer engaged"). It is the PlayerObjective sensor's client update, run from the sensor reconcile on every update of the row.
- On every update it loops over the 10 nav slots (`rbx` 0..0x280 step 0x40, slot = sensor + 0x1F0 + rbx). For each slot: sub_1B334D0 makes a handle to the slot, then `call sub_B1EAB0` (0xB33069).
- sub_B1EAB0 (`activities:hud:waypoints`): `0xB1EB22 lea rdi, [rbx+r14+20h]` / `call sub_1605BA0`: validates the slot's +0x20 member before it looks at the slot's +0 byte.
- sub_1605BA0 is a client-ref validity check on that 8-byte ref (80800486: u32 bundle +0, i8 type +4, i16 index +6). Confirmed in disassembly:
  - `0x1605BCB mov bl, [r15+4]` / `0x1605BDA test bl, bl` / `jnz 0x1605BE5` / `0x1605BE0 call sub_62AB70` (assert). The return address 0x1605BE5 in the stack is this assert: **the ref's type is 0**.
  - Next it asserts that a type of 0xFF (unset) comes with index 0xFFFF.
- 808027D4 (nav slot, 64 bytes): [0] i8 +0, [1] i8 +1, [2] ref +4, [3] i32 bubble +12, [4] kind-13 point +16, **[5] NavPoint ref +32**. The slot's own default (catalog trailing bytes) holds the unset ref `C59D1C81 FF 00 FFFF` there.

So a PlayerObjective auth whose nav slot [5] names type 0 asserts as soon as the row is reconciled, nav point shown or not.

## What the server sent

- `buildApplySenseEntries` (`src/activity-host-proxy/rsat/sensor-auth-fields.ts`) gives every sensor the scripts have not written its idle auth, `idleAuth(schema)`, which falls back to ZERO_AUTH (every member zero).
- Betath's PlayerObjective auth 808023BE has no optional member (40662/41375 have optional nav points, so their zero body leaves the client's unset refs alone). Its zero body (`zero-auth.ts`, 2899 bits) writes every ref as bundle 0 / **type 0** / index 0: [1], [7] and each slot's [2] and [5].
- Patrol worlds carry idle PlayerObjective rows: the public event bundles (`u_event_countdown_preset.esu`, the Warsat / dropship events just ported) and the patrol missions (`cosmo_portal1_activity_mission1-8.esp`). Tower and the story missions tested so far either had none or had them written by script (`encodePlayerObjectiveAuth`, unset refs) before the client saw them.

## Fix

`src/activity-host-proxy/versions/v38464_14_02_28_1027_betath/sensor-auth.ts`, `IDLE_AUTH`: 808023BE idles as `encodePlayerObjectiveAuth({ state: None })`: state 0, every ref unset (empty hash / -1 / -1), bubble -1, no progress, participants/tier 0. Same 2899 bits as the zero body. Betath only; other builds unchanged.

Test: `player-objective-idle.builds.test.ts` walks the idle body and checks all 22 refs are unset, and that the zero body's slot-0 NavPoint ref is type 0.

## Open

- Other zero bodies with required refs could hit similar ref checks in other handlers (the ObjectFilter and Objective rows, among others, still idle through their zero auth). Not seen yet.
- The crash happened right after the GAH apply; which world's row tripped first was not pinned (both get idle PlayerObjective rows).
