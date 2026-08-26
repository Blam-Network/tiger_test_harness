import { rsat } from "@blamnetwork/rsat";
import { WorldHandles } from "./messages";

/** 8080046B — bundle / type / local index. */
export const SensorClientRef = rsat.schema(0x8080046b, {
  bundle: rsat.u32(),
  typeId: rsat.i8({ size: 6, bias: 1 }),
  typeIndex: rsat.i16({ bias: 0x8000 }),
});

/** 80804520 — nested under Lifetime-adjacent options, Timer, HardWipeGlobals. */
export const ActivityOptions = rsat.schema(0x80804520, {
  flag0: rsat.bool(),
  windowOpen: rsat.i32(),
  windowClose: rsat.i32(),
  unk3: rsat.i32(),
  unk4: rsat.i32(),
  unk5: rsat.i32(),
  scalar: rsat.f32(),
});

/**
 * 8080052A nested under Player sense and Fireteam. Count is a separate
 * 4-bit field; zero means no 80800E3F elements follow.
 */
export const PlayerSenseNested = rsat.schema(0x8080052a, {
  count: rsat.u32({ size: 4 }),
});

/** 8080052B — Player sense (bound; we emit has_sense=0 so this is unused). */
export const PlayerSense = rsat.schema(0x8080052b, {
  unk0: rsat.i32(),
  nested: rsat.nested(PlayerSenseNested),
  flag2: rsat.bool(),
  unk3: rsat.f32(),
  unk4: rsat.u32(),
  flag5: rsat.bool(),
  flag6: rsat.bool(),
});

/** 8080052C — Player auth. Field 0 is the spawn-gate identity key. */
export const PlayerAuth = rsat.schema(0x8080052c, {
  key: rsat.u64(),
  unk1: rsat.i8({ size: 6, bias: 3 }),
  sense: rsat.nested(PlayerSense),
  flag: rsat.bool(),
});

/** 8080052F — Lifetime. Field 0 is the spawn-ready state (want 2). */
export const LifetimeAuth = rsat.schema(0x8080052f, {
  state: rsat.i8({ size: 3, bias: 1 }),
  flag1: rsat.bool(),
  phaseIndex: rsat.i32(),
  phaseHash: rsat.u32(),
  field4: rsat.i32(),
  handles: rsat.nested(WorldHandles),
});

/** 808005AB — HardWipeGlobals. */
export const HardWipeGlobalsAuth = rsat.schema(0x808005ab, {
  options: rsat.nested(ActivityOptions),
});

/** 80800530 — Timer. */
export const TimerAuth = rsat.schema(0x80800530, {
  options: rsat.nested(ActivityOptions),
  flag: rsat.bool(),
  unk: rsat.i32(),
});

/** 80800531 — Fireteam. */
export const FireteamAuth = rsat.schema(0x80800531, {
  key: rsat.u64(),
  flag: rsat.bool(),
  nested: rsat.nested(PlayerSenseNested),
  unk: rsat.i32(),
});

/** 8080053D — empty vec under Object auth. */
export const ObjectAuthVec = rsat.schema(0x8080053d, {
  count: rsat.u32({ size: 4 }),
});

/** 808005EF — Object auth. */
export const ObjectAuth = rsat.schema(0x808005ef, {
  unk0: rsat.i32(),
  flag: rsat.bool(),
  ref: rsat.nested(SensorClientRef),
  vec: rsat.nested(ObjectAuthVec),
});

/** 80800E27 — two u32s under ObjectSense. */
export const Hash80800E27 = rsat.schema(0x80800e27, {
  f0: rsat.u32(),
  f1: rsat.u32(),
});

/** 80800E41 — 8× kind 33 (no rsat codec). Count 0 never indexes. */
export const Hash80800E41 = rsat.schema(0x80800e41, {});

