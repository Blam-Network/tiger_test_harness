import type { CommandScriptAtom } from "@blamnetwork/bullshcript/destiny1/common";
import { event_error } from "@blamnetwork/datamine";
import { BitWriter } from "@blamnetwork/rsat";
import { activityBundleItemType } from "../../../content/row-types";
import { k_empty_name_hash } from "../../../utils/name-hash";
import {
  ACTIVITY_TICKS_PER_SECOND,
  type ActorAuthFields,
  type FinishedBits,
  type LifetimePhase,
  type LifetimeTail,
  MAX_OBJECT_FILTER_PREDICATES,
  type MachineFields,
  type ObjectDevice,
  type ObjectFilterItem,
  type ObjectInteractable,
  type ObjectiveNavPoint,
  type PlayerObjectiveFields,
  PlayerObjectiveState,
  type PlayerOccupant,
  type ReportedPlayerState,
  type SensorClientRefFields,
  type SquadAuthFields,
} from "../../rsat/sensor-auth-fields";
import { MACHINE_COMPLETE_ACTION } from "../../stubs/world-defaults";
import type { SensorWire } from "../activity-host-build";
import type { AhSchemas, PlayerState2Value, PlayerStateValue } from "./ah";
import { ZERO_AUTH } from "./zero-auth";

// The unset client ref, as the guest's constructor leaves it.
const UNSET_CLIENT_REF = {
  bundle: k_empty_name_hash,
  typeId: -1,
  typeIndex: -1,
} as const;

// Auth schemas a table names that ZERO_AUTH lacks, reported once each.
const missingZeroAuth = new Set<number>();

