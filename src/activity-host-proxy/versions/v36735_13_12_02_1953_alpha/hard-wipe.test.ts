import { Socket } from "node:net";
import { events_dispose } from "@blamnetwork/datamine";
import { BitReader, encode } from "@blamnetwork/rsat";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { e_build } from "../../../builds";
import { buildPackagesDir, describeBuild } from "../../../test-support/build";
import { captureEvents } from "../../../test-support/capture-events";
import type { AlphaActivityHostBuild } from ".";

// A hard wipe through a session, on venus_chapter_2's first mission and the
// alpha's disc tables: a fake client reports its wipe screen as the alpha's
// client does, and the session walks the host's nest and resets the phase
// behind it. No script says @hard_wipe() yet, so the tests arm the running
// phase themselves.

const packages = buildPackagesDir(e_build.v36735_13_12_02_1953_alpha);

const FAH_ID = 0xd6_89_de_74_43_e9_d2_6cn;
const GAH_ID = 0x94_c0_2d_fa_66_22_08_3en;
const IDENTITY = {
  account: 0x1_00_00_00_04n,
  character: 0x2_00_00_00_0bn,
  machine: Buffer.from("7ced8da3e108", "hex"),
  player: Buffer.from("0507d1a018bc21f9", "hex"),
};
const OTHER = {
  account: 0x1_00_00_00_05n,
  character: 0x2_00_00_00_0cn,
  machine: Buffer.from("7ced8da3e109", "hex"),
  player: Buffer.from("0507d1a018bc21fa", "hex"),
};
const VENUS_CHAPTER_2 = 2;
const CHARACTER = IDENTITY.character.toString(16);