/** 808005F0 — Object sense. */
export const ObjectSense = rsat.schema(0x808005f0, {
  unk0: rsat.i32(),
  flag: rsat.bool(),
  unk2: rsat.i32(),
  pair: rsat.nested(Hash80800E27),
  vec: rsat.nested(ObjectAuthVec),
});

/** 8080065C — SafeZone auth. */
export const SafeZoneAuth = rsat.schema(0x8080065c, {
  ref: rsat.nested(SensorClientRef),
  unk: rsat.i32(),
});

/** 8080065D — SafeZone sense. */
export const SafeZoneSense = rsat.schema(0x8080065d, {
  unk0: rsat.i32(),
  unk1: rsat.i32(),
});

/** 8080061F — empty vec under ObjectFilter auth. */
export const ObjectFilterAuthVec = rsat.schema(0x8080061f, {
  count: rsat.u32({ size: 4 }),
});

/** 80800620 — ObjectFilter auth. */
export const ObjectFilterAuth = rsat.schema(0x80800620, {
  vec: rsat.nested(ObjectFilterAuthVec),
});

/** 80800E85 — 4× i32 under 8080154C. */
export const Hash80800E85 = rsat.schema(0x80800e85, {
  f0: rsat.i32(),
  f1: rsat.i32(),
  f2: rsat.i32(),
  f3: rsat.i32(),
});

/** 8080154C — optional filter nest under SquadAuth. */
export const Hash8080154C = rsat.schema(0x8080154c, {
  count: rsat.i32({ size: 3, bias: 0 }),
});

/** 80800E4C — maxLen table (8× i32) for SquadRoster elements. */
export const Hash80800E4C = rsat.schema(0x80800e4c, {
  slots: rsat.repeat(rsat.i32(), 8),
});

/** 80800E4D — 24 optional floats under SquadSense. */
export const Hash80800E4D = rsat.schema(0x80800e4d, {
  values: rsat.optionsArray(rsat.f32(), 24),
});

/**
 * 80800675 — Squad roster. TypeDef is count + 80800E4C maxLen table;
 * the wire we send is one 4-bit count then N biased i32 slots.
 */
export const SquadRoster = rsat.schema(0x80800675, {
  slots: rsat.array(rsat.i32(), { lengthBits: 4, max: 15 }),
});

/**
 * 8080067A — Squad auth. Dirty-0 Some writes only the roster; always-on
 * fields 9/10 emit memory 0 (wire 1).
 */
export const SquadAuth = rsat.schema(0x8080067a, {
  ref0: rsat.optional(rsat.nested(SensorClientRef)),
  ref1: rsat.optional(rsat.nested(SensorClientRef)),
  filter: rsat.optional(rsat.nested(Hash8080154C)),
  roster: rsat.optional(rsat.nested(SquadRoster)),
  unk4: rsat.optional(rsat.i32({ size: 31, bias: 0 })),
  unk5: rsat.optional(rsat.i32({ size: 31, bias: 0 })),
  unk6: rsat.optional(rsat.i32({ size: 31, bias: 0 })),
  unk7: rsat.optional(rsat.i32({ size: 6, bias: 1 })),
  unk8: rsat.optional(rsat.i32({ size: 5, bias: 1 })),
  unk9: rsat.i8({ size: 2, bias: 1 }),
  unk10: rsat.i8({ size: 3, bias: 1 }),
});

/** 80800677 — Squad sense. Field 8 is the AF0A8 copy gate (`valid`). */
export const SquadSense = rsat.schema(0x80800677, {
  unk0: rsat.optional(rsat.i32({ size: 31, bias: 0 })),
  unk1: rsat.optional(rsat.i32({ size: 31, bias: 0 })),
  unk2: rsat.optional(rsat.i32({ size: 31, bias: 0 })),
  unk3: rsat.optional(rsat.i32({ size: 6, bias: 0 })),
  unk4: rsat.optional(rsat.i32({ size: 6, bias: 0 })),
  flag5: rsat.bool(),
  flag6: rsat.bool(),
  flag7: rsat.bool(),
  valid: rsat.bool(),
  unk9: rsat.optional(rsat.f32()),
  roster: rsat.optional(rsat.nested(SquadRoster)),
  extras: rsat.optional(rsat.nested(Hash80800E4D)),
});