export function createSensorAuth(ah: AhSchemas) {
  function encodeExact(
    encodeFn: (bw: BitWriter) => void,
    capacityBytes = 4096
  ): FinishedBits {
    const bw = new BitWriter(capacityBytes);
    encodeFn(bw);
    const bitCount = bw.bitCount;
    return { bitCount, bytes: bw.finish() };
  }

  function encodeSensorClientRef(ref: SensorClientRefFields): FinishedBits {
    return encodeExact((bw) => {
      ah.SensorClientRef.encode(bw, ref);
    });
  }

  function encodeLifetimeAuth(
    state = 2,
    joinFlag = true,
    phase?: LifetimePhase,
    tail?: LifetimeTail
  ): FinishedBits {
    return encodeExact((bw) => {
      ah.LifetimeAuth.encode(bw, {
        state,
        flag1: joinFlag,
        phaseIndex: phase?.index ?? 0,
        phaseHash: phase ? phase.hash >>> 0 : k_empty_name_hash,
        field4: phase?.bubble ?? 21,
        optionOverrides: { handles: [] },
        unknown6: tail?.instance ?? 0,
        unknown7: -1,
        unknown8: k_empty_name_hash,
        timeOfDayLocked: tail?.timeOfDayLocked ?? false,
        timeOfDay: tail?.timeOfDay ?? 0,
      });
    });
  }

  // An unoccupied player row, and an occupant's before its client has
  // reported: state [0] -1 and the empty hash, identity key 0, [4] -1
  // (act_cosmo_m0_highway and city_tower_default1, retail capture).
  const EMPTY_PLAYER_STATE: PlayerStateValue = {
    unknown0: -1,
    unknown1: k_empty_name_hash,
    unknown2: false,
    unknown3: false,
    unknown4: 0,
  };

  // The player state has two of the 40662's three bools. Taken to be its last
  // two: [2] the cinematic one, [3] dead (true names unknown, not checked
  // against this client).

  function encodePlayerAuth(
    occupant: PlayerOccupant | undefined,
    cinematic = false,
    faction = 0,
    activityFlags: readonly number[] = []
  ): FinishedBits {
    const state = (occupant?.state ?? EMPTY_PLAYER_STATE) as PlayerStateValue;
    return encodeExact((bw) => {
      ah.PlayerAuth.encode(bw, {
        unknown0: {
          ...state,
          unknown1: state.unknown1 >>> 0,
          unknown2: state.unknown2 || (occupant !== undefined && cinematic),
        },
        unknown1: (occupant?.state2 as PlayerState2Value | undefined) ?? {
          unknown0: 0,
          unknown1: false,
          unknown2: false,
          unknown3: false,
        },
        identity: {
          key: occupant?.key ?? 0n,
          // A u64 here, a u8 in 40662.
          unknown1: cinematic ? 1n : 0n,
          faction,
          activityFlags: {
            flags: activityFlags.slice(0, 8).map((f) => f >>> 0),
          },
        },
        // Member 3 (true name unknown). The spawn gate holds the initial
        // spawn while it is false.
        flag: occupant !== undefined,
        unknown4: occupant ? 0 : -1,
      });
    });
  }

  // 8080082A, the squad auth: a temperament list of up to 6 u32s and the
  // roster as i32 cells (80804252), one slot per definition cell (placement
  // walks them). 40662's cell member index ([4]) and spawn point scorer input
  // ([6]) are not in this build. [0] names the squad's Objective and [8] the
  // index of its task there (the client links the squad into that task's
  // list, from which it hands it a firing area set every tick). [7] is the
  // task's +0xC, which the 40662 client never reads.
  function encodeSquadAuth(fields: SquadAuthFields): FinishedBits {
    return encodeExact((bw) => {
      ah.SquadAuth.encode(bw, {
        ref0: fields.objective && {
          bundle: fields.objective.bundle >>> 0,
          typeId: activityBundleItemType().Objective,
          typeIndex: fields.objective.typeIndex,
        },
        ref1: undefined,
        temperaments: fields.temperaments?.length
          ? { tags: fields.temperaments.slice(0, 6).map((hash) => hash >>> 0) }
          : undefined,
        roster: { cells: [...fields.roster] },
        epoch: fields.epoch,
        bindingGeneration: fields.bindingGeneration,
        unknown6: undefined,
        unknown7: fields.task === undefined ? undefined : fields.taskInfluencer,
        task: fields.task ?? -1,
        killPolicy: fields.killPolicy ? 1 : 0,
        carrierCargo: fields.carrierCargo ? 1 : 0,
      });
    });
  }

  // A stopped countdown (80800A89): min INT_MIN, max INT_MAX and rate 1, as
  // every retail capture's idle hard wipe row has it.
  const STOPPED_COUNTDOWN = {
    unknown0: false,
    unknown1: -0x80_00_00_00,
    unknown2: 0x7f_ff_ff_ff,
    unknown3: 0,
    unknown4: 0,
    unknown5: 0,
    unknown6: 1,
  };

  // One command-script atom (member kind 38, hand-coded in the client): command
  // kind (4 bits, bias 1), end-condition kind (2 bits, bias 1), the command's
  // fields, then the condition's. Kind 5 is two 4-bit values (which/value),
  // temperament is sent raw, ability has a third u32 (the empty hash in every
  // capture), and an end-2 wait is quantized over 0..511.75 s in 11 bits. Point
  // refs are the 6-bit-type client ref the rest of the wire uses.
  const ATOM_WAIT_MAX_SECONDS = 511.75;

  const ATOM_WAIT_BITS = 11;

  const UNSET_ATOM_POINT = {
    bundle: k_empty_name_hash,
    typeId: -1,
    typeIndex: -1,
  };

  function writeAtomF32(bw: BitWriter, value: number): void {
    const buf = Buffer.alloc(4);
    buf.writeFloatBE(value, 0);
    bw.write(buf.readUInt32BE(0), 32);
  }

  function writeCommandScriptAtom(
    bw: BitWriter,
    atom: CommandScriptAtom
  ): void {
    bw.write(atom.kind + 1, 4);
    bw.write(atom.end.kind + 1, 2);
    switch (atom.kind) {
      case 0:
      case 8:
        ah.SensorClientRef.encode(bw, atom.point);
        bw.write(atom.index & 0xff, 8);
        break;
      case 1:
        bw.write(atom.name >>> 0, 32);
        break;
      case 2:
        writeAtomF32(bw, atom.seconds);
        break;
      case 3:
        ah.SensorClientRef.encode(bw, atom.point);
        bw.write(atom.index & 0xff, 8);
        bw.writeBit(atom.stop ? 1 : 0);
        break;
      case 5:
        bw.write(atom.which & 0xf, 4);
        bw.write(atom.value & 0xf, 4);
        break;
      case 6:
        bw.write(atom.temperament >>> 0, 32);
        bw.writeBit(atom.add ? 1 : 0);
        break;
      case 7:
        bw.write(atom.channel >>> 0, 32);
        for (let i = 0; i < 4; i++) {
          writeAtomF32(bw, atom.values[i] ?? 0);
        }
        break;
      case 9:
        bw.write(atom.name >>> 0, 32);
        bw.write(atom.argument >>> 0, 32);
        bw.write(k_empty_name_hash, 32);
        ah.SensorClientRef.encode(bw, atom.point ?? UNSET_ATOM_POINT);
        bw.write((atom.slot + 1) & 7, 3);
        bw.write((atom.index + 0x80) & 0xff, 8);
        break;
      default:
        break;
    }
    if (atom.end.kind === 2) {
      const q = Math.round(
        (Math.min(Math.max(atom.end.seconds, 0), ATOM_WAIT_MAX_SECONDS) /
          ATOM_WAIT_MAX_SECONDS) *
          ((1 << ATOM_WAIT_BITS) - 1)
      );
      bw.write(q, ATOM_WAIT_BITS);
    }
  }

  // The client copies at most 32 atoms (8080436F: a 6-bit count).
  const MAX_COMMAND_SCRIPT_ATOMS = 32;

  // 80800844, the actor auth: {[0] optional kill epoch (i31), [1] killed,
  // [2] carried, [3] place, [4] optional behaviour (80800815), [5] optional
  // script (808004E8: cookie, pc, the atoms), [6] optional drop (80800789)}.
  // Written by hand in schema order because the atoms have no rsat field; the
  // rest goes through the nested schemas. A dropship pilot is placed with its
  // fly-in script in one body (retail capture, the Ketch arrival).
  function encodeActorAuth(fields: ActorAuthFields): FinishedBits {
    const { behaviour, drop, kill, script } = fields;
    const killEpoch = kill?.epoch ?? fields.incarnation;
    return encodeExact((bw) => {
      bw.writeBit(killEpoch === undefined ? 0 : 1);
      if (killEpoch !== undefined) {
        bw.write(killEpoch & 0x7f_ff_ff_ff, 31);
      }
      bw.write((kill ? 1 : 0) + 1, 2);
      bw.write((fields.carried ? 1 : 0) + 1, 3);
      bw.writeBit(fields.place ? 1 : 0);
      bw.writeBit(behaviour ? 1 : 0);
      if (behaviour) {
        ah.Unknown80800815.encode(bw, {
          unknown0: behaviour.generation,
          // The perception override bits, then the bits the host sets.
          unknown1: behaviour.awarenessFlags,
          unknown2: behaviour.awarenessMask,
          unknown3: {
            tags: (behaviour.temperaments ?? [])
              .slice(0, 6)
              .map((hash) => hash >>> 0),
          },
          unknown4: UNSET_CLIENT_REF,
          unknown5: 0,
          unknown6: {
            unknown0: (behaviour.channels ?? []).slice(0, 4).map((entry) => ({
              unknown0: entry.id >>> 0,
              unknown1: {
                unknown0: [0, 1, 2, 3].map((i) => entry.values[i] ?? 0),
              },
            })),
          },
        });
      }
      bw.writeBit(script ? 1 : 0);
      if (script) {
        const atoms = script.atoms.slice(0, MAX_COMMAND_SCRIPT_ATOMS);
        bw.write(script.cookie & 0x7f_ff_ff_ff, 31);
        bw.write((script.pc ?? 0) & 0x3f, 6);
        bw.write(atoms.length, 6);
        for (const atom of atoms) {
          bw.writeBit(1);
          writeCommandScriptAtom(bw, atom);
        }
      }
      bw.writeBit(drop ? 1 : 0);
      if (drop) {
        ah.Unknown80800789.encode(bw, {
          unknown0: {
            unknown0: drop.refs.slice(0, 8).map((ref) => ({ ...ref })),
          },
          unknown1: drop.dropId,
        });
      }
    });
  }

  // 80800436, the PlayerTrigger auth: {enabled, arm stamp}. The trigger fires
  // once per arming when a local player is in its volume.
  function encodePlayerTriggerAuth(
    enabled: boolean,
    armStamp: number
  ): FinishedBits {
    return encodeExact((bw) => {
      ah.PlayerTriggerAuth.encode(bw, { enabled, armStamp });
    });
  }

  // 808006CA, the PlayerMonitor auth: {filter, i32}. An unset filter counts
  // every player.
  function encodePlayerMonitorAuth(
    filter?: SensorClientRefFields
  ): FinishedBits {
    return encodeExact((bw) => {
      ah.PlayerMonitorAuth.encode(bw, {
        filter: filter ?? UNSET_CLIENT_REF,
        unknown1: 0,
      });
    });
  }

  // 8080297F, the Sequence auth, its variable pairs three fixed slots (a
  // counted list in 40662); unused ones go out as the zero auth's {0, 0}.
  // Playing id 255 is none. [3] is the row the sequence plays from: the breach
  // names the entrance actor on its seq_fallen_* rows (e.g.
  // seq_fallen_intro_vandal_drop), unset elsewhere.
  const SEQUENCE_PAIRS = 3;

  function encodeSequenceAuth(
    play?: { playingId: number; startTick: number },
    pairs: readonly { name: number; value: number }[] = [],
    source?: SensorClientRefFields
  ): FinishedBits {
    return encodeExact((bw) => {
      ah.SequenceAuth.encode(bw, {
        startTick: play?.startTick ?? -1,
        playingId: play?.playingId ?? 0xff,
        variables: {
          pairs: Array.from({ length: SEQUENCE_PAIRS }, (_, i) => ({
            name: (pairs[i]?.name ?? 0) >>> 0,
            value: (pairs[i]?.value ?? 0) >>> 0,
          })),
        },
        viewers: source ?? UNSET_CLIENT_REF,
      });
    });
  }

  // 80804B15: 10 nav slots of 808027D4 {[0] i4 bias 1 (raw 2 a waypoint,
  // 1 none), [1] i3 bias 1 (true name unknown, left 0), [2] ref (unset), [3]
  // i32 the bubble, [4] the position (kind 13: three raw f32), [5] the NavPoint
  // row}. Objectives fill slot 0 exactly so (retail capture, obj_m0_phase00_m1:
  // bubble 14, (375.725, -796.574, 13.351)).
  const NAV_SLOTS = 10;

  function writeNavSlots(
    bw: BitWriter,
    navPoints: readonly ObjectiveNavPoint[]
  ): void {
    const biased = (value: number) => (value + 0x80_00_00_00) >>> 0;
    for (let i = 0; i < NAV_SLOTS; i++) {
      const point = navPoints[i];
      bw.write(point ? 2 : 1, 4);
      bw.write(1, 3);
      ah.SensorClientRef.encode(bw, UNSET_CLIENT_REF);
      bw.write(biased(point?.sliceSet ?? -1), 32);
      const xyz = Buffer.alloc(12);
      if (point) {
        xyz.writeFloatBE(point.x, 0);
        xyz.writeFloatBE(point.y, 4);
        xyz.writeFloatBE(point.z, 8);
      }
      for (const byte of xyz) {
        bw.write(byte, 8);
      }
      ah.SensorClientRef.encode(bw, point?.ref ?? UNSET_CLIENT_REF);
    }
  }

  // The player objective states on the wire: act_cosmo_m0_highway sends 2 for
  // an incoming objective and 3 for an active one (retail captures, every
  // objective), 0 to clear; 1 is never on the wire. Complete and failed are
  // never seen either; they follow the same shift.
  const PLAYER_OBJECTIVE_WIRE_STATE: Readonly<
    Record<PlayerObjectiveState, number>
  > = {
    [PlayerObjectiveState.None]: 0,
    [PlayerObjectiveState.Incoming]: 2,
    [PlayerObjectiveState.Active]: 3,
    [PlayerObjectiveState.Complete]: 4,
    [PlayerObjectiveState.Failed]: 5,
  };

  // 808023BE: the PlayerObjective auth. No member is optional here (40662's
  // are, absent keeping the client's value), so every change sends them all.
  // [0] state (3 bits, bias 1), [1] ref, [2] countdown flag, [3] the
  // countdown (80800A89, sent stopped), [4] progress kind (raw 2 counts, 1
  // none), [5]/[6] progress min/max, [7] progress ref, [8] the 10 nav point
  // slots (their position is a kind-13 member), [9] participants, [10] tier,
  // [11] u32 (true name unknown; 40662 has an f32 and a u32 there).
  function encodePlayerObjectiveAuth(
    fields: PlayerObjectiveFields
  ): FinishedBits {
    const biased = (value: number) => (value + 0x80_00_00_00) >>> 0;
    const shown = fields.state !== PlayerObjectiveState.None;
    return encodeExact((bw) => {
      bw.write(PLAYER_OBJECTIVE_WIRE_STATE[fields.state] + 1, 3);
      ah.SensorClientRef.encode(bw, UNSET_CLIENT_REF);
      bw.writeBit(0);
      ah.ObjectiveCountdown.encode(bw, STOPPED_COUNTDOWN);
      bw.write(fields.progress ? 2 : 1, 4);
      bw.write(fields.progress ? biased(fields.progress.min) : biased(0), 32);
      bw.write(fields.progress ? biased(fields.progress.max) : biased(0), 32);
      ah.SensorClientRef.encode(bw, fields.progressRef ?? UNSET_CLIENT_REF);
      writeNavSlots(bw, shown ? (fields.navPoints ?? []) : []);
      bw.write(
        biased(
          shown && fields.participants !== undefined ? fields.participants : 0
        ),
        32
      );
      bw.write(biased(fields.tier ?? 0), 32);
      bw.write(0, 32);
    });
  }

  // 808024DF, a Cinematic row: [0] i32 the activity tick it started at (0
  // idle), [1] u32 a generation that moves on every change, [2] playing, [3]
  // ref (unset), [4] 6 bits, raw 2 in every captured state, [5] a u64 list
  // (5-bit count, up to 16), [6] u32. 40662's second u64 list is not in this
  // build. Cinematics (retail capture: act_cosmo_m0_highway, cine_reveal) go
  // idle gen 1 -> playing gen 2 -> (the client's finish echoed, gen 3) -> idle
  // gen 4; the host sends the idle and playing forms. [5] and [6] true names
  // unknown.
  const CINEMATIC_UNKNOWN4_RAW = 2;
  const CINEMATIC_MAX_SKIPPERS = 16;

  // A skip keeps the start tick, stops playing and lists the characters that
  // skipped it ([5]): the answer to a client's cinematic_skip, sent shortly
  // before that client reports the cinematic finished.
  function encodeCinematicAuth(
    generation: number,
    startTick?: number,
    skippedBy?: readonly bigint[]
  ): FinishedBits {
    const playing = startTick !== undefined && skippedBy === undefined;
    return encodeExact((bw) => {
      bw.write(((startTick ?? 0) + 0x80_00_00_00) >>> 0, 32);
      bw.write(generation >>> 0, 32);
      bw.writeBit(playing ? 1 : 0);
      ah.SensorClientRef.encode(bw, UNSET_CLIENT_REF);
      bw.write(CINEMATIC_UNKNOWN4_RAW, 6);
      const skippers = (skippedBy ?? []).slice(0, CINEMATIC_MAX_SKIPPERS);
      bw.write(skippers.length, 5);
      for (const key of skippers) {
        bw.write(Number(key >> 32n) >>> 0, 32);
        bw.write(Number(key & 0xff_ff_ff_ffn) >>> 0, 32);
      }
      bw.write(0, 32);
    });
  }

  function encodeObjectAuth(
    generation: number,
    present: boolean,
    device?: ObjectDevice,
    interactable?: ObjectInteractable
  ): FinishedBits {
    return encodeExact((bw) => {
      bw.write((generation + 0x80_00_00_00) >>> 0, 32);
      bw.writeBit(present ? 1 : 0);
      ah.SensorClientRef.encode(bw, UNSET_CLIENT_REF);
      // The component vec (80804113): a 2-bit count, then each element as a
      // present bit, its schema and its body. The hack console carries the
      // interactable ahead of the device (retail capture, cosmo_portal_1).
      bw.write((interactable ? 1 : 0) + (device ? 1 : 0), 2);
      if (interactable) {
        bw.writeBit(1);
        bw.write(ah.ObjectInteractableComponent.hash, 32);
        ah.ObjectInteractableComponent.encode(bw, {
          mode: interactable.enabled ? 2 : 1,
          filter: interactable.filter ?? UNSET_CLIENT_REF,
          usedStamp: interactable.used?.stamp ?? 0,
          used: interactable.used?.value ?? false,
        });
      }
      if (device) {
        bw.writeBit(1);
        bw.write(ah.ObjectDeviceComponent.hash, 32);
        ah.ObjectDeviceComponent.encode(bw, {
          powerStamp: 0,
          power: 1,
          lockStamp: 0,
          lock: 0,
          positionStamp: device.stamp,
          position: device.position,
        });
      }
    });
  }

  // 80800732, an ObjectFilter auth: one vec (808042E0, a 4-bit count of
  // up to 8 elements) of predicates, each a present bit, its class and its
  // body (mode 0 = add).
  function encodeObjectFilterAuth(
    items: readonly ObjectFilterItem[] = []
  ): FinishedBits {
    // The three classes this build has a schema for; a remove has none.
    const kept = items
      .filter(
        (
          item
        ): item is Extract<
          ObjectFilterItem,
          { kind: "activityFlag" | "row" | "squadMembers" }
        > =>
          item.kind === "activityFlag" ||
          ((item.kind === "row" || item.kind === "squadMembers") &&
            !item.remove)
      )
      .slice(0, MAX_OBJECT_FILTER_PREDICATES);
    return encodeExact((bw) => {
      bw.write(kept.length, 4);
      for (const item of kept) {
        bw.writeBit(1);
        if (item.kind === "row") {
          bw.write(ah.ObjectFilterRowPredicate.hash, 32);
          ah.ObjectFilterRowPredicate.encode(bw, {
            mode: 0,
            item: item.item,
          });
        } else if (item.kind === "squadMembers") {
          bw.write(ah.ObjectFilterSquadMembersPredicate.hash, 32);
          ah.ObjectFilterSquadMembersPredicate.encode(bw, {
            mode: 0,
            item: item.item,
          });
        } else {
          bw.write(ah.ObjectFilterActivityFlagPredicate.hash, 32);
          ah.ObjectFilterActivityFlagPredicate.encode(bw, {
            mode: 0,
            flag: item.flag >>> 0,
          });
        }
      }
    });
  }

  // 808004D0, an Objective row (an encounter's _objective): a state per
  // task slot and the reset generation reset() bumps. Both bump as a wiped
  // ambient encounter respawns (retail capture: 2 -> 3, the Last Array's public
  // host), which reopens the task elements its deaths had closed; without it
  // the new bodies have nowhere to go.
  const OBJECTIVE_SLOTS = 24;

  function encodeObjectiveAuth(
    slots: readonly (number | undefined)[] = [],
    resetGeneration?: number
  ): FinishedBits {
    const used = slots.some((slot) => slot !== undefined);
    return encodeExact((bw) =>
      ah.ObjectiveAuth.encode(bw, {
        slots: used
          ? {
              slots: Array.from(
                { length: OBJECTIVE_SLOTS },
                (_, i) => slots[i]
              ),
            }
          : undefined,
        resetGeneration,
      })
    );
  }

  // 8080232B, a Loot row (collect_loot_objective's _loot): whether the
  // players' kills drop its quest items, a player filter (none on every
  // captured row) and an epoch a reset() bumps so leftover items vanish. In
  // the retail capture act_cosmo_m4_dome_c enables it as obj_m4_o1b goes active
  // and the dead Ghosts start dropping.
  function encodeLootAuth(enabled = false, epoch = 0): FinishedBits {
    return encodeExact((bw) => {
      bw.writeBit(enabled ? 1 : 0);
      ah.SensorClientRef.encode(bw, UNSET_CLIENT_REF);
      bw.write(epoch, 32);
    });
  }

  // 808003E3, a trigger group row (tg_*, true name unknown): the TriggerVolume it
  // watches and a 2-bit state. tg_m0_gating carries its bundle's sv_m0_gating
  // and -1 at the breach entry, 1 as the Ghost lights up, 0 at the next phase
  // (act_cosmo_m0_highway, 7 of 7 captures). The zero auth would be bundle 0 /
  // type 0 / row 0, a ref to nothing, on a row only the breach world has.
  function encodeTriggerGroupAuth(
    volume: SensorClientRefFields = UNSET_CLIENT_REF,
    state = -1
  ): FinishedBits {
    return encodeExact((bw) => {
      ah.SensorClientRef.encode(bw, volume);
      bw.write(state + 1, 2);
    });
  }

  // 8080052E, a Machine row (type 40, true name unknown): the actor's
  // AI-managed performance. [0] optional {u32 performance name, u32
  // "complete_action" (9A5F60C9, the same on every captured row), i32 bias
  // 0x80000000 generation}; [1] optional list (3-bit count, up to 4) of
  // {u32 empty hash, u32 cue name}. In a retail capture act_cosmo_m0_highway
  // sends both members present and empty at every world entry (perf_ghost,
  // nux_ghost, the nest rows), names the performance with the actor's
  // placement and appends cues one at a time (the nests' scatter, the Ghost's
  // beats). The zero auth has both absent.
  const MACHINE_MAX_CUES = 4;

  // 80800705, the Timer auth. Idle is stopped, min INT_MIN, max INT_MAX, rate
  // 1, no bar (every act_cosmo_m0_highway world entry, retail capture), not the
  // zero body. A running one counts `seconds` down from `startTick`; the
  // end-of-activity lifetime_timer is this with 0 seconds (running, min and
  // max 0, epoch the tick).
  function encodeTimerAuth(run?: {
    progressBar?: boolean;
    rate?: number;
    seconds: number;
    startTick: number;
  }): FinishedBits {
    const ticks = run ? Math.round(run.seconds * ACTIVITY_TICKS_PER_SECOND) : 0;
    return encodeExact((bw) => {
      ah.TimerAuth.encode(bw, {
        options: {
          unknown0: run !== undefined,
          unknown1: run ? 0 : -0x80_00_00_00,
          unknown2: run ? ticks : 0x7f_ff_ff_ff,
          unknown3: 0,
          unknown4: ticks,
          unknown5: run?.startTick ?? 0,
          unknown6: run?.rate ?? 1,
        },
        progressBar: run?.progressBar ?? false,
        barOffsetSeconds: 0,
      });
    });
  }

  // 80800479, the hard_wipe_globals row. Idle is not the zero body: the
  // countdown is stopped (every retail capture).
  function encodeHardWipeGlobalsAuth(enabled: boolean): FinishedBits {
    return encodeExact((bw) => {
      ah.HardWipeGlobalsAuth.encode(bw, {
        countdown: STOPPED_COUNTDOWN,
        enabled,
        unknown1: 0,
      });
    });
  }

  function encodeMachineAuth(fields: MachineFields = {}): FinishedBits {
    const { performance } = fields;
    const cues = (fields.cues ?? []).slice(-MACHINE_MAX_CUES);
    return encodeExact((bw) => {
      bw.writeBit(1);
      bw.write(performance ? performance.name >>> 0 : k_empty_name_hash, 32);
      bw.write(performance ? MACHINE_COMPLETE_ACTION : k_empty_name_hash, 32);
      bw.write(((performance?.generation ?? 0) + 0x80_00_00_00) >>> 0, 32);
      bw.writeBit(1);
      bw.write(cues.length, 3);
      for (const cue of cues) {
        bw.write(k_empty_name_hash, 32);
        bw.write(cue >>> 0, 32);
      }
    });
  }

  // 80800637, a HopOn (type 24): {bool, i32, the ObjectFilter it reads,
  // no element}. ho_ghostlight is {false, 0, unset} until the Ghost lights up,
  // then refs of_ghostlight (retail capture). The zero auth's ref would be
  // bundle 0 / type 0 / row 0, like the trigger group's.
  function encodeHopOnAuth(
    filter: SensorClientRefFields = UNSET_CLIENT_REF
  ): FinishedBits {
    return encodeExact((bw) => {
      bw.writeBit(0);
      bw.write(0x80_00_00_00, 32);
      ah.SensorClientRef.encode(bw, filter);
      bw.writeBit(0);
    });
  }

  // 80802225, a Passenger row (type 37): a cookie and the row it rides. Idle
  // is cookie 0 and the unset ref; the host binds it to an Actor row with
  // cookie 1 and unbinds it with cookie 2 and the unset ref (retail capture,
  // cosmo_portal_1 skiff_passenger). The client's reconcile names the binding
  // (sub_1608EC0) asserts on a type-0 ref, so the zero auth crashes it as soon
  // as the row applies.
  function encodePassengerAuth(
    cookie: number,
    binding: SensorClientRefFields = UNSET_CLIENT_REF
  ): FinishedBits {
    return encodeExact((bw) => {
      ah.PassengerAuth.encode(bw, { cookie, binding });
    });
  }

  // A row's body before any script writes it. Most kinds take their schema
  // with every member zero or absent; these have a real idle state: a
  // sequence with no playing id (255, not 0: the client logs "host tried to
  // start with an invalid sequence" for 0), a player monitor and an object
  // with the unset ref (everyone / none) rather than a ref to row 0 of bundle
  // 0, and an enabled player trigger.
  const IDLE_AUTH: ReadonlyMap<number, () => FinishedBits> = new Map([
    [0x80_80_29_7f, () => encodeSequenceAuth()],
    // Untouched player triggers are enabled and never armed (retail capture,
    // every act_cosmo_m0_highway snapshot).
    [0x80_80_04_36, () => encodePlayerTriggerAuth(true, 0)],
    [0x80_80_06_ca, () => encodePlayerMonitorAuth()],
    [0x80_80_07_b4, () => encodeObjectAuth(0, false)],
    // Idle Cinematic: generation 1, not playing.
    [0x80_80_24_df, () => encodeCinematicAuth(1)],
    // A trigger group with no volume known and a hop-on with no filter: the
    // unset ref, not bundle 0 / row 0 (the world entry gives a trigger group
    // its volume through ApplySensor.idle).
    [0x80_80_03_e3, () => encodeTriggerGroupAuth()],
    [0x80_80_06_37, () => encodeHopOnAuth()],
    // A passenger riding nothing.
    [0x80_80_22_25, () => encodePassengerAuth(0, UNSET_CLIENT_REF)],
    // An idle Loot row: disabled, the unset filter.
    [0x80_80_23_2b, () => encodeLootAuth()],
    // A machine with no performance: both members present and empty (the zero
    // auth has both absent).
    [0x80_80_05_2e, () => encodeMachineAuth()],
    // A stopped timer (the binder's lifetime_timer).
    [0x80_80_07_05, () => encodeTimerAuth()],
    // Nothing armed.
    [0x80_80_04_79, () => encodeHardWipeGlobalsAuth(false)],
    // A PlayerObjective no script has set: nothing shown, every ref unset.
    // The zero auth's refs name type 0, and the client's waypoint update
    // asserts a nav slot's NavPoint ref ([5]) has a type (sub_1605BA0) on every
    // update of the row.
    [
      0x80_80_23_be,
      () => encodePlayerObjectiveAuth({ state: PlayerObjectiveState.None }),
    ],
  ]);

  function zeroAuth(schema: number): FinishedBits | undefined {
    const zero = ZERO_AUTH[schema];
    if (!zero) {
      if (!missingZeroAuth.has(schema)) {
        missingZeroAuth.add(schema);
        event_error(
          "activities:host: sensor auth: no zero auth for 0x%x; its rows are left out of the apply",
          schema
        );
      }
      return;
    }
    return { bitCount: zero.bits, bytes: Buffer.from(zero.hex, "hex") };
  }

  return {
    encodeActor: encodeActorAuth,
    encodeCinematic: encodeCinematicAuth,
    encodeClientRef: encodeSensorClientRef,
    encodeHardWipeGlobals: encodeHardWipeGlobalsAuth,
    encodeHopOn: encodeHopOnAuth,
    encodeLifetime: encodeLifetimeAuth,
    encodeLoot: encodeLootAuth,
    encodeMachine: encodeMachineAuth,
    encodeObject: encodeObjectAuth,
    encodeObjectFilter: encodeObjectFilterAuth,
    encodeObjective: encodeObjectiveAuth,
    encodePassenger: encodePassengerAuth,
    encodePlayer: encodePlayerAuth,
    encodePlayerMonitor: encodePlayerMonitorAuth,
    encodePlayerObjective: encodePlayerObjectiveAuth,
    encodePlayerTrigger: encodePlayerTriggerAuth,
    encodeSequence: encodeSequenceAuth,
    encodeSquad: encodeSquadAuth,
    encodeTimer: encodeTimerAuth,
    encodeTriggerGroup: encodeTriggerGroupAuth,
    idleAuth: (schema: number) => IDLE_AUTH.get(schema)?.() ?? zeroAuth(schema),
    leadsWithDomain: true,
    // The lifetime states are the scripts' own, as the 36735 alpha's: the
    // spawn gate (sub_8FA920) lets only 2 and 5 through.
    lifetimeStates: { active: 2, ended: 6, none: 0, pregame: 0, shift: 0 },
    // The request to respawn is the second state's first bool; the host
    // answers it by echoing it (retail captures).
    withholdRespawn: (state2: ReportedPlayerState | undefined) =>
      state2 && ({ ...state2, unknown1: false } as ReportedPlayerState),
    samePlayerState(
      a: ReportedPlayerState | undefined,
      b: ReportedPlayerState
    ): boolean {
      const x = a as PlayerStateValue | undefined;
      const y = b as PlayerStateValue;
      return (
        x !== undefined &&
        x.unknown0 === y.unknown0 &&
        x.unknown1 >>> 0 === y.unknown1 >>> 0 &&
        x.unknown2 === y.unknown2 &&
        x.unknown3 === y.unknown3 &&
        x.unknown4 === y.unknown4
      );
    },
  } satisfies Omit<SensorWire, "sense">;
}