describeBuild(
  e_build.v36735_13_12_02_1953_alpha,
  "alpha hard wipe through a session",
  () => {
    describe.skipIf(!packages)("with the disc packages", () => {
      interface Sent {
        body: Buffer;
        kind: number;
        who: "FAH" | "GAH";
      }

      // A session in the plaza of venus_chapter_2, its first mission running
      // and the player spawned.
      async function plaza() {
        captureEvents();
        const { activityHostBuild } = await import("..");
        const build = activityHostBuild() as AlphaActivityHostBuild;
        const { ActivityHostManager } = await import(
          "../../activity-host-manager"
        );
        const { activityInstanceFor, resetActivityInstances } = await import(
          "../../activity-instance"
        );
        const { encodeJoinRequest } = await import("../../join");
        const { ActivityHostMessageType } = await import("../../messages");
        const { parseActivityHostToClientNotification } = await import(
          "../../notification"
        );
        const { registerPlayer, setPlayerCharacter, unregisterPlayer } =
          await import("../../../players/registry");
        const { ActivityHostProxySession } = await import("../../session");
        const { ScriptHost } = await import("../../script-host/runtime");
        type Session = InstanceType<typeof ActivityHostProxySession>;

        vi.useFakeTimers({ now: new Date("2026-10-19T04:34:25Z") });
        resetActivityInstances();
        const publisher = {
          dropLoot: () => undefined,
          grantXp: () => undefined,
        };
        registerPlayer(publisher, 1n, IDENTITY.account);
        setPlayerCharacter(publisher, IDENTITY.character);
        const manager = new ActivityHostManager();
        const sent: Sent[] = [];
        const sessions: Session[] = [];
        let sequence = 1;
        const open = (who: "FAH" | "GAH", id: bigint) => {
          const session = new ActivityHostProxySession(new Socket(), manager);
          sessions.push(session);
          session["send"] = (message) => {
            const note = parseActivityHostToClientNotification(message.body);
            if (note) {
              sent.push({ body: note.payload, kind: note.kind, who });
            }
          };
          const start = {
            activityId: VENUS_CHAPTER_2,
            fireteam: [IDENTITY],
            ipValid: who === "FAH",
            options: Buffer.alloc(5),
            requesterMachine: IDENTITY.machine,
            stream: Buffer.alloc(0),
            unknown1: false,
          };
          const bound = session["bindHosts"](start);
          bound.hosts.setStartRequest(start);
          Object.assign(bound.host, { id });
          return session;
        };
        const notify = (
          session: Session,
          id: bigint,
          kind: number,
          payload: Buffer
        ) => {
          const header = build.notificationHeader.clientToHost.write({
            kind,
            length: payload.length,
            sessionId: id,
            variant: 1,
          });
          session["handleActivityHostNotification"]({
            body: Buffer.concat([header, payload]),
            msgType: 8,
            sequence: sequence++,
          });
        };
        const hex = (text: string) => Buffer.from(text, "hex");
        const tick = (ms: number) => vi.advanceTimersByTimeAsync(ms);

        const fah = open("FAH", FAH_ID);
        notify(
          fah,
          FAH_ID,
          ActivityHostMessageType.JoinRequest,
          encodeJoinRequest({
            ...IDENTITY,
            nonce: 0x94_46_51_1e,
            sessionId: FAH_ID,
          })
        );
        await tick(10);
        notify(
          fah,
          FAH_ID,
          ActivityHostMessageType.ActivityClientRequestStateRefresh,
          hex("0000000080000007")
        );
        await tick(2850);
        notify(
          fah,
          FAH_ID,
          ActivityHostMessageType.ActivityClientRequestStateRefresh,
          hex("000000027fffffff")
        );
        await tick(3000);
        notify(
          fah,
          FAH_ID,
          ActivityHostMessageType.ActivityClientRequestStateRefresh,
          hex("0000000680000010")
        );
        await tick(300);
        const instance = activityInstanceFor("venus_chapter_2", fah["hosts"]);
        const host = instance.host();
        if (!(host instanceof ScriptHost)) {
          throw new Error("no script host");
        }
        host.notePlayerSpawned();
        instance.noteSpawned({ ...IDENTITY });
        await tick(5000);
        if (host.runtime.phaseIndex !== 0) {
          throw new Error("the first mission is not running");
        }

        // the alpha's activity client, one update at a time
        const client = { current: 0, last: 0, state: 0 };
        const report = (fields: Partial<typeof client>) => {
          Object.assign(client, fields);
          notify(
            fah,
            FAH_ID,
            ActivityHostMessageType.ClientAuthoritativeDataUpdate,
            Buffer.from(
              encode(build.ah.ClientAuthoritativeData, {
                anyUpdate: true,
                hardWipe: {
                  currentCookie: client.current,
                  lastCookie: client.last,
                  startTime: 0,
                  state: client.state,
                },
                identity: undefined,
                teleport: undefined,
                transition: undefined,
              } as never)
            )
          );
        };
        // the host's hard wipe in the latest membership each host sent
        const nest = (who: "FAH" | "GAH") => {
          const membership = sent
            .filter(
              (s) =>
                s.who === who &&
                s.kind === ActivityHostMessageType.ReplicateMembership
            )
            .at(-1);
          if (!membership) {
            return;
          }
          const br = new BitReader(membership.body);
          br.readBit();
          return build.ah.ReplicateMembership.decode(br).pahRegions;
        };
        const stop = () => {
          for (const session of sessions) {
            session["keepalive"].stop();
          }
          unregisterPlayer(publisher);
          vi.useRealTimers();
        };
        return {
          build,
          client,
          fah,
          host,
          instance,
          nest,
          open,
          notify,
          report,
          sent,
          stop,
          tick,
        };
      }

      afterAll(() => events_dispose());
      beforeAll(() => undefined);

      it("walks the nest through a whole wipe and resets the phase behind the screens", async () => {
        const { host, instance, nest, report, stop, tick } = await plaza();
        const phase = host.runtime.phases[0];
        phase.hardWipe = true;
        const before = phase.instance;
        expect(nest("FAH")?.hardWipe).toEqual({
          completedCookie: 0,
          cookie: 0,
          state: 0,
        });

        // every player dies: the cookie goes up and the clients are told
        host.notePlayerDied(CHARACTER);
        await tick(1000);
        expect(nest("FAH")?.hardWipe).toEqual({
          completedCookie: 0,
          cookie: 1,
          state: 1,
        });
        expect(phase.instance).toBe(before);

        // the screens show and then wait on the host
        report({ current: 1, state: 0 });
        report({ current: 1, state: 1 });
        await tick(1000);
        expect(phase.instance).toBe(before);
        report({ current: 1, state: 2 });
        await tick(1000);

        // the phase is reset and everyone is told it is done
        expect(phase.instance).not.toBe(before);
        expect(nest("FAH")?.hardWipe).toEqual({
          completedCookie: 0,
          cookie: 1,
          state: 3,
        });
        // The alpha's tables hold no phase starts to send them to: they come
        // back by the usual respawn.
        expect(instance.teleport).toBeUndefined();
        expect(host.runtime.trace).toContain(
          `mission ${phase.declName} resetting (hard wipe)`
        );

        // the client completes it, and the host goes idle
        report({ state: 3 });
        report({ last: 1 });
        await tick(1000);
        expect(nest("FAH")?.hardWipe).toEqual({
          completedCookie: 1,
          cookie: 1,
          state: 0,
        });

        // The player reads as dead until its respawn lands, which is no new
        // wipe; once it is back, dying again is.
        await tick(3000);
        expect(nest("FAH")?.hardWipe.cookie).toBe(1);
        host.notePlayerRespawned(CHARACTER);
        await tick(2000);
        host.notePlayerDied(CHARACTER);
        await tick(1000);
        expect(nest("FAH")?.hardWipe).toEqual({
          completedCookie: 1,
          cookie: 2,
          state: 1,
        });
        stop();
      });

      it("does not wipe a phase that does not arm it", async () => {
        const { host, nest, stop, tick } = await plaza();
        expect(host.hardWipeArmed).toBe(false);
        host.notePlayerDied(CHARACTER);
        await tick(3000);
        expect(nest("FAH")?.hardWipe).toEqual({
          completedCookie: 0,
          cookie: 0,
          state: 0,
        });
        stop();
      });

      it("does not wipe while someone in the activity is alive", async () => {
        const { host, instance, nest, stop, tick } = await plaza();
        host.runtime.phases[0].hardWipe = true;
        instance.join({ ...OTHER });
        host.notePlayerDied(CHARACTER);
        await tick(3000);
        expect(host.allPlayersDead).toBe(false);
        expect(nest("FAH")?.hardWipe).toEqual({
          completedCookie: 0,
          cookie: 0,
          state: 0,
        });
        stop();
      });

      it("gives a connection of its own cookie 0, whatever the wipes before it", async () => {
        const { client, host, nest, open, notify, report, stop, tick } =
          await plaza();
        host.runtime.phases[0].hardWipe = true;
        host.notePlayerDied(CHARACTER);
        await tick(1000);
        report({ current: 1, state: 2 });
        await tick(1000);
        report({ last: 1, state: 3 });
        await tick(1000);
        expect(client.last).toBe(1);
        expect(nest("FAH")?.hardWipe.cookie).toBe(1);
        // a public host that joins after the wipe starts from nothing
        const gah = open("GAH", GAH_ID);
        const { ActivityHostMessageType } = await import("../../messages");
        const { encodeJoinRequest } = await import("../../join");
        notify(
          gah,
          GAH_ID,
          ActivityHostMessageType.JoinRequest,
          encodeJoinRequest({
            ...IDENTITY,
            nonce: 0x2e_8d_44_54,
            sessionId: GAH_ID,
          })
        );
        await tick(10);
        notify(
          gah,
          GAH_ID,
          ActivityHostMessageType.ActivityClientRequestStateRefresh,
          Buffer.from("000000007fffffff", "hex")
        );
        await tick(3000);
        expect(nest("GAH")?.hardWipe).toEqual({
          completedCookie: 0,
          cookie: 0,
          state: 0,
        });
        stop();
      });
    });
  }
);
