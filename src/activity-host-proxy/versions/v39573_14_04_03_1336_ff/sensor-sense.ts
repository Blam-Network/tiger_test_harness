import type { BitReader } from "@blamnetwork/rsat";
import type { SenseWire } from "../activity-host-build";
import type { AhSchemas } from "./ah";

// Sense schema id -> decoder. The player sense 80802C30 has the player
// auth's members.
export function createSenseWire(ah: AhSchemas): SenseWire {
  type Decoded<K extends keyof AhSchemas> = ReturnType<AhSchemas[K]["decode"]>;
  return {
    // No lead byte: the client's sense update writer (0x1866560) starts with
    // the initial bit, then the rows.

    leadsWithByte: false,
    readClientRef: (br) => ah.SensorClientRef.decode(br),
    resyncs: false,
    decoders: new Map<number, { decode(br: BitReader): unknown }>([
      [0x80_80_2c_30, ah.PlayerAuth],
      [0x80_80_03_57, ah.SquadSense],
      [0x80_80_05_d9, ah.ActorSense],
      [0x80_80_05_c3, ah.PlayerMonitorSense],
      [0x80_80_08_30, ah.ObjectiveSense],
      [0x80_80_03_87, ah.ObjectSense],
      [0x80_80_04_8a, ah.HopOnSense],
      [0x80_80_22_8d, ah.Type37Sense],
    ]),

    monitorCount: (sense) => (sense as Decoded<"PlayerMonitorSense">).count,

    // ObjectSense [4]'s 80802A74: the device the client holds, its stamps
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

    // Squad sense [8]: the per-cell death tally of the squad's current epoch.
    squadTally: (sense) => {
      const tally = (sense as Decoded<"SquadSense">).tally;
      return tally && [...tally.cells];
    },

    // ActorSense [9] is the "spent" edge and [10] is true from the spawn.
    actorBound: (sense) => {
      const actor = sense as Decoded<"ActorSense">;
      return { unknown9: actor.unknown9, unknown10: actor.unknown10 };
    },

    // ActorSense [0] echoes the auth's epoch; [1], [7] and [8] are written only
    // while the combatant has an actor (ff sub_1631FC0), so a placement the
    // client deferred takes the auth ([10]) without them.
    actorStanding: (sense) => {
      const actor = sense as Decoded<"ActorSense">;
      return {
        epoch: actor.unknown0,
        standing:
          actor.unknown1 !== undefined ||
          actor.unknown7 !== undefined ||
          actor.unknown8 !== undefined,
      };
    },

    // ActorSense [3] (8080038A), as the alpha's: the PC the command script
    // has reached, the cookie it runs and the runner's heartbeat, each sent
    // only when it moves (2.3.1 capture, cosmo_portal_1's Walker skiff: cookie
    // 1 at PC 1 on the placement, PC 4 of 4 as it reaches the drop, cookie 2
    // at PC 0 with its exit).
    actorCommandScript: (sense) => {
      const script = (sense as Decoded<"ActorSense">).unknown3;
      return (
        script && {
          cookieRunning: script.unknown1,
          heartbeat: script.unknown2,
          pcReached: script.unknown0,
        }
      );
    },

    // The sense's first member's third bool ([4]), as 40662's, is the
    // client's player being dead (retail captures: true 0.07 s after the
    // player_died incident, false after the respawn).
    playerReport: (sense) => {
      const player = sense as Decoded<"PlayerAuth">;
      return {
        dead: player.unknown0.unknown4,

        state: player.unknown0,
        state2: player.unknown1,
      };
    },
  };
}
