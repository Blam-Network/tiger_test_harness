# Tower join assert: squad roster length (betath 38464)

2026-10-22. PS4 pre-alpha 38464.14.02.28.1027.betath, IDA `eboot-ida.elf` (headless :13345, addresses = guest offsets).

## Symptom

Joining `city_tower_default1` through web-tiger-day0 asserts right after the activity host join. Stack (innermost first, past the assert reporter):
`0x15FF8D9` sub_15FF760 -> `0x1600398` (reconcile body, IDA folds it into sub_15FF760) -> `0x7625F9` sub_762550 (delegate call) -> `0x16070F9` sub_1607070 -> `0x1822183` sub_18220F0 -> `0x182040B` sub_18202B0 -> `0x17EDD33` sub_17ED7D0 -> `0x17EA482` sub_17EA1E0.

## What the check is

- sub_17ED7D0 logs `networking:activity_client:world: [%s] Reconciling '%s'.`: the client has become authority of a bubble and reconciles every sensor binding in it.
- sub_18220F0 is `activities:sensors:reconcile` (slot wrapper per binding); sub_18E5660 -> sub_1607070 -> per-squad delegate.
- The squad reconcile (`activities:client:squad:reconciliation: '%s' is reconciling`) fetches the squad row's state from the row, not from a message:
  - `sub_181C420(row, 160)` = the sense, schema 80800797 (squad sense; valid flag at +20).
  - `sub_181C330(row, 104)` = the auth, schema **8080082A** (squad auth, size 0x68). Only 8080082A in the catalog has size 104 with members at 0x2C (80804252), 0x50/0x54/0x58/0x5C/0x60 (i32) and 0x64/0x65 (i8), matching the reads `v70[11]`, `v70[21]`, `v70[22]`, `v70[24]`, `+101`.
  - It copies `count*4` bytes from auth+0x30 into squad+0x408, then calls sub_15FF760(squad, auth).
- sub_15FF760 (`activities:client:squad: ... placed count`), confirmed in disassembly:
  - `0x15FF8B9 mov ebx, [rax+2Ch]` (auth+0x2C), `0x15FF8CD cmp r14d, ebx` / `jz` / `call sub_62AB70` (assert). r14d = sub_15FF490(squad).
  - The reconcile also asserts at its end that auth+0x2C == squad+0x1C8 (the same count, cached).
- auth+0x2C is member [3] of 8080082A: optional nested **80804252** (`roster` in betath `ah.ts`; i32 count, 4 bits, max 8, then 8 x i32 at +0x30). So the compared length is the roster's cell count.

## The tag count

sub_15FF490(squad): squad -> sensor host definition (+0x68 = the squad definition tag, +0x70 its resolved pointer) -> squad definition +0x20 as a 64-bit block count. In gibbon betath (`definitions/squad_definition.ts`) +0x20 of `s_squad_definition` is `members` (tag block of `s_squad_member`, class 0x808014A1), and `s_squad_sensor_host_definition.squad` is at +0x68. So the client wants **roster length == the squad definition's member count** (one cell per member), for every squad it reconciles, placed or not.

Tower values (bundle row, members), from `cache/v38464_14_02_28_1027_betath/tables/city_tower_default1.json` (same gibbon reader the server uses). Every squad sensor there has auth 8080082A, sense 80800797.

- Plaza 0x8CC31436 (slice set 3, the start bubble): 4 droid_greeters 1, 6 droid_ship_directors 1, 8 droid_overwatch_guards 2, 11 vendor_pve 1, 13 vendor_cryptarch 1, 15 vendor_vanguard 1, 17 vendor_postmaster 2, 19 civ_kiosk_workers 1, 21 civ_monitor_talkers 4, 26 civ_crate_workers 3, 30 civ_talkers1 2, 33 civ_sitters1 1, 35/37/39/41 civ_walkers1-4 1.
- Boulevard 0x8D3F1166 (slice 0): 15 squads, 1-3 members. Hangar-side 0x19D43443 (slice 2): 19 squads, 1-3. Underwatch 0xAA891B91 (slice 4): 11 squads, 1-4.

No tower squad has 0 members, so a roster of length 0 always trips the assert.

## What web-tiger-day0 sends

- Encoder: `src/activity-host-proxy/versions/v38464_14_02_28_1027_betath/sensor-auth.ts` `encodeSquadAuth` (schema `SquadAuth`, roster `SquadCells`, both in `ah.ts`). Its roster is `fields.roster` as given.
- Scripted squads (`script-host/item-sink.ts` `squadBody`): roster length = `row.cells` = `memberCount`. Correct for the vendors enc_plaza_amb1 places.
- Every other squad (droids, civilians, other bubbles' squads): betath has `applyLayout.squadsAtDefinition: false` (`versions/v38464_14_02_28_1027_betath/index.ts`), so `session-sensor-auth.ts` does not build a definition body, and `buildApplySenseEntries` (`rsat/sensor-auth-fields.ts`) falls back to `sensor.idleAuth(0x8080082A)` -> no IDLE_AUTH entry -> `zero-auth.ts` `{ bits: 14, hex: "0024" }`: nine absent optionals (roster absent), killPolicy 0, carrierCargo 0. The client's roster count stays **0**.
- The same zero body comes from `item-sink.ts` `idleBody` for a squad row a wipe takes back.
- On the bubble reconcile the first unscripted squad (count 0 vs members >= 1) asserts.

## Fix needed

Every 8080082A body the betath host sends must carry member [3] (roster, 80804252) present with exactly `memberCount` cells (squad definition `members.length`, `squadDefinition()` in `src/content/index.ts`). For an unscripted squad: `roster = memberCount` zeros (plus objective as the alpha path does). Simplest: `squadsAtDefinition: true` in the betath apply layout, which reuses the `squadsAtDefinition` branch in `session-sensor-auth.ts` (`encodeSquadAuth({ bindingGeneration: 1, objective, roster: zeros(squad.cells) })`). That covers the join apply only; the item-sink idle path (`idleBody`) should also give squads a definition-length roster instead of the zero auth, or the next wipe/slice swap reproduces the assert.

Not checked: whether 40662 pubalpha has the same reconcile assert (it also has `squadsAtDefinition: false`); and which squad tripped first (the client log line `activities:client:squad:reconciliation: '%s' is reconciling` names it).