/** 80800E4F — 4 floats under 808006A3. */
export const Hash80800E4F = rsat.schema(0x80800e4f, {
  f0: rsat.f32(),
  f1: rsat.f32(),
  f2: rsat.f32(),
  f3: rsat.f32(),
});

/** 808006A3 — combatant nest under 80800E52. */
export const Hash808006A3 = rsat.schema(0x808006a3, {
  f0: rsat.u32(),
  f1: rsat.nested(Hash80800E4F),
});

/** 80800E52 — 4× 808006A3. */
export const Hash80800E52 = rsat.schema(0x80800e52, {
  slots: rsat.repeat(rsat.nested(Hash808006A3), 4),
});

/** 808006A6 — count + vec under ActorAuth 808006A7. */
export const Hash808006A6 = rsat.schema(0x808006a6, {
  count: rsat.i32({ size: 3, bias: 0 }),
});

/** 808006A7 — ActorAuth field 4. */
export const Hash808006A7 = rsat.schema(0x808006a7, {
  f0: rsat.i32({ size: 31, bias: 0 }),
  f1: rsat.u8({ size: 2 }),
  f2: rsat.nested(Hash8080154C),
  f3: rsat.nested(SensorClientRef),
  f4: rsat.i32({ bias: 1 }),
  f5: rsat.nested(Hash808006A6),
});

/** 808006A4 — combatant nest under 80800E53. */
export const Hash808006A4 = rsat.schema(0x808006a4, {
  f0: rsat.u32(),
  f1: rsat.nested(SensorClientRef),
  f2: rsat.u32(),
});

/** 80800E53 — 4× 808006A4. */
export const Hash80800E53 = rsat.schema(0x80800e53, {
  slots: rsat.repeat(rsat.nested(Hash808006A4), 4),
});

/** 808006A8 — count + vec under ActorAuth 808006A9. */
export const Hash808006A8 = rsat.schema(0x808006a8, {
  count: rsat.i32({ size: 3, bias: 0 }),
});

/** 808006A9 — ActorAuth field 5. */
export const Hash808006A9 = rsat.schema(0x808006a9, {
  f0: rsat.i32({ size: 31, bias: 0 }),
  f1: rsat.nested(Hash808006A8),
});

/**
 * 80800E51 — 32× kind-37 command-script atoms. Empty so a count-0 vec
 * never descends into the tagged union.
 */
export const Hash80800E51 = rsat.schema(0x80800e51, {});

/** 8080069F — script payload under 808006A1. */
export const Hash8080069F = rsat.schema(0x8080069f, {
  count: rsat.i32({ size: 6, bias: 0 }),
});

/** 808006A1 — ActorAuth field 6 (cookie / PC / script). */
export const Hash808006A1 = rsat.schema(0x808006a1, {
  cookie: rsat.i32({ size: 31, bias: 0 }),
  pc: rsat.i32({ size: 6, bias: 0 }),
  script: rsat.nested(Hash8080069F),
});

/** 80800E54 — 8× client-ref under 808006AA. */
export const Hash80800E54 = rsat.schema(0x80800e54, {
  slots: rsat.repeat(rsat.nested(SensorClientRef), 8),
});

/** 808006AA — count + vec under ActorAuth 808006AB. */
export const Hash808006AA = rsat.schema(0x808006aa, {
  count: rsat.i32({ size: 4, bias: 0 }),
});

/** 808006AB — ActorAuth field 7. */
export const Hash808006AB = rsat.schema(0x808006ab, {
  vec: rsat.nested(Hash808006AA),
  unk: rsat.i32({ size: 31, bias: 0 }),
});

