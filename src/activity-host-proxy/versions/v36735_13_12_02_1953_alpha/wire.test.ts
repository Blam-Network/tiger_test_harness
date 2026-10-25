import { BitReader, BitWriter, decode, encode } from "@blamnetwork/rsat";
import { beforeAll, describe, expect, it } from "vitest";
import { e_build } from "../../../builds";
import { describeBuild } from "../../../test-support/build";
import type { AlphaActivityHostBuild } from ".";

const MACHINE = Buffer.from("7c1e52a389ce", "hex");
const IDENTITY = {
  machine: MACHINE,
  player: Buffer.from("7081b90432aa3b8a", "hex"),
  account: 0x1_00_00_00_01n,
  character: 0x2_00_00_00_02n,
};
const JOIN = { ...IDENTITY, nonce: 0xb1_e4_9c_23, sessionId: 1n };

// The alpha's activity host wire, through the build-neutral entry points.
describeBuild(
  e_build.v36735_13_12_02_1953_alpha,
  "alpha activity host wire",
  () => {
    let build: AlphaActivityHostBuild;
    let join: typeof import("../../join");
    let notification: typeof import("../../notification");
    let sensorAuth: typeof import("../../rsat/sensor-auth-fields");
    let membership: typeof import("../../rsat/membership");
    let gas: typeof import("../../rsat/global-activity-state");
    let clientReports: typeof import("../../rsat/client-reports");
    let sensorSense: typeof import("../../rsat/sensor-sense");

    beforeAll(async () => {
      const { activityHostBuild } = await import("..");
      build = activityHostBuild() as AlphaActivityHostBuild;
      join = await import("../../join");
      notification = await import("../../notification");
      sensorAuth = await import("../../rsat/sensor-auth-fields");
      membership = await import("../../rsat/membership");
      gas = await import("../../rsat/global-activity-state");
      clientReports = await import("../../rsat/client-reports");
      sensorSense = await import("../../rsat/sensor-sense");
    });

    describe("join", () => {
      it("reads a 6-byte machine and no member past the account and character", () => {
        expect(build.machineIdBytes).toBe(6);
        expect(join.parseJoinRequest(join.encodeJoinRequest(JOIN))).toEqual(
          JOIN
        );
      });

      it("accepts with result 0 and names the session", () => {
        const result = decode(
          build.ah.JoinResult,
          join.buildJoinResultRsat(join.encodeJoinRequest(JOIN))
        );
        expect(result.result).toBe(0);
        expect(result.request.nonce >>> 0).toBe(JOIN.nonce);
        expect(result.request.sessionId).toBe(1n);
        expect(result.replicationEpoch).toBe(1);
        expect(result.activityTime).toBe(0);
        expect(
          result.sessionDisplay.chars
            .map((code) => (code ? String.fromCharCode(code) : ""))
            .join("")
        ).toBe("00000000:00000001");
      });
    });

    describe("notification header", () => {
      // Wire 8: frame session, variant 1, kind 3, length, then the payload,
      // with no fourth word.
      it("reads the client join-request envelope", () => {
        const payload = Buffer.alloc(0xe8, 0xab);
        const body = Buffer.concat([
          Buffer.from("947aec531717dc140100000003000000e8", "hex"),
          payload,
        ]);
        const parsed = notification.parseClientToActivityHostNotification(body);
        expect(parsed?.sessionId).toBe(0x94_7a_ec_53_17_17_dc_14n);
        expect(parsed?.variant).toBe(1);
        expect(parsed?.kind).toBe(3);
        expect(parsed?.payload).toEqual(payload);
        expect(build.notificationHeader.clientToHost.size).toBe(17);
      });

      it("builds the inner notification the client decoder expects", () => {
        const payload = Buffer.from("aabbccdd", "hex");
        const body = notification.buildActivityHostToClientNotification(
          1n,
          4,
          payload
        );
        expect(body[0]).toBe(1);
        expect(body.readBigUInt64BE(1)).toBe(1n);
        expect(body.readUInt32BE(9)).toBe(4);
        expect(body.readUInt32BE(13)).toBe(4);
        expect(body.subarray(17)).toEqual(payload);
        expect(
          notification.parseActivityHostToClientNotification(body)
        ).toEqual({ sessionId: 1n, variant: 1, kind: 4, payload });
      });
    });

    describe("global activity state", () => {
      it("states the activity, valid and a scenario, not draining", () => {
        const state = decode(
          build.ah.GlobalActivityState,
          gas.buildGlobalActivityStateRsat({
            instanceId: 7n,
            bubbleCount: 30,
            emptyBubbles: [11],
            activityId: 4,
            activityName: "venus_portal_1",
          })
        );
        expect(state.valid).toBe(true);
        expect(state.scenario).toBe(true);
        expect(state.draining).toBe(false);
        expect(state.instanceId).toBe(7n);
        expect(state.bubbleCount).toBe(30);
        expect(state.bubbleStates.states[0]).toBe(0);
        expect(state.bubbleStates.states[11]).toBe(-1);
        expect(state.world.activityId).toBe(4);
        expect(
          String.fromCharCode(...state.world.activityName.chars.filter(Boolean))
        ).toBe("venus_portal_1");
      });

      // The alpha's client keeps its own day length, so the instance's start
      // time is not sent.
      it("keeps a fixed time of day, whatever start the instance reports", () => {
        const world = (worldServerTime?: bigint) =>
          decode(
            build.ah.GlobalActivityState,
            gas.buildGlobalActivityStateRsat({
              instanceId: 1n,
              worldServerTime,
            })
          ).world.worldServerTime;
        expect(world(1_790_780_594n)).toBe(world());
      });

      it("sends the world globals tick", () => {
        const globals = decode(
          build.ah.WorldGlobalsState,
          gas.buildWorldGlobalsStateRsat()
        );
        expect(globals.valid).toBe(true);
        expect(globals.tickDurationMs).toBeGreaterThan(0);
      });
    });

    describe("membership", () => {
      it("states a lone member in slot 0 with the masks", () => {
        const parsed = build.membership.decode(
          membership.buildReplicateMembershipRsat(IDENTITY)
        );
        expect(parsed?.generation).toBe(1);
        expect(parsed?.occupiedMask).toBe(1);
        expect(parsed?.machineMask).toBe(1);
        expect(parsed?.clients.slots).toHaveLength(20);
        expect(parsed?.clients.slots[0]?.identity).toEqual({
          machine: IDENTITY.machine,
          player: IDENTITY.player,
          account: IDENTITY.account,
          character: IDENTITY.character,
        });
        expect(parsed?.clients.slots[1]?.identity).toBeUndefined();
        const rows = parsed?.pahRegions?.table.rows ?? [];
        expect(rows).toHaveLength(40);
        expect(rows[0]?.regionId).toBe(0);
        expect(rows[39]?.regionId).toBe(-1);
      });

      it("refuses an 8-byte machine id", () => {
        expect(() =>
          membership.buildReplicateMembershipRsat({
            ...IDENTITY,
            machine: Buffer.alloc(8),
          })
        ).toThrow(/must be 6 bytes/);
      });

      it("stamps the pending region's row with the member's own token", () => {
        const payload = membership.buildReplicateMembershipRsat(
          [
            {
              identity: IDENTITY,
              slot: 2,
              pendingRegion: { regionId: 128, token: 5 },
            },
          ],
          { bubbleCount: 30, initialBubble: 3 }
        );
        const parsed = build.membership.decode(payload);
        expect(parsed?.occupiedMask).toBe(1 << 2);
        const row = parsed?.pahRegions?.table.rows.find(
          (r) => r.regionId === 128
        );
        expect(row?.public.peerSlots.markers[2]).toBe(5);
        expect(row?.peerMask).toBe(1 << 2);
      });

      it("keeps neither the client's data nor private-activity rows", () => {
        expect(build.membership.echoesClientData).toBe(false);
        expect(build.membership.privateActivityRows).toBe(false);
        const parsed = build.membership.decode(
          membership.buildReplicateMembershipRsat(
            [
              {
                identity: IDENTITY,
                slot: 0,
                clientAuth: { unknown2: 1n },
                clientTransition: { token: 1 },
              },
            ],
            { privateActivity: true }
          )
        );
        expect(parsed?.clients.slots[0]?.auth).toBeUndefined();
      });

      it("lays the host teleportation out as active, last and target", () => {
        const teleportation = (state: number) => {
          const br = new BitReader(
            membership.buildReplicateMembershipRsat(IDENTITY, {
              teleport: { id: 2, region: 112, state, transition: 0 },
            })
          );
          br.readBit();
          return build.ah.ReplicateMembership.decode(br).pahRegions?.unknown1;
        };
        const running = teleportation(1);
        expect(running?.a).toBe(1);
        expect(running?.right).toMatchObject({ a: 2, b: 112 });
        expect(running?.left).toMatchObject({ a: 0, b: 0 });
        const done = teleportation(0);
        expect(done?.a).toBe(0);
        expect(done?.left).toEqual(done?.right);
      });

      it("lays the host hard wipe out as cookie, completed cookie and state", () => {
        const hardWipe = (wipe?: {
          completedCookie: number;
          cookie: number;
          state: number;
        }) => {
          const br = new BitReader(
            membership.buildReplicateMembershipRsat(IDENTITY, {
              hardWipe: wipe,
            })
          );
          br.readBit();
          return build.ah.ReplicateMembership.decode(br).pahRegions?.hardWipe;
        };
        expect(hardWipe()).toEqual({
          completedCookie: 0,
          cookie: 0,
          state: 0,
        });
        for (const state of [0, 1, 2, 3]) {
          const wipe = { completedCookie: 254, cookie: 255, state };
          expect(hardWipe(wipe)).toEqual(wipe);
        }
      });
    });

    describe("client reports", () => {
      const region = (regionId: number) => ({
        regionId,
        unknown1: 0x12_34,
        public: 1,
        ackedRevokeToken: 0,
        citizen: {
          unknown0: 0,
          connectionState: 1,
          advertised: {
            session: { bytes: Buffer.alloc(8) },
            pad: { bytes: Buffer.alloc(36) },
            activityHost: { bytes: Buffer.alloc(16) },
          },
          activityHostId: 0n,
        },
      });
      const update = (fields: Record<string, unknown>) =>
        encode(build.ah.ClientAuthoritativeData, {
          anyUpdate: true,
          identity: undefined,
          transition: undefined,
          hardWipe: undefined,
          teleport: undefined,
          ...fields,
        } as never);

      it("reads the transition's regions, token and phase, and echoes nothing", () => {
        const report = clientReports.parseClientAuthoritativeData(
          update({
            transition: {
              current: region(24),
              pending: region(128),
              spawnName: undefined,
              token: 3,
              props: 1,
              phase: 2,
            },
          })
        );
        expect(report?.transition).toEqual({
          current: { regionId: 24, unknown1: 0x12_34 },
          pending: { regionId: 128, unknown1: 0x12_34 },
          token: 3,
          props: 1,
          phase: 2,
        });
        expect(report?.echo).toBeUndefined();
      });

      it("reads the client's teleportation as id, region and state", () => {
        const report = clientReports.parseClientAuthoritativeData(
          update({
            teleport: {
              unknown0: 3,
              target: { a: 2, b: 112, c: 7, d: 0 },
              unknown2: 0,
            },
          })
        );
        expect(report?.teleport).toEqual({ id: 2, region: 112, state: 3 });
      });

      // The state is an i8 of 3 bits biased by 1: read unbiased, every state
      // came out one too high.
      it("reads the client's hard wipe with its state, cookies and start time", () => {
        for (const state of [0, 1, 2, 3]) {
          const wipe = {
            currentCookie: 255,
            lastCookie: 254,
            startTime: 1234,
            state,
          };
          const report = clientReports.parseClientAuthoritativeData(
            update({ hardWipe: wipe })
          );
          expect(report?.hardWipe).toEqual(wipe);
        }
        expect(
          clientReports.parseClientAuthoritativeData(update({}))?.hardWipe
        ).toBeUndefined();
      });

      it("writes the hard wipe state one above its value", () => {
        const wire = (state: number) => {
          const br = new BitReader(
            Buffer.from(
              update({
                hardWipe: {
                  currentCookie: 0,
                  lastCookie: 0,
                  startTime: 0,
                  state,
                },
              })
            )
          );
          // the update bit, then identity, transition and hard wipe present
          expect([
            br.readBit(),
            br.readBit(),
            br.readBit(),
            br.readBit(),
          ]).toEqual([1, 0, 0, 1]);
          return br.readNumber(3);
        };
        expect([0, 1, 2, 3].map(wire)).toEqual([1, 2, 3, 4]);
      });

      it("reads a body without the update bit as no update", () => {
        expect(
          clientReports.parseClientAuthoritativeData(Buffer.from([0x00]))
            ?.anyUpdate
        ).toBe(false);
      });
    });

    describe("sensor auth framing", () => {
      it("frames a keepalive as time only, with no domain byte", () => {
        expect(build.sensor.leadsWithDomain).toBe(false);
        const payload = sensorAuth.buildSensorAuthTickRsat(44);
        expect(payload.length).toBeLessThanOrEqual(6);
        const br = new BitReader(payload);
        expect(br.readBit()).toBe(0);
        expect(br.readNumber(32)).toBe(44);
        expect(br.readBit()).toBe(0);
      });

      it("promotes the bubbles and the domain slot, stamped with the 6-byte machine", () => {
        const payload = sensorAuth.buildSensorAuthUpdateRsat({
          activityTime: 9,
          authorityMachine: MACHINE,
          bubbleCount: 30,
          occupiedBubbles: [16],
          promoteSeq: 1,
        });
        const br = new BitReader(payload);
        expect(br.readBit()).toBe(1);
        const promoted: number[] = [];
        for (let i = 0; i < 65; i++) {
          if (br.readBit() === 1) {
            promoted.push(i);
          }
        }
        expect(promoted).toEqual([16, 64]);
        expect(br.readBit()).toBe(1);
        // Authority option: header bit, then per slot stamp?/1/seq16/0.
        expect(br.readBit()).toBe(0);
        for (let i = 0; i < 65; i++) {
          const stamped = br.readBit();
          expect(stamped).toBe(promoted.includes(i) ? 1 : 0);
          if (stamped) {
            const stamp = Buffer.from(
              Array.from({ length: 6 }, () => br.readNumber(8))
            );
            expect(stamp).toEqual(MACHINE);
          }
          expect(br.readBit()).toBe(1);
          expect(br.readNumber(16)).toBe(promoted.includes(i) ? 1 : 0);
          expect(br.readBit()).toBe(0);
        }
        expect(br.readNumber(32)).toBe(9);
        expect(br.readBit()).toBe(0);
      });

      it("drops the sense rows and keeps the table and time", () => {
        const fields = {
          activityTime: 7,
          authorityMachine: MACHINE,
          bubbleCount: 30,
          occupiedBubbles: [16],
        };
        const bare = sensorAuth.buildSensorAuthUpdateRsat(fields);
        const full = sensorAuth.buildSensorAuthUpdateRsat({
          ...fields,
          senseEntries: [
            sensorAuth.entryOn(
              0x40_ae_bf_90,
              16,
              2,
              sensorAuth.encodeLifetimeAuth(),
              false
            ),
          ],
        });
        expect(full.length).toBeGreaterThan(bare.length);
        expect(sensorAuth.withoutSenseRows(full)).toEqual(bare);
      });
    });

    describe("sensor auth bodies", () => {
      it("encodes a client ref as 54 bits", () => {
        const bits = build.sensor.encodeClientRef({
          bundle: 0x40_ae_bf_90,
          typeId: 12,
          typeIndex: 4,
        });
        expect(bits.bitCount).toBe(54);
        const parsed = decode(build.ah.SensorClientRef, bits.bytes);
        expect(parsed.bundle >>> 0).toBe(0x40_ae_bf_90);
        expect(parsed.typeId).toBe(12);
        expect(parsed.typeIndex).toBe(4);
      });

      it("encodes player auth as 174 bits with the identity key", () => {
        const key = 0x0000_0002_0000_0002n;
        const bits = sensorAuth.encodePlayerAuth({ key });
        expect(bits.bitCount).toBe(174);
        expect(decode(build.ah.PlayerAuth, bits.bytes).key).toBe(key);
      });

      it("encodes lifetime auth as 106 bits with the running state 2", () => {
        const bits = sensorAuth.encodeLifetimeAuth();
        expect(bits.bitCount).toBe(106);
        const parsed = decode(build.ah.LifetimeAuth, bits.bytes);
        expect(parsed.state).toBe(2);
        expect(parsed.flag1).toBe(true);
        expect(parsed.phaseIndex).toBe(0);
        expect(parsed.phaseHash >>> 0).toBe(0x81_1c_9d_c5);
        expect(parsed.field4).toBe(21);
      });

      it("carries the script's lifetime state and join flag as sent", () => {
        const parsed = decode(
          build.ah.LifetimeAuth,
          sensorAuth.encodeLifetimeAuth(5, false).bytes
        );
        expect(parsed.state).toBe(5);
        expect(parsed.flag1).toBe(false);
        expect(parsed.optionOverrides).toEqual({ handles: [] });
        expect(build.sensor.lifetimeStates).toEqual({
          active: 2,
          ended: 6,
          none: 0,
          pregame: 0,
          shift: 0,
        });
      });

      // Field 0 is the state, 3 bits biased by 1.
      it("writes each objective state as state + 1 in 3 bits", () => {
        const bitCounts = new Set<number>();
        for (const state of [
          sensorAuth.PlayerObjectiveState.None,
          sensorAuth.PlayerObjectiveState.Incoming,
          sensorAuth.PlayerObjectiveState.Active,
          sensorAuth.PlayerObjectiveState.Complete,
          sensorAuth.PlayerObjectiveState.Failed,
        ]) {
          const bits = sensorAuth.encodePlayerObjectiveAuth({ state });
          bitCounts.add(bits.bitCount);
          expect(bits.bytes[0]! >> 5).toBe(state + 1);
        }
        expect(bitCounts.size).toBe(1);
      });

      // venus_chapter_2's warpgates filter keeps the gates' combatant type and
      // drops a gate's squad as its turn comes.
      it("encodes each ObjectFilter predicate by its class, with its mode", () => {
        const squad = { bundle: 0x51_76_41_f1, typeId: 1, typeIndex: 69 };
        const bits = sensorAuth.encodeObjectFilterAuth([
          { kind: "combatantType", typeNameHash: 0x3e_a0_3d_56 },
          { kind: "squadMembers", item: squad, remove: true },
          { kind: "playersOnTeam", teamIndex: 1 },
          { kind: "activityFlag", flag: 0x2f_41_bc_62 },
        ]);
        const br = new BitReader(bits.bytes);
        expect(build.ah.ObjectFilterAuth.decode(br).vec.count).toBe(4);
        const next = () => {
          expect(br.readBit()).toBe(1);
          return br.readNumber(32) >>> 0;
        };
        expect(next()).toBe(build.ah.ObjectFilterCombatantType.hash);
        expect(build.ah.ObjectFilterCombatantType.decode(br)).toEqual({
          mode: 0,
          typeNameHash: 0x3e_a0_3d_56,
        });
        expect(next()).toBe(build.ah.ObjectFilterSquadMembers.hash);
        expect(build.ah.ObjectFilterSquadMembers.decode(br)).toEqual({
          mode: 1,
          ref: squad,
        });
        expect(next()).toBe(build.ah.ObjectFilterPlayersOnTeam.hash);
        expect(build.ah.ObjectFilterPlayersOnTeam.decode(br)).toEqual({
          mode: 0,
          teamIndex: 1,
        });
        expect(next()).toBe(build.ah.ObjectFilterPlayersWithActivityFlag.hash);
        expect(build.ah.ObjectFilterPlayersWithActivityFlag.decode(br)).toEqual(
          { flagNameHash: 0x2f_41_bc_62, mode: 0 }
        );
      });

      it("has no TriggerGroup or Machine rows", () => {
        expect(build.sensor.encodeTriggerGroup).toBeUndefined();
        expect(build.sensor.encodeMachine).toBeUndefined();
        expect(() => sensorAuth.encodeTriggerGroupAuth()).toThrow(
          /no TriggerGroup/
        );
        expect(() => sensorAuth.encodeMachineAuth()).toThrow(/no Machine/);
      });
    });

    describe("sensor sense", () => {
      const BUNDLE = 0xf7_bd_87_18;
      const SAFE_ZONE = 27;
      const SAFE_ZONE_SENSE = 0x80_80_06_5d;
      const schemaFor = (_bundle: number, typeId: number) =>
        typeId === SAFE_ZONE ? SAFE_ZONE_SENSE : undefined;

      // A row as the client frames it: the next-row bit, the ref, the update
      // bit and body, then the u32 sequence.
      function row(
        bw: BitWriter,
        typeId: number,
        body: (bw: BitWriter) => void,
        sequence: number
      ) {
        bw.writeBit(1);
        build.ah.SensorClientRef.encode(bw, {
          bundle: BUNDLE,
          typeId,
          typeIndex: 1,
        });
        bw.writeBit(1);
        body(bw);
        bw.write(sequence, 32);
      }

      it("reads rows from the first bit, no leading byte", () => {
        expect(build.sensor.sense.leadsWithByte).toBe(false);
        const bw = new BitWriter(1024);
        bw.writeBit(0);
        bw.writeBit(0);
        row(
          bw,
          SAFE_ZONE,
          (w) => build.ah.SafeZoneSense.encode(w, { inside: 1, cookie: 2 }),
          7
        );
        bw.writeBit(0);
        const peek = sensorSense.peekSensorSenseUpdate(bw.finish(), schemaFor);
        expect(peek.truncated).toBe(false);
        expect(peek.rows).toHaveLength(1);
        expect(peek.rows[0]).toMatchObject({
          typeId: SAFE_ZONE,
          sequence: 7,
          sense: { inside: 1, cookie: 2 },
        });
      });

      // How far a Fallen dropship's pilot has got: the PC and cookie of its
      // command script, and the drop it has taken.
      it("reads an actor's command script progress and drop", () => {
        const ACTOR = 2;
        const bw = new BitWriter(1024);
        bw.writeBit(0);
        bw.writeBit(0);
        row(
          bw,
          ACTOR,
          (w) =>
            build.ah.ActorSense.encode(w, {
              unk0: undefined,
              unk1: undefined,
              unk2: undefined,
              nest3: { f0: 3, f1: 2, f2: 7, f3: false },
              unk4: 5,
              unk5: 1,
              unk6: undefined,
              flag7: false,
              flag8: true,
            }),
          11
        );
        bw.writeBit(0);
        const peek = sensorSense.peekSensorSenseUpdate(bw.finish(), (_b, t) =>
          t === ACTOR ? build.ah.ActorSense.hash : undefined
        );
        expect(sensorSense.actorCommandScriptProgress(peek)).toEqual([
          {
            bundle: BUNDLE,
            cookieRunning: 2,
            heartbeat: 7,
            pcReached: 3,
            typeIndex: 1,
          },
        ]);
        expect(sensorSense.actorDropAcks(peek)).toEqual([
          { bundle: BUNDLE, dropId: 5, inProgress: true, typeIndex: 1 },
        ]);
      });

      it("resyncs at the next row header after an undecodable body", () => {
        // A row of a type with no sense schema and a 13-bit garbage body,
        // then a row that must still decode.
        const bw = new BitWriter(1024);
        bw.writeBit(0);
        bw.writeBit(0);
        row(bw, 9, (w) => w.write(0x1a_5b, 13), 9);
        row(
          bw,
          SAFE_ZONE,
          (w) => build.ah.SafeZoneSense.encode(w, { inside: 3, cookie: 4 }),
          10
        );
        bw.writeBit(0);
        const peek = sensorSense.peekSensorSenseUpdate(bw.finish(), schemaFor);
        expect(build.sensor.sense.resyncs).toBe(true);
        expect(peek.truncated).toBe(true);
        expect(peek.rows.map((r) => r.typeId)).toEqual([9, SAFE_ZONE]);
        expect(peek.rows[1]).toMatchObject({
          sequence: 10,
          sense: { inside: 3, cookie: 4 },
        });
      });
    });
  }
);
