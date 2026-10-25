import { event_error } from "@blamnetwork/datamine";
import { BitWriter } from "@blamnetwork/rsat";
import { activityBundleItemType } from "../../../content/row-types";
import { k_empty_name_hash } from "../../../utils/name-hash";
import {
  ACTIVITY_TICKS_PER_SECOND,
  type ActorAuthFields,
  type FinishedBits,
  type LifetimePhase,
  MAX_OBJECT_FILTER_PREDICATES,
  type ObjectDevice,
  type ObjectFilterItem,
  type ObjectInteractable,
  type PlayerObjectiveFields,
  PlayerObjectiveState,
  type PlayerOccupant,
  type ReportedPlayerState,
  type SensorClientRefFields,
  type SquadAuthFields,
} from "../../rsat/sensor-auth-fields";
import type { SensorWire } from "../activity-host-build";
import type { AhSchemas } from "./ah";

// Guest constructor unset client-ref (8370F1C8).
const UNSET_CLIENT_REF = {
  bundle: k_empty_name_hash,
  typeId: -1,
  typeIndex: -1,
} as const;

// Auth schemas a table names that this build has no idle body for, reported
// once each.
const missingIdleAuth = new Set<number>();

// ObjectFilter predicate modes: 0 adds the matches to the filter's result
// list, 1 removes them (sub_8369B7C0).
const FILTER_MODE_ADD = 0;
const FILTER_MODE_REMOVE = 1;

// The nav slots of a PlayerObjective.
const NAV_SLOTS = 10;

// The objective's task slots.
const OBJECTIVE_SLOTS = 24;