/** 808006A2 — ActorSense field 3. */
export const Hash808006A2 = rsat.schema(0x808006a2, {
  f0: rsat.optional(rsat.i32({ size: 6, bias: 0 })),
  f1: rsat.optional(rsat.i32({ size: 31, bias: 0 })),
  f2: rsat.optional(rsat.i32({ size: 31, bias: 0 })),
  f3: rsat.bool(),
});

/** 808006AF — Actor auth. Kind-37 script trees are dirty-gated. */
export const ActorAuth = rsat.schema(0x808006af, {
  unk0: rsat.optional(rsat.i32({ size: 31, bias: 0 })),
  unk1: rsat.i8({ size: 2, bias: 1 }),
  unk2: rsat.i8({ size: 3, bias: 1 }),
  flag3: rsat.bool(),
  nest4: rsat.optional(rsat.nested(Hash808006A7)),
  nest5: rsat.optional(rsat.nested(Hash808006A9)),
  script: rsat.optional(rsat.nested(Hash808006A1)),
  nest7: rsat.optional(rsat.nested(Hash808006AB)),
});

/** 808006AE — Actor sense. */
export const ActorSense = rsat.schema(0x808006ae, {
  unk0: rsat.optional(rsat.i32({ size: 31, bias: 0 })),
  unk1: rsat.optional(rsat.f32()),
  unk2: rsat.optional(rsat.i32({ size: 31, bias: 0 })),
  nest3: rsat.optional(rsat.nested(Hash808006A2)),
  unk4: rsat.optional(rsat.i32({ size: 31, bias: 0 })),
  unk5: rsat.i8({ size: 2, bias: 1 }),
  unk6: rsat.optional(rsat.i32({ size: 31, bias: 0 })),
  flag7: rsat.bool(),
  flag8: rsat.bool(),
});

/** 80800E4A — 24 optional i8s under 8080066F. */
export const Hash80800E4A = rsat.schema(0x80800e4a, {
  values: rsat.optionsArray(rsat.i8({ size: 6, bias: 0 }), 24),
});

/** 8080066F — element under ObjectiveAuth 80800E4B. */
export const Hash8080066F = rsat.schema(0x8080066f, {
  f0: rsat.optional(rsat.i8({ size: 7, bias: 0 })),
  f1: rsat.u8({ size: 1 }),
  f2: rsat.optional(rsat.nested(Hash80800E4A)),
});

/** 80800E4B — 24× 8080066F under ObjectiveAuth. */
export const Hash80800E4B = rsat.schema(0x80800e4b, {
  slots: rsat.repeat(rsat.nested(Hash8080066F), 24),
});

/** 80800E49 — 24 optional i8s under ObjectiveSense. */
export const Hash80800E49 = rsat.schema(0x80800e49, {
  values: rsat.optionsArray(rsat.i8({ size: 7, bias: 0 }), 24),
});

/** 80800671 — Objective auth. */
export const ObjectiveAuth = rsat.schema(0x80800671, {
  table: rsat.optional(rsat.nested(Hash80800E4B)),
  unk1: rsat.optional(rsat.i32({ size: 31, bias: 0 })),
  unk2: rsat.optional(rsat.u32()),
});

/** 8080066B — Objective sense. */
export const ObjectiveSense = rsat.schema(0x8080066b, {
  table: rsat.optional(rsat.nested(Hash80800E49)),
  unk1: rsat.optional(rsat.i32({ size: 31, bias: 0 })),
});

/** 80802DDE — pair of u32s under SequenceAuth. */
export const Hash80802DDE = rsat.schema(0x80802dde, {
  f0: rsat.u32(),
  f1: rsat.u32(),
});

/** 8080371D — two 80802DDE under SequenceAuth. */
export const Hash8080371D = rsat.schema(0x8080371d, {
  a: rsat.nested(Hash80802DDE),
  b: rsat.nested(Hash80802DDE),
});

/**
 * 80802DE0 — Sequence auth. XWS labeled this type-15; Scoreboard is 80802DD6.
 */
