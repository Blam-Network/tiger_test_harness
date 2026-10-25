import type { BitReader } from "@blamnetwork/rsat";
import type { SenseWire } from "../activity-host-build";
import type { AhSchemas } from "./ah";

// Sense schema id -> decoder. The player sense 808023C6 has the player
// auth's members.
export function createSenseWire(ah: AhSchemas): SenseWire {
  type Decoded<K extends keyof AhSchemas> = ReturnType<AhSchemas[K]["decode"]>;
  return {
    // No lead byte: the Tower's first sense update parses to its rows from
    // the first bit.
    leadsWithByte: false,
    readClientRef: (br) => ah.SensorClientRef.decode(br),
    resyncs: false,
    decoders: new Map<number, { decode(br: BitReader): unknown }>([
      [0x80_80_23_c6, ah.PlayerAuth],
      [0x80_80_07_97, ah.SquadSense],
      [0x80_80_05_af, ah.ActorSense],
      [0x80_80_05_99, ah.PlayerMonitorSense],
      [0x80_80_08_0f, ah.ObjectiveSense],
      [0x80_80_03_5c, ah.ObjectSense],
      [0x80_80_04_60, ah.HopOnSense],
      [0x80_80_22_a0, ah.Type37Sense],
    ]),

    monitorCount: (sense) => (sense as Decoded<"PlayerMonitorSense">).count,

    // ObjectSense [4]'s 808027D3: the device the client holds, its stamps
    // ours once it has taken our write.
    objectDevice: (sense) => {
      const device = (sense as Decoded<"ObjectSense">).components.unknown0.find(
        (component) => component?.schema === ah.ObjectDeviceSense.hash >>> 0
      )?.value as Decoded<"ObjectDeviceSense"> | undefined;
      return (
        device && {
          position: device.position,
          positionStamp: device.positionStamp,
        }
      );
    },

    // Squad sense [3]: members at their firing area, not a live count (a
    // squad killed on the way in never reports it above 0).
    squadAlive: (sense) => (sense as Decoded<"SquadSense">).alive,

    // Squad sense [10]: the per-cell death tally of the squad's current epoch.
    squadTally: (sense) => {
      const tally = (sense as Decoded<"SquadSense">).tally;
      return tally && [...tally.cells];
    },

    // ActorSense [9] is the "spent" edge and [10] is true from the spawn.
    actorBound: (sense) => {
      const actor = sense as Decoded<"ActorSense">;
      return { unknown9: actor.unknown9, unknown10: actor.unknown10 };
    },

    // The sense's first member's second bool ([3]) is taken for 40662's third,
    // the client's player being dead (retail captures: true 0.07 s after the
    // player_died incident, false after the respawn).
    playerReport: (sense) => {
      const player = sense as Decoded<"PlayerAuth">;
      return {
        dead: player.unknown0.unknown3,
        state: player.unknown0,
        state2: player.unknown1,
      };
    },
  };
}
