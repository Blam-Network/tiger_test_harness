# Teleport assert: idle Passenger binding ref (betath 38464)

2026-10-22. PS4 pre-alpha 38464.14.02.28.1027.betath, IDA `eboot-ida.elf` (headless :13345, addresses = guest offsets).

## Symptom

`cosmo_patrols_1`, script debugger teleport to slice 1.0 (twice: transition 0x0 and 0xc8871250). The server logs "client teleport state=2", "FAH slot handoff complete (no abandon); applying slice 1", sends the slice apply (class 5, 18831B), "client teleport state=3", then the client asserts with an empty message (crashes `crash_folder_20261022_034604` and `_035046`; client logs `windowed-20261022T124612Z-exit139.log` ~48654 and `windowed-20261022T125052Z-exit139.log` ~10930). The transition does not matter: it is the slice's content.

Stack past the reporter (0x6DE373, 0x62A9B3, 0x62ABF0):
`0x1605BE5` sub_1605BA0 -> `0x1608DA9` sub_1608D80 (tail-called by sub_1608EC0) -> `0x1901AC4` passenger client handler (0x1901900, no IDA function) -> `0x7625F9` sub_762550 (delegate call) -> `0x16070F9` sub_1607070 -> `0x1822183` sub_18220F0 (reconcile) -> ...

## The check

- The handler at 0x1901900 logs `activities:client:passenger: '' is reconciling` and `activities:client:passenger: should be bound to '%s', cookie #%d`. It checks the row's sense / auth schema ids ([r14+8], [r14+0xC]), then takes the 12-byte auth (`sub_181C330(r14, 0xC)`, r12).
- Formatting the second message (inside a static-init guard, so on the first passenger reconcile): `0x1901aba lea rdi, [r12+4]` / `call sub_1608EC0` (name of the binding ref), `0x1901ac4 mov edx, [r12]` (the cookie). Confirmed in disassembly.
- sub_1608EC0 jumps to sub_1608D80, which calls sub_1605BA0 on the ref first (`0x1608da4`); a valid binding gives its name, an unset one "<invalid binding>".
- sub_1605BA0 asserts the ref's type byte (+4) is non-zero (`0x1605BDA test bl, bl` / `0x1605BE0 call sub_62AB70`, see patrol-crash.md). An unset ref (type 0xFF, index 0xFFFF) passes; type 0 asserts.

So a Passenger auth whose binding names type 0 asserts as soon as the row reconciles.

## The row

- 80802225 (catalog, 12 bytes): [0] i32 31 bits bias 0 at +0 (the cookie), [1] client ref 80800486 at +4 (the binding). The only auth of that shape the tables use; every Passenger row (type 37) in the build's 84 scenarios names it.
- cosmo_patrols_1 rows: `skiff_passenger` (bundle 51f665ba, tag 80BAAB4B, slice set 1, the slice the teleport applied) and three `pf_event_tank_drop[N].dropship_passenger` (bundle 7c2845cf, slice set 10). Also in cosmo_portal_1 and ambient_cosmo.
- Retail capture (cosmo_portal_1, enc_blast_portal1 skiff_passenger): idle {0, unset ref}; bound {1, {634863c2, Actor 2, 4}} as the skiff arrives; unbound {2, unset}. The cookie moves on each change.

## What the server sent

- No script writes reach a Passenger row (item-sink's `encodeRow` has no "passenger" case), so the apply gave it `idleAuth(0x80802225)`, which fell back to ZERO_AUTH (`zero-auth.ts`, 85 bits `00000000000000000c0000`): cookie 0, bundle 0, **type 0**, index 0.

## Fix

- `src/activity-host-proxy/versions/v38464_14_02_28_1027_betath/ah.ts` PassengerAuth (80802225: cookie, binding), checked against the catalog by schemas.test.ts.
- `.../v38464_14_02_28_1027_betath/sensor-auth.ts` `encodePassengerAuth`; `IDLE_AUTH` idles 80802225 as cookie 0 and the unset ref (empty hash / -1 / -1), the retail idle. Same 85 bits.

## Audit

Every betath auth schema in ZERO_AUTH whose zero body writes a client ref through required members only (optional members absent and empty lists hold none):

| schema | row type | idle |
|---|---|---|
| 808003E3 | TriggerGroup | IDLE_AUTH (unset volume) |
| 80800637 | HopOn | IDLE_AUTH (unset filter) |
| 808006CA | PlayerMonitor | IDLE_AUTH (unset filter) |
| 808007B4 | Object | IDLE_AUTH (unset ref) |
| 8080232B | Loot | IDLE_AUTH (unset filter) |
| 808023BE | PlayerObjective | IDLE_AUTH (patrol-crash.md) |
| 808024DF | Cinematic | IDLE_AUTH (unset ref) |
| 8080297F | Sequence | IDLE_AUTH (unset viewers) |
| 80802225 | Passenger | IDLE_AUTH (this fix) |
| 808004DD, 8080064F, 808007FA | none | no row in any of the 84 scenarios |

Squad (8080082A) and Actor (80800844) have their refs only under optional members, absent in the zero body. ObjectFilter (80800732) is an empty predicate list and Objective (808004D0) two absent optionals: no refs. The rest (PlayerTrigger, HardWipeGlobals, Scoreboard, type 36, Timer, type 39) have none.

`idle-auth-refs.builds.test.ts` walks the catalog for these schemas and fails if one idles on its zero body, the three row-less ones aside; it also checks the idle Passenger body.

## Open

- Script passenger state (bullshcript `{kind: "passenger"}`, seat/release) is not sent: item-sink has no case for it, so a Passenger row stays idle. Retail binds skiff_passenger to its Actor; a missing binding is untested on the client.
- The three row-less schemas still idle on the zero body; their row types are unknown here.