export const SequenceAuth = rsat.schema(0x80802de0, {
  unk0: rsat.i32(),
  unk1: rsat.u8(),
  pair: rsat.nested(Hash8080371D),
  ref: rsat.nested(SensorClientRef),
});

/** 80803717 — 12× u64 maxLen table under CinematicAuth. */
export const Hash80803717 = rsat.schema(0x80803717, {
  slots: rsat.repeat(rsat.u64(), 12),
});

/** 80802DC7 — count + vec under CinematicAuth. */
export const Hash80802DC7 = rsat.schema(0x80802dc7, {
  count: rsat.u32({ size: 4 }),
});

/** 80802DC9 — Cinematic auth. */
export const CinematicAuth = rsat.schema(0x80802dc9, {
  unk0: rsat.i32(),
  unk1: rsat.i8({ size: 2, bias: 1 }),
  ref: rsat.nested(SensorClientRef),
  vec: rsat.nested(Hash80802DC7),
  unk4: rsat.u32(),
});

/** 80802DCD — scoreboard vec-0 element; TypeDef missing from both dumps. */
export const Hash80802DCD = rsat.schema(0x80802dcd, {});

/** 80803719 — 12× 80802DCD maxLen table. */
export const Hash80803719 = rsat.schema(0x80803719, {
  slots: rsat.repeat(rsat.nested(Hash80802DCD), 12),
});

/** 80802DCE — scoreboard vec-1 element. */
export const Hash80802DCE = rsat.schema(0x80802dce, {
  f0: rsat.i32(),
  f1: rsat.i32(),
});

/** 8080371A — 12× 80802DCE. */
export const Hash8080371A = rsat.schema(0x8080371a, {
  slots: rsat.repeat(rsat.nested(Hash80802DCE), 12),
});

/** 80802DD1 — scoreboard vec-2 element; TypeDef missing. */
export const Hash80802DD1 = rsat.schema(0x80802dd1, {});

/** 8080371B — 8× 80802DD1. */
export const Hash8080371B = rsat.schema(0x8080371b, {
  slots: rsat.repeat(rsat.nested(Hash80802DD1), 8),
});

/** 80803718 — 64 optional floats under 80802DCF. */
export const Hash80803718 = rsat.schema(0x80803718, {
  values: rsat.optionsArray(rsat.f32(), 64),
});

/** 80802DCF — scoreboard vec-3 element. */
export const Hash80802DCF = rsat.schema(0x80802dcf, {
  count: rsat.i32({ size: 7, bias: 0 }),
});

/** 8080371C — 25× 80802DCF. */
export const Hash8080371C = rsat.schema(0x8080371c, {
  slots: rsat.repeat(rsat.nested(Hash80802DCF), 25),
});

/** 80800E56 — two i32s under ScoreboardAuth vec-4. */
export const Hash80800E56 = rsat.schema(0x80800e56, {
  f0: rsat.i32(),
  f1: rsat.i32(),
});

/** 80802DD2 / 80802DD3 / 80802DD4 — Scoreboard length prefixes (4 bits). */
export const ScoreboardVec4 = rsat.schema(0x80802dd2, {
  count: rsat.u32({ size: 4 }),
});
export const ScoreboardVec4b = rsat.schema(0x80802dd3, {
  count: rsat.u32({ size: 4 }),
});
export const ScoreboardVec4c = rsat.schema(0x80802dd4, {
  count: rsat.u32({ size: 4 }),
});
/** 80802DD5 — Scoreboard length prefix (5 bits). */
export const ScoreboardVec5 = rsat.schema(0x80802dd5, {
  count: rsat.u32({ size: 5 }),
});
/** 8080157D — Scoreboard length prefix (2 bits). */
export const ScoreboardVec2 = rsat.schema(0x8080157d, {
  count: rsat.u32({ size: 2 }),
});