// The alpha's sensor auth rows, in the alpha's layouts.
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

  function appendBits(bw: BitWriter, body: FinishedBits): void {
    for (let i = 0; i < body.bitCount; i++) {
      bw.writeBit((body.bytes[i >> 3] >> (7 - (i & 7))) & 1);
    }
  }

  function encodeClientRef(ref: SensorClientRefFields): FinishedBits {
    return encodeExact((bw) => {
      ah.SensorClientRef.encode(bw, ref);
    });
  }

  function emptyActivityOptions() {
    return {
      running: false,
      min: -0x80_00_00_00,
      max: 0x7f_ff_ff_ff,
      elapsedBase: 0,
      remainingBase: 0,
      epoch: 0,
      rate: 1,
    };
  }

  function zeroActivityOptions() {
    return {
      running: false,
      min: 0,
      max: 0,
      elapsedBase: 0,
      remainingBase: 0,
      epoch: 0,
      rate: 0,
    };
  }

  // 8080052F: the Lifetime. Field 0 is the spawn-ready state (the spawn
  // waits for 2). The phase names are the story activity's running phase;
  // with none the members keep what was sent so far. The tail is no
  // world-handle list: it upserts each entry into the client's
  // activity-option table by hash, and no verb writes a non-empty one.
  function encodeLifetimeAuth(
    state = 2,
    joinFlag = true,
    phase?: LifetimePhase
  ): FinishedBits {
    return encodeExact((bw) => {
      ah.LifetimeAuth.encode(bw, {
        state,
        flag1: joinFlag,
        phaseIndex: phase?.index ?? 0,
        phaseHash: phase ? phase.hash >>> 0 : k_empty_name_hash,
        field4: phase?.bubble ?? 21,
        optionOverrides: { handles: [] },
      });
    });
  }

  // 8080052C: the key is the identity the guest's spawn gate byte-compares
  // against its local player. Field 2 is the player's activity flags (an
  // ObjectFilter that asks for players with a flag matches on plain 32-bit
  // equality against this list, eight at most).
  function encodePlayerAuth(
    occupant: PlayerOccupant | undefined,
    _cinematic = false,
    faction = 0,
    activityFlags: readonly number[] = []
  ): FinishedBits {
    return encodeExact((bw) => {
      ah.PlayerAuth.encode(bw, {
        key: occupant?.key ?? 0n,
        unk1: faction,
        sense: {
          unk0: 0,
          nested: { flags: activityFlags.slice(0, 8).map((f) => f >>> 0) },
          flag2: false,
          unk3: 0,
          unk4: 0,
          flag5: false,
          flag6: false,
        },
        flag: false,
      });
    });
  }

  // 8080067A. Only the roster is mandatory: the client reads the received
  // count from the decoded state and bugchecks unless it equals the
  // definition count. Field 8 is the spawn-influencer bucket, sent -1 when
  // the squad has none (an absent one decodes as bucket 0).
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
          ? { tags: fields.temperaments.slice(0, 4).map((hash) => hash | 0) }
          : undefined,
        roster: { slots: [...fields.roster] },
        // The epoch: when it changes the client drops the squad's leftover
        // members and zeroes its per-cell count of bodies lost.
        unk4: fields.epoch,
        unk5: fields.bindingGeneration,
        unk6: undefined,
        unk7: undefined,
        unk8: fields.task ?? -1,
        unk9: fields.killPolicy ? 1 : 0,
        unk10: fields.carrierCargo ? 1 : 0,
      });
    });
  }

  // 808006AF: the place gate (flag3), the kill epoch, the carrier seat, the
  // behaviour (the active temperaments and channel writes, each gated on its
  // own generation), a command script from a fresh cookie and the dropship
  // queue.
  function encodeActorAuth(fields: ActorAuthFields): FinishedBits {
    const { behaviour, drop, kill, script } = fields;
    return encodeExact((bw) => {
      ah.ActorAuth.encode(bw, {
        unk0: kill?.epoch,
        unk1: kill ? 1 : 0,
        unk2: fields.carried ? 1 : 0,
        flag3: fields.place,
        nest4: behaviour
          ? {
              generation: behaviour.generation,
              f1: 0,
              temperaments: {
                tags: (behaviour.temperaments ?? [])
                  .slice(0, 4)
                  .map((hash) => hash | 0),
              },
              f3: UNSET_CLIENT_REF,
              f4: 0,
              channels: {
                channels: (behaviour.channels ?? [])
                  .slice(0, 4)
                  .map((entry) => ({
                    f0: entry.id >>> 0,
                    f1: {
                      f0: entry.values[0] ?? 0,
                      f1: entry.values[1] ?? 0,
                      f2: entry.values[2] ?? 0,
                      f3: entry.values[3] ?? 0,
                    },
                  })),
              },
            }
          : undefined,
        nest5: undefined,
        script: script
          ? {
              cookie: script.cookie,
              pc: script.pc ?? 0,
              script: {
                atoms: script.atoms.slice(0, ah.MAX_COMMAND_SCRIPT_ATOMS),
              },
            }
          : undefined,
        nest7: drop
          ? {
              refs: drop.refs.slice(0, 8).map((ref) => ({ ...ref })),
              dropId: drop.dropId,
            }
          : undefined,
      });
    });
  }

  // 80800659: the trigger fires once per arming when the local player is in
  // its volume and last_fire < stamp.
  function encodePlayerTriggerAuth(
    enabled: boolean,
    armStamp: number
  ): FinishedBits {
    return encodeExact((bw) => {
      ah.PlayerTriggerAuth.encode(bw, { flag: enabled, unk: armStamp });
    });
  }

  // 80800651: the ObjectFilter the row counts; unset counts every player.
  function encodePlayerMonitorAuth(
    filter?: SensorClientRefFields
  ): FinishedBits {
    return encodeExact((bw) => {
      ah.PlayerMonitorAuth.encode(bw, {
        ref: filter ?? UNSET_CLIENT_REF,
        unk: 0,
      });
    });
  }

  // 80802DE0: a sequence plays when the playing id changes to a value other
  // than 255 (none); unk0 is the activity tick it started at. The guest
  // compares each variable name against the empty hash and looks up the
  // others; an unset slot stays that hash. Two variables at most.
  function encodeSequenceAuth(
    play?: { playingId: number; startTick: number },
    pairs: readonly { name: number; value: number }[] = []
  ): FinishedBits {
    const slot = (index: number) => {
      const written = pairs[index];
      return written
        ? { f0: written.name >>> 0, f1: written.value >>> 0 }
        : { f0: k_empty_name_hash, f1: 0 };
    };
    return encodeExact((bw) => {
      ah.SequenceAuth.encode(bw, {
        unk0: play?.startTick ?? -1,
        unk1: play?.playingId ?? 0xff,
        pair: { a: slot(0), b: slot(1) },
        ref: UNSET_CLIENT_REF,
      });
    });
  }

  // 80802DB0: field 0 is the state (any but None shows the row's text on the
  // HUD), field 2 the countdown flag, field 4 the progress kind (raw 2 counts,
  // 1 none), 9 the participant mask and 10 the public-event tier. The ten
  // nav slots each draw a waypoint when their kind is raw 2. Written by hand
  // so the biased i32s stay wire 0.
  function encodePlayerObjectiveAuth(
    fields: PlayerObjectiveFields
  ): FinishedBits {
    const ref = encodeClientRef(UNSET_CLIENT_REF);
    const shown = fields.state !== PlayerObjectiveState.None;
    const navPoints = fields.navPoints ?? [];
    return encodeExact((bw) => {
      bw.write(fields.state + 1, 3);
      appendBits(bw, ref);
      bw.writeBit(0);
      ah.ActivityOptions.encode(bw, zeroActivityOptions());
      bw.write(fields.progress ? 2 : 1, 4);
      bw.write(
        fields.progress ? (fields.progress.min + 0x80_00_00_00) >>> 0 : 0,
        32
      );
      bw.write(
        fields.progress ? (fields.progress.max + 0x80_00_00_00) >>> 0 : 0,
        32
      );
      appendBits(
        bw,
        fields.progressRef ? encodeClientRef(fields.progressRef) : ref
      );
      for (let i = 0; i < NAV_SLOTS; i++) {
        const point = shown ? navPoints[i] : undefined;
        bw.write(point ? 2 : 1, 4);
        appendBits(bw, ref);
        const xyz = Buffer.alloc(12);
        if (point) {
          xyz.writeFloatBE(point.x, 0);
          xyz.writeFloatBE(point.y, 4);
          xyz.writeFloatBE(point.z, 8);
        }
        for (const byte of xyz) {
          bw.write(byte, 8);
        }
        bw.write(0, 32);
        bw.write(0, 32);
      }
      bw.write(
        fields.participants === undefined || !shown
          ? 0
          : (fields.participants + 0x80_00_00_00) >>> 0,
        32
      );
      bw.write(((fields.tier ?? 0) + 0x80_00_00_00) >>> 0, 32);
    });
  }

  // 80802DC9, a Cinematic row (type 6, auth only): the start tick, a command
  // (0 idle, 1 start, 2 stop), the viewer filter ref (unset is everyone), an
  // empty vec and a u32. The client reports cinematic_started and
  // cinematic_finished incidents. A skip is a stop.
  function encodeCinematicAuth(
    _generation: number,
    startTick?: number,
    skippedBy?: readonly bigint[]
  ): FinishedBits {
    let command = 2;
    if (skippedBy === undefined) {
      command = startTick === undefined ? 0 : 1;
    }
    return encodeExact((bw) => {
      ah.CinematicAuth.encode(bw, {
        unk0: startTick ?? -1,
        unk1: command,
        ref: UNSET_CLIENT_REF,
        vec: { count: 0 },
        unk4: 0,
      });
    });
  }

  // 808005EF: the Object auth. Non-networked objects exist when `present`
  // says so; a device component drives the door to its position itself
  // (0 closed, 1 open), each write needing a stamp above the stored one. The
  // interactable's `filter` decides which players may use it.
  function encodeObjectAuth(
    generation: number,
    present: boolean,
    device?: ObjectDevice,
    interactable?: ObjectInteractable
  ): FinishedBits {
    return encodeExact((bw) => {
      ah.ObjectAuth.encode(bw, {
        generation,
        present,
        ref: UNSET_CLIENT_REF,
        vec: { count: (device ? 1 : 0) + (interactable ? 1 : 0) },
      });
      if (device) {
        // A vec element: present bit, the schema's id, then its payload.
        bw.writeBit(1);
        bw.write(ah.ObjectDeviceComponent.hash, 32);
        ah.ObjectDeviceComponent.encode(bw, {
          powerStamp: 0,
          power: 0,
          lockStamp: 0,
          lock: 0,
          positionStamp: device.stamp,
          position: device.position,
        });
      }
      if (interactable) {
        bw.writeBit(1);
        bw.write(ah.ObjectInteractableComponent.hash, 32);
        ah.ObjectInteractableComponent.encode(bw, {
          mode: interactable.enabled ? 2 : 1,
          filter: interactable.filter ?? UNSET_CLIENT_REF,
          unk2: interactable.used?.stamp ?? 0,
          flag: interactable.used?.value ?? false,
        });
      }
    });
  }

  // 80800620: a vec of predicates, each a present bit, the class's schema id
  // and its body. The row predicate is the single object a slot ref resolves
  // to, the squad one every member of a squad; the combatant type one keeps
  // the combatants of a type, the team one the players on a team and the
  // activity flag one the players holding the flag.
  function encodeObjectFilterAuth(
    items: readonly ObjectFilterItem[] = []
  ): FinishedBits {
    const kept = items.slice(0, MAX_OBJECT_FILTER_PREDICATES);
    const mode = (remove?: boolean) =>
      remove ? FILTER_MODE_REMOVE : FILTER_MODE_ADD;
    return encodeExact((bw) => {
      ah.ObjectFilterAuth.encode(bw, { vec: { count: kept.length } });
      for (const item of kept) {
        bw.writeBit(1);
        switch (item.kind) {
          case "row":
            bw.write(ah.ObjectFilterSlotObject.hash, 32);
            ah.ObjectFilterSlotObject.encode(bw, {
              mode: mode(item.remove),
              ref: item.item,
            });
            break;
          case "squadMembers":
            bw.write(ah.ObjectFilterSquadMembers.hash, 32);
            ah.ObjectFilterSquadMembers.encode(bw, {
              mode: mode(item.remove),
              ref: item.item,
            });
            break;
          case "combatantType":
            bw.write(ah.ObjectFilterCombatantType.hash, 32);
            ah.ObjectFilterCombatantType.encode(bw, {
              mode: FILTER_MODE_ADD,
              typeNameHash: item.typeNameHash >>> 0,
            });
            break;
          case "playersOnTeam":
            bw.write(ah.ObjectFilterPlayersOnTeam.hash, 32);
            ah.ObjectFilterPlayersOnTeam.encode(bw, {
              mode: FILTER_MODE_ADD,
              teamIndex: item.teamIndex,
            });
            break;
          case "activityFlag":
            bw.write(ah.ObjectFilterPlayersWithActivityFlag.hash, 32);
            ah.ObjectFilterPlayersWithActivityFlag.encode(bw, {
              mode: FILTER_MODE_ADD,
              flagNameHash: item.flag >>> 0,
            });
            break;
          default: {
            const unreachable: never = item;
            throw new Error(`ObjectFilter predicate ${String(unreachable)}`);
          }
        }
      }
    });
  }

  // 8080066B: 24 host-owned slot-state bytes the client echoes. Idle is the
  // table present with every slot absent (an absent row leaves the guest at
  // "NO CURRENT OBJECTIVE"); a reset generation re-arms the trigger latch.
  function encodeObjectiveAuth(
    slots: readonly (number | undefined)[] = [],
    resetGeneration?: number
  ): FinishedBits {
    return encodeExact((bw) => {
      ah.ObjectiveAuth.encode(bw, {
        table: {
          values: Array.from({ length: OBJECTIVE_SLOTS }, (_, i) => slots[i]),
        },
        unk1: resetGeneration,
      });
    });
  }

  // 80802DE5: enabled drops loot on kills; a higher epoch destroys the loot
  // already spawned.
  function encodeLootAuth(enabled = true, epoch = 0): FinishedBits {
    return encodeExact((bw) => {
      ah.LootAuth.encode(bw, {
        flag: enabled,
        ref: UNSET_CLIENT_REF,
        unk: epoch,
      });
    });
  }

  // 80800530: a stopped timer, or one counting `seconds` down from `startTick`
  // (the Lua set_rate_multiplier; a plate that loses progress sends a negative
  // one).
  function encodeTimerAuth(run?: {
    progressBar?: boolean;
    rate?: number;
    seconds: number;
    startTick: number;
  }): FinishedBits {
    if (!run) {
      return encodeExact((bw) => {
        ah.TimerAuth.encode(bw, {
          options: zeroActivityOptions(),
          progressBar: false,
          barOffsetSeconds: 0,
        });
      });
    }
    const ticks = Math.round(run.seconds * ACTIVITY_TICKS_PER_SECOND);
    return encodeExact((bw) => {
      ah.TimerAuth.encode(bw, {
        options: {
          running: true,
          min: 0,
          max: ticks,
          elapsedBase: 0,
          remainingBase: ticks,
          epoch: run.startTick,
          rate: run.rate ?? 1,
        },
        progressBar: run.progressBar ?? false,
        barOffsetSeconds: 0,
      });
    });
  }

  // 80800634 (type 24, the hop-on): puts the row's hop-on pattern on every
  // object its ObjectFilter returns. Without a filter the row is idle. Its
  // last member is one kind-33 element read only with no ref; a 0 presence
  // bit is none.
  function encodeHopOnAuth(filter?: SensorClientRefFields): FinishedBits {
    return encodeExact((bw) => {
      ah.Unknown24Auth.encode(bw, {
        flag0: false,
        unk1: 0,
        ref: filter ?? UNSET_CLIENT_REF,
      });
      bw.writeBit(0);
    });
  }

  // The rows the host sends only in their idle form.
  function encodeHardWipeGlobalsAuth(): FinishedBits {
    return encodeExact((bw) => {
      ah.HardWipeGlobalsAuth.encode(bw, { options: emptyActivityOptions() });
    });
  }

  function encodeFireteamAuth(): FinishedBits {
    return encodeExact((bw) => {
      ah.FireteamAuth.encode(bw, {
        key: 0n,
        flag: false,
        nested: { flags: [] },
        unk: 0,
      });
    });
  }

  function encodeSafeZoneAuth(): FinishedBits {
    return encodeExact((bw) => {
      ah.SafeZoneAuth.encode(bw, { ref: UNSET_CLIENT_REF, unk: 0 });
    });
  }

  function encodeHealthAuth(): FinishedBits {
    return encodeExact((bw) => {
      ah.HealthAuth.encode(bw, {
        ref: UNSET_CLIENT_REF,
        unk1: 0,
        unk2: 0,
        unk3: 0,
      });
    });
  }

  // Five empty vecs: 4+4+4+5+2 = 19 bits.
  function encodeScoreboardAuth(): FinishedBits {
    return encodeExact((bw) => {
      ah.ScoreboardAuth.encode(bw, { v0: [], v1: [], v2: [], v3: [], v4: [] });
    });
  }

  // The body a row has before a script writes it, by auth schema. An
  // objective-scoped row goes out with a body or the guest keeps reporting it
  // unreconciled; a player trigger is armed from the start (retail's first
  // dest apply sends every one enabled, stamp 0); a sequence has no playing
  // id (255, not 0: the client logs "host tried to start with an invalid
  // sequence" for 0).
  const IDLE_AUTH: ReadonlyMap<number, () => FinishedBits> = new Map([
    [ah.PlayerAuth.hash, () => encodePlayerAuth(undefined)],
    [ah.LifetimeAuth.hash, () => encodeLifetimeAuth()],
    [ah.HardWipeGlobalsAuth.hash, encodeHardWipeGlobalsAuth],
    [ah.TimerAuth.hash, () => encodeTimerAuth()],
    [ah.FireteamAuth.hash, encodeFireteamAuth],
    [ah.ObjectAuth.hash, () => encodeObjectAuth(0, false)],
    [ah.SafeZoneAuth.hash, encodeSafeZoneAuth],
    [ah.ObjectFilterAuth.hash, () => encodeObjectFilterAuth()],
    [
      ah.SquadAuth.hash,
      () => encodeSquadAuth({ bindingGeneration: 1, roster: [] }),
    ],
    [ah.ActorAuth.hash, () => encodeActorAuth({ place: false })],
    [ah.ObjectiveAuth.hash, () => encodeObjectiveAuth()],
    [ah.SequenceAuth.hash, () => encodeSequenceAuth()],
    [ah.CinematicAuth.hash, () => encodeCinematicAuth(1)],
    [ah.ScoreboardAuth.hash, encodeScoreboardAuth],
    [ah.HealthAuth.hash, encodeHealthAuth],
    [ah.Unknown24Auth.hash, () => encodeHopOnAuth()],
    [ah.PlayerMonitorAuth.hash, () => encodePlayerMonitorAuth()],
    [ah.PlayerTriggerAuth.hash, () => encodePlayerTriggerAuth(true, 0)],
    [
      ah.PlayerObjectiveAuth.hash,
      () => encodePlayerObjectiveAuth({ state: PlayerObjectiveState.None }),
    ],
    [ah.LootAuth.hash, () => encodeLootAuth()],
  ]);

  return {
    encodeActor: encodeActorAuth,
    encodeCinematic: encodeCinematicAuth,
    encodeClientRef,
    // The alpha's row has no flag to set.
    encodeHardWipeGlobals: () => encodeHardWipeGlobalsAuth(),
    encodeHopOn: encodeHopOnAuth,
    encodeLifetime: encodeLifetimeAuth,
    encodeLoot: encodeLootAuth,
    encodeObject: encodeObjectAuth,
    encodeObjectFilter: encodeObjectFilterAuth,
    encodeObjective: encodeObjectiveAuth,
    encodePlayer: encodePlayerAuth,
    encodePlayerMonitor: encodePlayerMonitorAuth,
    encodePlayerObjective: encodePlayerObjectiveAuth,
    encodePlayerTrigger: encodePlayerTriggerAuth,
    encodeSequence: encodeSequenceAuth,
    encodeSquad: encodeSquadAuth,
    encodeTimer: encodeTimerAuth,
    idleAuth(schema: number): FinishedBits | undefined {
      const idle = IDLE_AUTH.get(schema >>> 0);
      if (!idle) {
        if (!missingIdleAuth.has(schema)) {
          missingIdleAuth.add(schema);
          event_error(
            "activities:host: sensor auth: no idle auth for 0x%x; its rows are left out of the apply",
            schema
          );
        }
        return;
      }
      return idle();
    },
    // The alpha's update starts at the authority table bit.
    leadsWithDomain: false,
    // The alpha's lifetime states are the scripts' own: running is 2.
    lifetimeStates: { active: 2, ended: 6, none: 0, pregame: 0, shift: 0 },
    // The alpha adopts no player sense, so there is no request to withhold.
    withholdRespawn: (state2: ReportedPlayerState | undefined) => state2,
    samePlayerState: (
      a: ReportedPlayerState | undefined,
      b: ReportedPlayerState
    ) => a !== undefined && JSON.stringify(a) === JSON.stringify(b),
  } satisfies Omit<SensorWire, "sense">;
}
