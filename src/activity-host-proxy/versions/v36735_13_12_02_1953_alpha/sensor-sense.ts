import type { BitReader } from "@blamnetwork/rsat";
import type { SenseWire } from "../activity-host-build";
import type { AhSchemas } from "./ah";

// The sense schemas' decoders, by schema id. An Object row's sense is a fixed
// head and then its component vec: each of `vec.count` slots is a 1-bit present
// flag, a 32-bit schema id and the payload in that schema (the same encoding
// the Object auth's vec uses). A payload's length is only known from its
// schema, so a component of a schema this doesn't list throws and the walk
// resumes at the next row header, which drops every component of the row.
export function createSenseWire(ah: AhSchemas): SenseWire {
  type Decoded<K extends keyof AhSchemas> = AhSchemas[K] extends {
    decode(br: BitReader): infer T;
  }
    ? T
    : never;

  type ObjectSenseDecoded = Decoded<"ObjectSense"> & {
    interactable?: Decoded<"ObjectInteractableSense">;
  };

  const objectSenseWithComponents = {
    decode(br: BitReader) {
      const base = ah.ObjectSense.decode(br);
      let capturable: Decoded<"ObjectCapturableSense"> | undefined;
      let device: Decoded<"ObjectDeviceSense"> | undefined;
      let faction: number | undefined;
      let interactable: Decoded<"ObjectInteractableSense"> | undefined;
      for (let i = 0; i < (base.vec?.count ?? 0); i++) {
        if (!br.readBit()) {
          continue;
        }
        const tag = br.readNumber(32) >>> 0;
        if (tag === ah.ObjectCapturableSense.hash >>> 0) {
          capturable = ah.ObjectCapturableSense.decode(br);
        } else if (tag === ah.ObjectFactionSense.hash >>> 0) {
          faction = ah.ObjectFactionSense.decode(br).faction;
        } else if (tag === ah.ObjectDeviceSense.hash >>> 0) {
          device = ah.ObjectDeviceSense.decode(br);
        } else if (tag === ah.ObjectInteractableSense.hash >>> 0) {
          interactable = ah.ObjectInteractableSense.decode(br);
        } else if (tag === ah.Hash80802D98.hash >>> 0) {
          ah.Hash80802D98.decode(br);
        } else {
          throw new Error(
            `unknown object sense component 0x${tag.toString(16)}`
          );
        }
      }
      return { ...base, capturable, device, faction, interactable };
    },
  };

  return {
    // The update starts at the initial-update bit.
    leadsWithByte: false,
    readClientRef: (br) => ah.SensorClientRef.decode(br),
    resyncs: true,
    decoders: new Map<number, { decode(br: BitReader): unknown }>([
      [ah.PlayerSense.hash, ah.PlayerSense],
      [ah.SquadSense.hash, ah.SquadSense],
      [ah.ActorSense.hash, ah.ActorSense],
      [ah.ObjectiveSense.hash, ah.ObjectiveSense],
      [ah.ObjectSense.hash, objectSenseWithComponents],
      [ah.HealthSense.hash, ah.HealthSense],
      [ah.Unknown24Sense.hash, ah.Unknown24Sense],
      [ah.SafeZoneSense.hash, ah.SafeZoneSense],
      [ah.PlayerMonitorSense.hash, ah.PlayerMonitorSense],
      [ah.TeamPickerSense.hash, ah.TeamPickerSense],
    ]),

    // PlayerMonitor sense: unk2 counts the players inside, the flags are the
    // any / all predicates.
    monitorCount: (sense) => (sense as Decoded<"PlayerMonitorSense">).unk2 ?? 0,

    // Squad sense: unk4 is the live member count the guest reports.
    squadAlive: (sense) => (sense as Decoded<"SquadSense">).unk4,

    // Squad sense: the roster is the current epoch's tally per cell.
    squadTally: (sense) => {
      const roster = (sense as Decoded<"SquadSense">).roster;
      return roster && [...roster.slots];
    },

    // ActorSense f7 is spent (a failed or cancelled placement, or death,
    // cleared by the next epoch) and f8 the auth-received gate.
    actorBound: (sense) => {
      const actor = sense as Decoded<"ActorSense">;
      return {
        unknown9: actor.flag7 ?? false,
        unknown10: actor.flag8 ?? false,
      };
    },

    // ActorSense f3 (808006A2): the PC the command script has reached, the
    // cookie it runs and a heartbeat the runner bumps every 2.5 s while PC is
    // short of the count (flat when a cookie was latched but never primed).
    actorCommandScript: (sense) => {
      const script = (sense as Decoded<"ActorSense">).nest3;
      return (
        script && {
          cookieRunning: script.f1,
          heartbeat: script.f2,
          pcReached: script.f0,
        }
      );
    },

    // ActorSense f4 is the drop id the client has kicked off, and f5 is 1
    // from the drop's start until it logs "drop #N complete".
    actorDrop: (sense) => {
      const actor = sense as Decoded<"ActorSense">;
      return { dropId: actor.unk4, inProgress: actor.unk5 === 1 };
    },

    // 80802DA3: the client's used latch and its stamp.
    interactable: (sense) => {
      const used = (sense as ObjectSenseDecoded).interactable;
      return used && { used: used.used, usedStamp: used.usedStamp };
    },

    objectAlive: (sense) => (sense as ObjectSenseDecoded).alive,

    health: (sense) => {
      const health = sense as Decoded<"HealthSense">;
      return { current: health.unk0, max: health.unk1 };
    },

    // The alpha's player row sense is the client's view of its own entity,
    // not a state the host adopts.
    playerReport: () => undefined,
  };
}
