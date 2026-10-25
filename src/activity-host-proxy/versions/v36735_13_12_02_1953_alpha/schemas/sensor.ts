import type {
  CommandScriptAtom,
  CommandScriptCommand,
  CommandScriptEndCondition,
} from "@blamnetwork/bullshcript/destiny1/common";
import { type BitReader, type RsatField, rsat } from "@blamnetwork/rsat";
import type { MessageSchemas } from "./messages";

export function defineSensorSchemas(deps: {
  WorldHandles: MessageSchemas["WorldHandles"];
}) {
  const { WorldHandles } = deps;

  // Kind-11 real quantized to `bits` steps over [min, max]: 0 = min,
  // 2^bits-1 = max, otherwise floor((v - min) / step) + 1 with
  // step = (max - min) / (2^bits - 2).
  function f32q(min: number, max: number, bits: number): RsatField<number> {
    const steps = 1 << bits;
    const step = (max - min) / (steps - 2);
    return {
      encode(bw, value) {
        let q: number;
        if (value <= min) {
          q = 0;
        } else if (value >= max) {
          q = steps - 1;
        } else {
          q = Math.min(
            Math.max(Math.floor((value - min) / step) + 1, 1),
            steps - 2
          );
        }
        bw.write(q, bits);
      },
      decode(br) {
        const q = br.readNumber(bits);
        if (q === 0) {
          return min;
        }
        return q === steps - 1 ? max : min + (q - 1) * step;
      },
    };
  }

  // 8080046B — bundle / type / local index.
  const SensorClientRef = rsat.schema(0x8080046b, {
    bundle: rsat.u32(),
    typeId: rsat.i8({ size: 6, bias: 1 }),
    typeIndex: rsat.i16({ bias: 0x8000 }),
  });

  // 80804520 — nested under Lifetime-adjacent options, Timer, HardWipeGlobals.
  // The Timer client (sub_835BFE70) reads it as a clock:
  // t = round(rate * (tick - epoch)); elapsed = running ?
  // clamp(elapsedBase + t, min, max) : elapsedBase, and remaining counts down
  // from remainingBase. Ticks, at 30 per second.
  const ActivityOptions = rsat.schema(0x80804520, {
    running: rsat.bool(),
    min: rsat.i32(),
    max: rsat.i32(),
    elapsedBase: rsat.i32(),
    remainingBase: rsat.i32(),
    epoch: rsat.i32(),
    rate: rsat.f32(),
  });

  // 8080052A nested under Player auth and Fireteam: the player's ACTIVITY
  // FLAGS, as a 4-bit count followed by that many 32-bit keys (the 80800E3F
  // element, eight at most).
  //
  // This is the only thing in the build that grants a player an activity flag.
  // The ObjectFilter predicate 80800611 tests it with plain 32-bit equality
  // against the candidate player's entity (sub_835BEAD8), so a script's
  // `_activity_flag:activate()` has to end up here or the filter it gates can
  // never pass. The keys are FNV-1 name hashes; the client clears a slot to
  // 0x811C9DC5, the hash of the empty string, so that value is reserved.
  const PlayerSenseNested = rsat.schema(0x8080052a, {
    flags: rsat.array(rsat.u32(), { lengthBits: 4, max: 8 }),
  });

  // 8080052B — Player sense (bound; we emit has_sense=0 so this is unused).
  const PlayerSense = rsat.schema(0x8080052b, {
    unk0: rsat.i32(),
    nested: rsat.nested(PlayerSenseNested),
    flag2: rsat.bool(),
    unk3: rsat.f32(),
    unk4: rsat.u32(),
    flag5: rsat.bool(),
    flag6: rsat.bool(),
  });

  // 8080052C — Player auth. Field 0 is the spawn-gate identity key.
  const PlayerAuth = rsat.schema(0x8080052c, {
    key: rsat.u64(),
    unk1: rsat.i8({ size: 6, bias: 3 }),
    sense: rsat.nested(PlayerSense),
    flag: rsat.bool(),
  });

  // 8080052F — Lifetime. Field 0 is the spawn-ready state (want 2).
  //
  // The tail is a list of activity-option overrides, not world handles: the
  // client (sub_836311D8) upserts each entry into its activity-option table by
  // hash, a score_to_win-style override. Its record is {u32 hash, pad, +16
  // typed value}, but the wire class here (reused from WorldOptions.handles) is
  // proven only as a bare u32-hash array, and no verb in this build populates a
  // non-empty entry, so the typed value's bit layout is unimplemented.
  const LifetimeAuth = rsat.schema(0x8080052f, {
    state: rsat.i8({ size: 3, bias: 1 }),
    flag1: rsat.bool(),
    phaseIndex: rsat.i32(),
    phaseHash: rsat.u32(),
    field4: rsat.i32(),
    optionOverrides: rsat.nested(WorldHandles),
  });

  // 808005AB — HardWipeGlobals.
  const HardWipeGlobalsAuth = rsat.schema(0x808005ab, {
    options: rsat.nested(ActivityOptions),
  });

  // 80800530 — Timer. Auth only (no build-sense handler). `progressBar` puts a
  // bar on screen (sub_82A97698 reads this bool from sensor slot type 17);
  // `barOffsetSeconds` is subtracted from the bar's denominator, 0 for a plain
  // bar.
  const TimerAuth = rsat.schema(0x80800530, {
    options: rsat.nested(ActivityOptions),
    progressBar: rsat.bool(),
    barOffsetSeconds: rsat.i32(),
  });

  // 80800531 — Fireteam.
  const FireteamAuth = rsat.schema(0x80800531, {
    key: rsat.u64(),
    flag: rsat.bool(),
    nested: rsat.nested(PlayerSenseNested),
    unk: rsat.i32(),
  });

  // 8080053D — empty vec under Object auth.
  const ObjectAuthVec = rsat.schema(0x8080053d, {
    count: rsat.u32({ size: 4 }),
  });

  // 80802D88 — the device component's payload under Object auth. Its own id is
  // also the tag the kind-33 element carries; there is no separate class
  // handle. Each value applies only when its stamp beats the stored one;
  // position is clamped to [0, 1], 0 closed and 1 open, and the client drives
  // the travel itself at the blueprint's rate - no Sequence or animation row is
  // needed.
  const ObjectDeviceComponent = rsat.schema(0x80802d88, {
    powerStamp: rsat.i32(),
    power: rsat.f32(),
    lockStamp: rsat.i32(),
    lock: rsat.f32(),
    positionStamp: rsat.i32(),
    position: rsat.f32(),
  });

  // 80802DA2 — the mission-interactable component's payload under Object auth;
  // like every kind-33 payload its own id is the element's tag. When `mode`
  // decodes 0 the whole component is ignored ("keep"); otherwise the client
  // (sub_8381C478) stores m_enabled = (decoded mode 2) and the filter ref, and
  // logs "activities:mission_interactable: interactable '%s' set m_enabled to
  // %s". The use gate answers m_enabled XOR "this player passes the
  // ObjectFilter", so m_enabled false plus a filter means "usable only by
  // players the filter admits" (set_enabled_player_filter). An unset ref makes
  // the answer m_enabled alone.
  const ObjectInteractableComponent = rsat.schema(0x80802da2, {
    mode: rsat.i8({ size: 2, bias: 1 }),
    filter: rsat.nested(SensorClientRef),
    // The trailing stamp/bool "used" latch: the client sets `flag` when `unk2`
    // beats the stored stamp. Re-arming a used single-use interactable is
    // sending `flag: false` with a higher `unk2`.
    unk2: rsat.i32(),
    flag: rsat.bool(),
  });

  // 80802D89 - device sense: the client's own copy of ObjectDeviceComponent,
  // field for field (24 bytes: i32/f32 x3). Rides first in the ObjectSense vec
  // of every Object with a device (warsat, its covers).
  const ObjectDeviceSense = rsat.schema(0x80802d89, {
    powerStamp: rsat.i32(),
    power: rsat.f32(),
    lockStamp: rsat.i32(),
    lock: rsat.f32(),
    positionStamp: rsat.i32(),
    position: rsat.f32(),
  });

  // 80802DA3 - mission-interactable sense (8 bytes: bool @0, i32 @4). The
  // client's used latch and its stamp: it sets `used` when a player completes
  // the interaction (sub_8381BD38) and merges this copy back in when its stamp
  // beats the stored one. `used` with a stamp at or above the one we last sent
  // is a use since our last clear() - what get_active reads.
  const ObjectInteractableSense = rsat.schema(0x80802da3, {
    used: rsat.bool(),
    usedStamp: rsat.i32(),
  });

  // 80802D98 - sense half of an Object component pair whose auth is 80802D97
  // (one 2-bit mode): 2-bit bias-1 mode, i32. Declared so an ObjectSense
  // carrying it still decodes.
  const Hash80802D98 = rsat.schema(0x80802d98, {
    mode: rsat.i8({ size: 2, bias: 1 }),
    unk1: rsat.i32(),
  });

  // 80802E4F — the capturable component's payload under Object auth.
  // 151 bits: icon (always applied), a lock stamp/locked pair (applied
  // when lockStamp beats the stored one), a reset stamp (applied when
  // greater; clears the client's owner) and the ObjectFilter that gates who
  // counts as "inside" the zone. Progress/owner are simulated client-side and
  // arrive on ObjectCapturableSense - this is auth only.
  const ObjectCapturableComponent = rsat.schema(0x80802e4f, {
    icon: rsat.i32(),
    lockStamp: rsat.i32(),
    locked: rsat.bool(),
    resetStamp: rsat.i32(),
    filter: rsat.nested(SensorClientRef),
  });

  // 80802E50 — capturable sense: the client's own capture-zone simulation.
  // `owner` is the engine faction holding the zone (-1/0xFF none); `locked`/
  // `lockStamp`/`resetStamp` echo the auth fields back, which is how the host
  // tells a stale report (from before its last reset()) apart from a fresh
  // one; `progressTenths` is 4 bits of progress in tenths (0..10), present
  // only while the client has a value to report.
  const ObjectCapturableSense = rsat.schema(0x80802e50, {
    owner: rsat.i32(),
    locked: rsat.bool(),
    lockStamp: rsat.i32(),
    resetStamp: rsat.i32(),
    // Bias 0, not the signed default of 8: the record declares this field
    // optional, 4 bits, bias 0. With 8 a fresh zone's raw 0 read back as -8,
    // i.e. progress -0.8.
    progressTenths: rsat.optional(rsat.i8({ size: 4, bias: 0 })),
  });

  // 8080161F — the ObjectFaction component's payload under Object auth.
  // 64 bits: the engine faction (-3..31) an Object is
  // targetable as, and a stamp applied when greater than the stored one.
  const ObjectFactionComponent = rsat.schema(0x8080161f, {
    faction: rsat.i32(),
    stamp: rsat.i32(),
  });

  // 80801620 — ObjectFaction sense: the client's currently reported faction.
  const ObjectFactionSense = rsat.schema(0x80801620, {
    faction: rsat.i32(),
  });

  // 80802D9D — the ObjectTimer component's payload under Object auth.
  // 195 bits: active, the same ActivityOptions clock TimerAuth carries,
  // and a show-on-HUD bool nothing in this build's script corpus sets. No
  // sense - the client never reports a countdown's own progress back.
  const ObjectTimerComponent = rsat.schema(0x80802d9d, {
    active: rsat.bool(),
    options: rsat.nested(ActivityOptions),
    showOnHud: rsat.bool(),
  });

  // 808005EF — Object auth (receive: sub_835C15F0). The client branches on the
  // row definition's "networked" flag:
  //  - networked: every live sobject whose stored generation differs from
  //    `generation` (auth field 0) is destroyed, logging "activities:sensors:
  //    object:client: deleting '%s' because its generation is out of date".
  //    Nothing there reads `present`.
  //  - non-networked: `present` (auth field 1) IS the existence gate. True with
  //    no object creates it ("creating non-networked '%s' due to received auth
  //    state"); false with an object destroys it ("deleting non-networked '%s'
  //    due to received auth state").
  // That is `create()` / `delete_object()` on the wire. `set_faction` is
  // another kind-33 component class in the vec (ObjectFactionComponent), whose
  // own schema id doubles as its wire tag.
  const ObjectAuth = rsat.schema(0x808005ef, {
    generation: rsat.i32(),
    present: rsat.bool(),
    ref: rsat.nested(SensorClientRef),
    vec: rsat.nested(ObjectAuthVec),
  });

  // 80800E27 — two u32s under ObjectSense.
  const Hash80800E27 = rsat.schema(0x80800e27, {
    f0: rsat.u32(),
    f1: rsat.u32(),
  });

  // 80800E41 — 8× kind 33 (no rsat codec). Count 0 never indexes.
  const Hash80800E41 = rsat.schema(0x80800e41, {});

  // 808005F0 — Object sense. `alive` is field 1: the client's sense publisher
  // (sub_835C0AE8) sets it from the same "this object is live, operate on it"
  // predicate that gates the object's operations, and to 0 when the row has no
  // placed sobject. It is the only object-state boolean the guest publishes, so
  // it is what `is_alive()` reads. `vec`'s elements (capturable/faction
  // component sense) are kind-33, like the auth vec's, and are decoded
  // separately by sensor-sense.ts.
  const ObjectSense = rsat.schema(0x808005f0, {
    unk0: rsat.i32(),
    alive: rsat.bool(),
    unk2: rsat.i32(),
    pair: rsat.nested(Hash80800E27),
    vec: rsat.nested(ObjectAuthVec),
  });

  // 8080065C — SafeZone auth.
  const SafeZoneAuth = rsat.schema(0x8080065c, {
    ref: rsat.nested(SensorClientRef),
    unk: rsat.i32(),
  });

  // 8080065D — SafeZone sense (published by sub_835B8078). The client walks the
  // occupants of the row's binding (TriggerVolume 57 / Object 4 trigger volume,
  // or the whole filter result for Location 54), counts the ones that pass the
  // ObjectFilter named by SafeZoneAuth.ref and publishes 8 bytes: `inside` is
  // that count and `cookie` is SafeZoneAuth.unk echoed back.
  const SafeZoneSense = rsat.schema(0x8080065d, {
    inside: rsat.i32(),
    cookie: rsat.i32(),
  });

  // 8080061F — ObjectFilter auth's predicate vec: a 4-bit count then that many
  // kind-33 elements of stride 0x30, each dispatched on its class handle
  // (sub_835BDB20).
  const ObjectFilterAuthVec = rsat.schema(0x8080061f, {
    count: rsat.u32({ size: 4 }),
  });

  // 80800620 — ObjectFilter auth.
  const ObjectFilterAuth = rsat.schema(0x80800620, {
    vec: rsat.nested(ObjectFilterAuthVec),
  });

  // ObjectFilter predicate classes (schema ids 80800610..8080061C, all derived
  // from the abstract 8080060F). Every one starts with the same 2-bit mode:
  // decoded 1 removes the matches from the running result list, anything else
  // adds them (sub_8369B7C0). Only the four the host can author are declared.
  const predicateMode = () => rsat.i8({ size: 2, bias: 1 });

  // 80800611 — players carrying an activity flag (sub_8369C318): every Player
  // (type 12) slot whose activity-flag list holds the u32 is kept. That list is
  // PlayerAuth (8080052C) field 2's nested 8080052A { count 4 bits, up to 8 u32
  // }.
  const ObjectFilterPlayersWithActivityFlag = rsat.schema(0x80800611, {
    mode: predicateMode(),
    flagNameHash: rsat.u32(),
  });

  // 80800614 — players on a team (sub_8369C470): the Player (type 12) slots
  // whose faction (PlayerAuth field 1, 16 + team) equals 16 + this value are
  // kept, so the wire field is the plain team index `t`, not 16 + t.
  const ObjectFilterPlayersOnTeam = rsat.schema(0x80800614, {
    mode: predicateMode(),
    teamIndex: rsat.i32(),
  });

  // 80800615 — the single object a slot ref resolves to (sub_8369BD38): a
  // switch over ref type 1 Squad / 2 Actor / 4 Object / 12 Player, the same
  // generic resolver HealthAuth.ref uses.
  const ObjectFilterSlotObject = rsat.schema(0x80800615, {
    mode: predicateMode(),
    ref: rsat.nested(SensorClientRef),
  });

  // 80800616 — every member of a Squad row (sub_8369BD98): the Squad form of
  // the one above, asserting the ref's type is 1 (Squad) and iterating.
  const ObjectFilterSquadMembers = rsat.schema(0x80800616, {
    mode: predicateMode(),
    ref: rsat.nested(SensorClientRef),
  });

  // 80800619 — combatants matched by name hash (sub_8369BF90). It walks every
  // object, maps it to a component and compares that component's name hash (the
  // hash the activity log lines turn into '%s') against this u32; the default
  // when the mapping fails is fnv1("") 0x811C9DC5.
  const ObjectFilterCombatantType = rsat.schema(0x80800619, {
    mode: predicateMode(),
    typeNameHash: rsat.u32(),
  });

  // 80800E85 — the maxLen table (4× i32, 32 bits, bias 0x80000000) behind
  // 8080154C's count-prefixed array. Kept for the type-table hash; the wire
  // array is encoded inline by Hash8080154C below, as SquadRoster/80800E4C do.
  const Hash80800E85 = rsat.schema(0x80800e85, {
    f0: rsat.i32(),
    f1: rsat.i32(),
    f2: rsat.i32(),
    f3: rsat.i32(),
  });

  // 8080154C — the ACTIVE TEMPERAMENT LIST: a 3-bit count then up to 4 FNV-1
  // name hashes (i32, 32 bits, bias 0x80000000). It hangs off SquadAuth field 2
  // and off ActorAuth's 808006A7 field 2, and both copies feed the same AI tag
  // set (the per-actor AI think pass, sub_83790C10, walks both into the tag set
  // it selects behaviours on). That pass skips a hash equal to 0x811C9DC5, the
  // FNV-1 basis, which is what fixes the hash function as FNV-1 of the name.
  const Hash8080154C = rsat.schema(0x8080154c, {
    tags: rsat.array(rsat.i32(), { lengthBits: 3, max: 4 }),
  });

  // 80800E4C — maxLen table (8× i32) for SquadRoster elements.
  const Hash80800E4C = rsat.schema(0x80800e4c, {
    slots: rsat.repeat(rsat.i32(), 8),
  });

  // 80800E4D — 24 optional 7-bit quantized reals under SquadSense.
  const Hash80800E4D = rsat.schema(0x80800e4d, {
    values: rsat.optionsArray(f32q(0, 2047.5, 7), 24),
  });

  // 80800675 — Squad roster. TypeDef is count + 80800E4C maxLen table; the wire
  // we send is one 4-bit count then N biased i32 slots.
  //
  // The count field is 4 bits (0..15 encodable), but the guest's maxLen TypeDef
  // (80800E4C) is only 8 elements, so the decoder (schema walker sub_836AE150)
  // bounds-asserts and KeBugChecks any roster longer than 8. Sending patrol3's
  // def count of 15 crashed at decode; the wire ceiling is 8.
  const SquadRoster = rsat.schema(0x80800675, {
    slots: rsat.array(rsat.i32(), { lengthBits: 4, max: 8 }),
  });

  // 8080067A — Squad auth. Dirty-0 Some writes only the roster; always-on
  // fields 9/10 emit memory 0 (wire 1).
  const SquadAuth = rsat.schema(0x8080067a, {
    ref0: rsat.optional(rsat.nested(SensorClientRef)),
    ref1: rsat.optional(rsat.nested(SensorClientRef)),
    // Field 2: the active temperament list, not a filter - see Hash8080154C.
    temperaments: rsat.optional(rsat.nested(Hash8080154C)),
    roster: rsat.optional(rsat.nested(SquadRoster)),
    unk4: rsat.optional(rsat.i32({ size: 31, bias: 0 })),
    unk5: rsat.optional(rsat.i32({ size: 31, bias: 0 })),
    unk6: rsat.optional(rsat.i32({ size: 31, bias: 0 })),
    unk7: rsat.optional(rsat.i32({ size: 6, bias: 1 })),
    unk8: rsat.optional(rsat.i32({ size: 5, bias: 1 })),
    unk9: rsat.i8({ size: 2, bias: 1 }),
    unk10: rsat.i8({ size: 3, bias: 1 }),
  });

  // 80800677 — Squad sense (client -> host). Field 8 is the copy gate
  // (`valid`); unk4 = live member count (sub_835AC098); roster = per-cell
  // failed-placement tally; unk9 / extras are 7-bit quantized reals.
  const SquadSense = rsat.schema(0x80800677, {
    unk0: rsat.optional(rsat.i32({ size: 31, bias: 0 })),
    unk1: rsat.optional(rsat.i32({ size: 31, bias: 0 })),
    unk2: rsat.optional(rsat.i32({ size: 31, bias: 0 })),
    unk3: rsat.optional(rsat.i32({ size: 6, bias: 0 })),
    unk4: rsat.optional(rsat.i32({ size: 6, bias: 0 })),
    flag5: rsat.bool(),
    flag6: rsat.bool(),
    flag7: rsat.bool(),
    valid: rsat.bool(),
    unk9: rsat.optional(f32q(0, 2047.5, 7)),
    roster: rsat.optional(rsat.nested(SquadRoster)),
    extras: rsat.optional(rsat.nested(Hash80800E4D)),
  });

  // 80800E4F — 4 floats under 808006A3.
  const Hash80800E4F = rsat.schema(0x80800e4f, {
    f0: rsat.f32(),
    f1: rsat.f32(),
    f2: rsat.f32(),
    f3: rsat.f32(),
  });

  // 808006A3 — combatant nest under 80800E52.
  const Hash808006A3 = rsat.schema(0x808006a3, {
    f0: rsat.u32(),
    f1: rsat.nested(Hash80800E4F),
  });

  // 80800E52 — 4× 808006A3.
  const Hash80800E52 = rsat.schema(0x80800e52, {
    slots: rsat.repeat(rsat.nested(Hash808006A3), 4),
  });

  // 808006A6 — ActorAuth field 4's f5: up to 4 channel-scalar writes, each a
  // channel id + 4 floats (Hash808006A3 above). The client (sub_835B3F40) asks
  // each of the object's components to resolve the id and applies the float
  // vector to the one that answers; an id nothing matches is a rate-limited
  // log, "activities:client:combatant: '%s' attempted to modify an unknown
  // channel", and no state change. The id is written as FNV-1 of the channel
  // name, an inference from the family (every other name on this wire,
  // temperaments included, is FNV-1) rather than a measured value; the miss is
  // that log line, not a wrong write.
  const Hash808006A6 = rsat.schema(0x808006a6, {
    channels: rsat.array(rsat.nested(Hash808006A3), { lengthBits: 3, max: 4 }),
  });

  // 808006A7 — ActorAuth field 4. `generation` is the gate: the client
  // (sub_835B7560) only applies `temperaments` and walks `channels` when it
  // differs from the value stored on the combatant, so it has to change on
  // every write.
  const Hash808006A7 = rsat.schema(0x808006a7, {
    generation: rsat.i32({ size: 31, bias: 0 }),
    f1: rsat.u8({ size: 2 }),
    temperaments: rsat.nested(Hash8080154C),
    f3: rsat.nested(SensorClientRef),
    f4: rsat.i32({ bias: 1 }),
    channels: rsat.nested(Hash808006A6),
  });

  // 808006A4 — combatant nest under 80800E53.
  const Hash808006A4 = rsat.schema(0x808006a4, {
    f0: rsat.u32(),
    f1: rsat.nested(SensorClientRef),
    f2: rsat.u32(),
  });

  // 80800E53 — 4× 808006A4.
  const Hash80800E53 = rsat.schema(0x80800e53, {
    slots: rsat.repeat(rsat.nested(Hash808006A4), 4),
  });

  // 808006A8 — count + vec under ActorAuth 808006A9.
  const Hash808006A8 = rsat.schema(0x808006a8, {
    count: rsat.i32({ size: 3, bias: 0 }),
  });

  // 808006A9 — ActorAuth field 5.
  const Hash808006A9 = rsat.schema(0x808006a9, {
    f0: rsat.i32({ size: 31, bias: 0 }),
    f1: rsat.nested(Hash808006A8),
  });

  // 80800E51 element: one command-script atom, a tagged union (sub_836A8C30).
  // Command kind (4 b, bias 1), end condition kind (2 b, bias 1), the
  // command's fields in offset order, then the condition's - only kind 2 has
  // any, seconds quantized to 11 b over 0..600. Point refs are the same
  // 8080046B the rest of the wire uses.
  const atomPoint = rsat.nested(SensorClientRef);
  const atomF32 = rsat.f32();
  const atomSeconds = f32q(0, 600, 11);
  const atomSlot = rsat.i8({ size: 3, bias: 1 });
  const atomIndex = rsat.i8({ bias: 0x80 });
  const atomTemperament = rsat.i32();
  const UNSET_ATOM_POINT = { bundle: 0x811c9dc5, typeId: -1, typeIndex: -1 };

  const CommandScriptAtomCodec: RsatField<CommandScriptAtom> = {
    encode(bw, atom) {
      bw.write(atom.kind + 1, 4);
      bw.write(atom.end.kind + 1, 2);
      switch (atom.kind) {
        case 0:
        case 8:
          atomPoint.encode(bw, atom.point);
          bw.write(atom.index, 8);
          break;
        case 1:
          bw.write(atom.name >>> 0, 32);
          break;
        case 2:
          atomF32.encode(bw, atom.seconds);
          break;
        case 3:
          atomPoint.encode(bw, atom.point);
          bw.write(atom.index, 8);
          bw.writeBit(atom.stop);
          break;
        case 4:
          break;
        case 5:
          bw.write((atom.which + 1) & 3, 2);
          bw.writeBit(atom.value !== 0);
          break;
        case 6:
          atomTemperament.encode(bw, atom.temperament);
          bw.writeBit(atom.add);
          break;
        case 7:
          bw.write(atom.channel >>> 0, 32);
          for (let i = 0; i < 4; i++) {
            atomF32.encode(bw, atom.values[i] ?? 0);
          }
          break;
        case 9:
          bw.write(atom.name >>> 0, 32);
          bw.write(atom.argument >>> 0, 32);
          atomPoint.encode(bw, atom.point ?? UNSET_ATOM_POINT);
          atomSlot.encode(bw, atom.slot);
          atomIndex.encode(bw, atom.index);
          break;
        default:
          break;
      }
      if (atom.end.kind === 2) {
        atomSeconds.encode(bw, atom.end.seconds);
      }
    },
    decode(br) {
      const kind = br.readNumber(4) - 1;
      const endKind = br.readNumber(2) - 1;
      const command = decodeAtomCommand(br, kind);
      const end: CommandScriptEndCondition =
        endKind === 2
          ? { kind: 2, seconds: atomSeconds.decode(br) }
          : { kind: endKind === 1 ? 1 : 0 };
      return { ...command, end };
    },
  };

  function decodeAtomCommand(
    br: BitReader,
    kind: number
  ): CommandScriptCommand {
    switch (kind) {
      case 0:
      case 8:
        return { kind, point: atomPoint.decode(br), index: br.readNumber(8) };
      case 1:
        return { kind, name: br.readNumber(32) >>> 0 };
      case 2:
        return { kind, seconds: atomF32.decode(br) };
      case 3:
        return {
          kind,
          point: atomPoint.decode(br),
          index: br.readNumber(8),
          stop: br.readBit() === 1,
        };
      case 5:
        return { kind, which: br.readNumber(2) - 1, value: br.readBit() };
      case 6:
        return {
          kind,
          temperament: atomTemperament.decode(br),
          add: br.readBit() === 1,
        };
      case 7:
        return {
          kind,
          channel: br.readNumber(32) >>> 0,
          values: [
            atomF32.decode(br),
            atomF32.decode(br),
            atomF32.decode(br),
            atomF32.decode(br),
          ],
        };
      case 9: {
        const name = br.readNumber(32) >>> 0;
        const argument = br.readNumber(32) >>> 0;
        const point = atomPoint.decode(br);
        return {
          kind,
          name,
          argument,
          ...(point.typeId === -1 ? {} : { point }),
          slot: atomSlot.decode(br),
          index: atomIndex.decode(br),
        };
      }
      default:
        return { kind: 4 };
    }
  }

  // The client copies at most 32 atoms (count + 32 x 64 B).
  const MAX_COMMAND_SCRIPT_ATOMS = 32;

  // 8080069F — script payload under 808006A1: a 6-bit count, then that many
  // optional 80800E51 atoms (each behind its own dirty bit).
  const Hash8080069F = rsat.schema(0x8080069f, {
    atoms: rsat.array(rsat.optional(CommandScriptAtomCodec), {
      lengthBits: 6,
      max: MAX_COMMAND_SCRIPT_ATOMS,
    }),
  });

  // 808006A1 — ActorAuth field 6 (cookie / PC / script). Guest log:
  // `receive_auth_state: starting script cookie #%d at PC #%d`.
  const Hash808006A1 = rsat.schema(0x808006a1, {
    cookie: rsat.i32({ size: 31, bias: 0 }),
    pc: rsat.i32({ size: 6, bias: 0 }),
    script: rsat.nested(Hash8080069F),
  });

  // 80800E54 — 8× client-ref under 808006AA.
  const Hash80800E54 = rsat.schema(0x80800e54, {
    slots: rsat.repeat(rsat.nested(SensorClientRef), 8),
  });

  // 808006AA — the count prefix of ActorAuth field 7's drop queue (paired
  // with the maxLen table 80800E54). The actual wire array is encoded inline
  // by Hash808006AB.refs below (same pattern as SquadRoster/80800E4C) - this
  // schema is kept for the type-table hash, not referenced on the wire.
  const Hash808006AA = rsat.schema(0x808006aa, {
    count: rsat.i32({ size: 4, bias: 0 }),
  });

  // 808006AB — ActorAuth field 7: the dropship delivery queue (up to 8
  // SensorClientRef) and the drop id that kicks it off. The client asserts the
  // queue is <= 8 and logs "Starting drop #%d including '%s'." per ref
  // (sub_835B5B10); it fires the drop when this id differs from ActorSense
  // field 4.
  const Hash808006AB = rsat.schema(0x808006ab, {
    refs: rsat.array(rsat.nested(SensorClientRef), { lengthBits: 4, max: 8 }),
    dropId: rsat.i32({ size: 31, bias: 0 }),
  });

  // 808006A2 — ActorSense field 3.
  const Hash808006A2 = rsat.schema(0x808006a2, {
    f0: rsat.optional(rsat.i32({ size: 6, bias: 0 })),
    f1: rsat.optional(rsat.i32({ size: 31, bias: 0 })),
    f2: rsat.optional(rsat.i32({ size: 31, bias: 0 })),
    f3: rsat.bool(),
  });

  // 808006AF — Actor auth. Kind-37 script trees are dirty-gated.
  const ActorAuth = rsat.schema(0x808006af, {
    unk0: rsat.optional(rsat.i32({ size: 31, bias: 0 })),
    unk1: rsat.i8({ size: 2, bias: 1 }),
    unk2: rsat.i8({ size: 3, bias: 1 }),
    flag3: rsat.bool(),
    nest4: rsat.optional(rsat.nested(Hash808006A7)),
    nest5: rsat.optional(rsat.nested(Hash808006A9)),
    script: rsat.optional(rsat.nested(Hash808006A1)),
    nest7: rsat.optional(rsat.nested(Hash808006AB)),
  });

  // 808006AE — Actor sense.
  const ActorSense = rsat.schema(0x808006ae, {
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

  // 80800E4A — 24 optional i8s under 8080066F.
  const Hash80800E4A = rsat.schema(0x80800e4a, {
    values: rsat.optionsArray(rsat.i8({ size: 6, bias: 0 }), 24),
  });

  // 8080066F — element under ObjectiveSense 80800E4B.
  const Hash8080066F = rsat.schema(0x8080066f, {
    f0: rsat.optional(rsat.i8({ size: 7, bias: 0 })),
    f1: rsat.u8({ size: 1 }),
    f2: rsat.optional(rsat.nested(Hash80800E4A)),
  });

  // 80800E4B — 24× 8080066F under ObjectiveSense.
  const Hash80800E4B = rsat.schema(0x80800e4b, {
    slots: rsat.repeat(rsat.nested(Hash8080066F), 24),
  });

  // 80800E49 — 24 optional slot-state bytes under ObjectiveAuth.
  const Hash80800E49 = rsat.schema(0x80800e49, {
    values: rsat.optionsArray(rsat.i8({ size: 7, bias: 0 }), 24),
  });

  // 80800671 — Objective sense (client -> host): per slot the echoed state,
  // a flag and up to 24 kill counters.
  const ObjectiveSense = rsat.schema(0x80800671, {
    table: rsat.optional(rsat.nested(Hash80800E4B)),
    unk1: rsat.optional(rsat.i32({ size: 31, bias: 0 })),
    unk2: rsat.optional(rsat.u32()),
  });

  // 8080066B — Objective auth (host -> client): 24 host-owned slot-state
  // bytes; the client echoes them and resets a slot's counters on change.
  // Idle = table present with every slot absent (26 bits).
  const ObjectiveAuth = rsat.schema(0x8080066b, {
    table: rsat.optional(rsat.nested(Hash80800E49)),
    unk1: rsat.optional(rsat.i32({ size: 31, bias: 0 })),
  });

  // 80802DDE — pair of u32s under SequenceAuth.
  const Hash80802DDE = rsat.schema(0x80802dde, {
    f0: rsat.u32(),
    f1: rsat.u32(),
  });

  // 8080371D — two 80802DDE under SequenceAuth.
  const Hash8080371D = rsat.schema(0x8080371d, {
    a: rsat.nested(Hash80802DDE),
    b: rsat.nested(Hash80802DDE),
  });

  // 80802DE0 — Sequence auth (Scoreboard is 80802DD6).
  const SequenceAuth = rsat.schema(0x80802de0, {
    unk0: rsat.i32(),
    unk1: rsat.u8(),
    pair: rsat.nested(Hash8080371D),
    ref: rsat.nested(SensorClientRef),
  });

  // 80803717 — 12× u64 maxLen table under CinematicAuth.
  const Hash80803717 = rsat.schema(0x80803717, {
    slots: rsat.repeat(rsat.u64(), 12),
  });

  // 80802DC7 — count + vec under CinematicAuth.
  const Hash80802DC7 = rsat.schema(0x80802dc7, {
    count: rsat.u32({ size: 4 }),
  });

  // 80802DC9 — Cinematic auth.
  const CinematicAuth = rsat.schema(0x80802dc9, {
    unk0: rsat.i32(),
    unk1: rsat.i8({ size: 2, bias: 1 }),
    ref: rsat.nested(SensorClientRef),
    vec: rsat.nested(Hash80802DC7),
    unk4: rsat.u32(),
  });

  // 80802DFF — TeamPicker sense element: an 8-byte identifier (not the u64
  // identity kind used elsewhere - the client's own team-picker result keys
  // its rows by a raw byte identifier) and the chosen team, i32.
  const Hash80802DFF = rsat.schema(0x80802dff, {
    identifier: rsat.bytes(8),
    team: rsat.i32(),
  });

  // 80802E01 — TeamPicker sense (type 14, sense-only). u4 count (<=12) x
  // 80802DFF. INFERRED to be the client's own TeamPicker result, reported up
  // so the host can prefer it over its own team assignment.
  const TeamPickerSense = rsat.schema(0x80802e01, {
    entries: rsat.array(rsat.nested(Hash80802DFF), { lengthBits: 4, max: 12 }),
  });

  // 80802DCD — scoreboard vec-0 element (a player row). bool present |
  // identity kind-34 (the character id, same 8 B as PlayerAuth.key) @+1 | i32
  // stat-block index @+0xC. 97 bits.
  const Hash80802DCD = rsat.schema(0x80802dcd, {
    present: rsat.bool(),
    identity: rsat.u64(),
    statBlock: rsat.i32(),
  });

  // 80802DCE — scoreboard vec-1 element (a team row): team index, stat block.
  const Hash80802DCE = rsat.schema(0x80802dce, {
    team: rsat.i32(),
    statBlock: rsat.i32(),
  });

  // 80802DD1 — scoreboard vec-2 element (a notification). u32 notification
  // name hash (fixup kind C, default 811C9DC5, "no notification") | identity
  // kind-34 @+4 | i32 team, -1 = none. 128 bits.
  const Hash80802DD1 = rsat.schema(0x80802dd1, {
    hash: rsat.u32(),
    identity: rsat.u64(),
    team: rsat.i32(),
  });

  // 80802DCF — scoreboard vec-3 element (a stat block): a 7-bit count then
  // that many optional f32 values (1+32 bits each). A column index at or past
  // the block's count reads 0.0 client-side.
  const Hash80802DCF = rsat.schema(0x80802dcf, {
    values: rsat.array(rsat.optional(rsat.f32()), { lengthBits: 7, max: 64 }),
  });

  // 80802DD6 — Scoreboard auth.
  // - v0 80802DD2: players, u4 count (<=12) x 80802DCD.
  // - v1 80802DD3: teams, u4 count (<=12) x 80802DCE.
  // - v2 80802DD4: notifications, u4 count (<=8) x 80802DD1.
  // - v3 80802DD5: stat blocks, u5 count (<=25) x 80802DCF.
  // - v4 8080157D: extra HUD player-column indices, u2 count (<=2) x i32
  //   (80800E56, parent 80800048).
  // Empty body is the five count prefixes: 4+4+4+5+2 = 19 bits.
  const ScoreboardAuth = rsat.schema(0x80802dd6, {
    v0: rsat.array(rsat.nested(Hash80802DCD), { lengthBits: 4, max: 12 }),
    v1: rsat.array(rsat.nested(Hash80802DCE), { lengthBits: 4, max: 12 }),
    v2: rsat.array(rsat.nested(Hash80802DD1), { lengthBits: 4, max: 8 }),
    v3: rsat.array(rsat.nested(Hash80802DCF), { lengthBits: 5, max: 25 }),
    v4: rsat.array(rsat.i32(), { lengthBits: 2, max: 2 }),
  });

  // 80800623 — Health auth.
  const HealthAuth = rsat.schema(0x80800623, {
    ref: rsat.nested(SensorClientRef),
    unk1: rsat.f32(),
    unk2: rsat.f32(),
    unk3: rsat.i32(),
  });

  // 80800624 — Health sense.
  const HealthSense = rsat.schema(0x80800624, {
    unk0: rsat.f32(),
    unk1: rsat.f32(),
    unk2: rsat.i32(),
  });

  // 80800634 — Unknown24 auth. Venus 517641F1 host class 8080063D (type index
  // 56). Field 3 is kind 33 (no codec).
  const Unknown24Auth = rsat.schema(0x80800634, {
    flag0: rsat.bool(),
    unk1: rsat.i32(),
    ref: rsat.nested(SensorClientRef),
    // f3: kind 33
  });

  // 80800635 — Unknown24 sense.
  const Unknown24Sense = rsat.schema(0x80800635, {
    unk0: rsat.i32(),
    flag1: rsat.bool(),
  });

  // 80800651 — PlayerMonitor auth.
  const PlayerMonitorAuth = rsat.schema(0x80800651, {
    ref: rsat.nested(SensorClientRef),
    unk: rsat.i32(),
  });

  // 80800652 — PlayerMonitor sense.
  const PlayerMonitorSense = rsat.schema(0x80800652, {
    flag0: rsat.bool(),
    flag1: rsat.bool(),
    unk2: rsat.i32(),
    unk3: rsat.i32(),
  });

  // 80800659 — PlayerTrigger auth.
  const PlayerTriggerAuth = rsat.schema(0x80800659, {
    flag: rsat.bool(),
    unk: rsat.i32(),
  });

  // 80802DAE — PlayerObjective slot (kind 13 is 96 raw bits).
  const Hash80802DAE = rsat.schema(0x80802dae, {
    unk0: rsat.i8({ size: 4, bias: 1 }),
    ref: rsat.nested(SensorClientRef),
    kind13: rsat.bytes(12),
    unk3: rsat.i32(),
    unk4: rsat.u32(),
  });

  // 80803716 — 10× 80802DAE under PlayerObjectiveAuth.
  const Hash80803716 = rsat.schema(0x80803716, {
    slots: rsat.repeat(rsat.nested(Hash80802DAE), 10),
  });

  // 80802DB0 — PlayerObjective auth. Kind 13 in each 80802DAE slot is 96
  // raw bits; the live encoder still writes this by hand so wire 0 on the
  // biased i32s is preserved.
  const PlayerObjectiveAuth = rsat.schema(0x80802db0, {
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

  // 80802DE5 — Loot auth.
  const LootAuth = rsat.schema(0x80802de5, {
    flag: rsat.bool(),
    ref: rsat.nested(SensorClientRef),
    unk: rsat.i32(),
  });
  return {
    SensorClientRef,
    ActivityOptions,
    PlayerSenseNested,
    PlayerSense,
    PlayerAuth,
    LifetimeAuth,
    HardWipeGlobalsAuth,
    TimerAuth,
    FireteamAuth,
    ObjectAuthVec,
    ObjectDeviceComponent,
    ObjectInteractableComponent,
    ObjectDeviceSense,
    ObjectInteractableSense,
    Hash80802D98,
    ObjectCapturableComponent,
    ObjectCapturableSense,
    ObjectFactionComponent,
    ObjectFactionSense,
    ObjectTimerComponent,
    ObjectAuth,
    Hash80800E27,
    Hash80800E41,
    ObjectSense,
    SafeZoneAuth,
    SafeZoneSense,
    ObjectFilterAuthVec,
    ObjectFilterAuth,
    ObjectFilterPlayersWithActivityFlag,
    ObjectFilterPlayersOnTeam,
    ObjectFilterSlotObject,
    ObjectFilterSquadMembers,
    ObjectFilterCombatantType,
    Hash80800E85,
    Hash8080154C,
    Hash80800E4C,
    Hash80800E4D,
    SquadRoster,
    SquadAuth,
    SquadSense,
    Hash80800E4F,
    Hash808006A3,
    Hash80800E52,
    Hash808006A6,
    Hash808006A7,
    Hash808006A4,
    Hash80800E53,
    Hash808006A8,
    Hash808006A9,
    CommandScriptAtomCodec,
    MAX_COMMAND_SCRIPT_ATOMS,
    Hash8080069F,
    Hash808006A1,
    Hash80800E54,
    Hash808006AA,
    Hash808006AB,
    Hash808006A2,
    ActorAuth,
    ActorSense,
    Hash80800E4A,
    Hash8080066F,
    Hash80800E4B,
    Hash80800E49,
    ObjectiveSense,
    ObjectiveAuth,
    Hash80802DDE,
    Hash8080371D,
    SequenceAuth,
    Hash80803717,
    Hash80802DC7,
    CinematicAuth,
    Hash80802DFF,
    TeamPickerSense,
    Hash80802DCD,
    Hash80802DCE,
    Hash80802DD1,
    Hash80802DCF,
    ScoreboardAuth,
    HealthAuth,
    HealthSense,
    Unknown24Auth,
    Unknown24Sense,
    PlayerMonitorAuth,
    PlayerMonitorSense,
    PlayerTriggerAuth,
    Hash80802DAE,
    Hash80803716,
    PlayerObjectiveAuth,
    LootAuth,
  };
}