/**
 * 80802DD6 — Scoreboard auth. Empty body is the five count prefixes
 * (4+4+4+5+2 = 19 bits). Element maxLen tables are the Hash80803719..C
 * schemas above.
 */
export const ScoreboardAuth = rsat.schema(0x80802dd6, {
  v0: rsat.nested(ScoreboardVec4),
  v1: rsat.nested(ScoreboardVec4b),
  v2: rsat.nested(ScoreboardVec4c),
  v3: rsat.nested(ScoreboardVec5),
  v4: rsat.nested(ScoreboardVec2),
});

/** 80800623 — Health auth. */
export const HealthAuth = rsat.schema(0x80800623, {
  ref: rsat.nested(SensorClientRef),
  unk1: rsat.f32(),
  unk2: rsat.f32(),
  unk3: rsat.i32(),
});

/** 80800624 — Health sense. */
export const HealthSense = rsat.schema(0x80800624, {
  unk0: rsat.f32(),
  unk1: rsat.f32(),
  unk2: rsat.i32(),
});

/**
 * 80800634 — Unknown24 auth. Venus 517641F1 host class 8080063D
 * (e.g. 80B08892 +0xC14, type index 56). Field 3 is kind 33 (no codec).
 */
export const Unknown24Auth = rsat.schema(0x80800634, {
  flag0: rsat.bool(),
  unk1: rsat.i32(),
  ref: rsat.nested(SensorClientRef),
  // f3: kind 33
});

/** 80800635 — Unknown24 sense. */
export const Unknown24Sense = rsat.schema(0x80800635, {
  unk0: rsat.i32(),
  flag1: rsat.bool(),
});

/** 80800651 — PlayerMonitor auth. */
export const PlayerMonitorAuth = rsat.schema(0x80800651, {
  ref: rsat.nested(SensorClientRef),
  unk: rsat.i32(),
});

/** 80800652 — PlayerMonitor sense. */
export const PlayerMonitorSense = rsat.schema(0x80800652, {
  flag0: rsat.bool(),
  flag1: rsat.bool(),
  unk2: rsat.i32(),
  unk3: rsat.i32(),
});

/** 80800659 — PlayerTrigger auth. */
export const PlayerTriggerAuth = rsat.schema(0x80800659, {
  flag: rsat.bool(),
  unk: rsat.i32(),
});

/** 80802DAE — PlayerObjective slot (kind 13 is 96 raw bits). */
export const Hash80802DAE = rsat.schema(0x80802dae, {
  unk0: rsat.i8({ size: 4, bias: 1 }),
  ref: rsat.nested(SensorClientRef),
  kind13: rsat.bytes(12),
  unk3: rsat.i32(),
  unk4: rsat.u32(),
});

/** 80803716 — 10× 80802DAE under PlayerObjectiveAuth. */
export const Hash80803716 = rsat.schema(0x80803716, {
  slots: rsat.repeat(rsat.nested(Hash80802DAE), 10),
});

/**
 * 80802DB0 — PlayerObjective auth. Kind 13 in each 80802DAE slot is 96
 * raw bits; the live encoder still writes this by hand so wire 0 on the
 * biased i32s is preserved.
 */
export const PlayerObjectiveAuth = rsat.schema(0x80802db0, {
  unk0: rsat.i8({ size: 3, bias: 1 }),
  ref1: rsat.nested(SensorClientRef),
  flag2: rsat.bool(),
  options: rsat.nested(ActivityOptions),
  unk4: rsat.i8({ size: 4, bias: 1 }),
  unk5: rsat.i32(),
  unk6: rsat.i32(),
  ref7: rsat.nested(SensorClientRef),
  slots: rsat.nested(Hash80803716),
  unk9: rsat.i32(),
  unk10: rsat.i32(),
});

/** 80802DE5 — Loot auth. */
export const LootAuth = rsat.schema(0x80802de5, {
  flag: rsat.bool(),
  ref: rsat.nested(SensorClientRef),
  unk: rsat.i32(),
});
