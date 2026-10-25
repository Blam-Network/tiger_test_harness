import { Socket } from "node:net";
import { events_dispose } from "@blamnetwork/datamine";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { e_build } from "../../../builds";
import { buildPackagesDir, describeBuild } from "../../../test-support/build";
import { captureEvents } from "../../../test-support/capture-events";
import type { AlphaActivityHostBuild } from ".";

// venus_chapter_2's load zone from the plaza (bubble 16) into bubble 10, a
// public bubble, as the 2026-10-19 console log has the guest do it: the
// client opens a pending public host on a third socket, which joins and
// refreshes with no membership, and at the swap sends every socket its state
// refresh in no fixed order. The pending host took no apply when its refresh
// came before the old host's, so the client never built bubble 10's squads
// (the ambient encounters never spawned).

const packages = buildPackagesDir(e_build.v36735_13_12_02_1953_alpha);

const FAH_ID = 0xd6_89_de_74_43_e9_d2_6cn;
const GAH_ID = 0x94_c0_2d_fa_66_22_08_3en;
const PENDING_ID = 0x51_ca_cc_a6_44_1b_2b_40n;
const IDENTITY = {
  account: 0x1_00_00_00_04n,
  character: 0x2_00_00_00_0bn,
  machine: Buffer.from("7ced8da3e108", "hex"),
  player: Buffer.from("0507d1a018bc21f9", "hex"),
};
const VENUS_CHAPTER_2 = 2;

type Who = "FAH" | "GAH" | "PENDING";

interface Sent {
  body: Buffer;
  kind: number;
  who: Who;
}

describeBuild(
  e_build.v36735_13_12_02_1953_alpha,
  "alpha public load zone crossing",
  () => {
    describe.skipIf(!packages)("with the disc packages", () => {
      let crossings: Record<string, Sent[]>;
      let kinds: typeof import("../../messages").ActivityHostMessageType;

      // The swap's refreshes, in the order the sockets hear them.
      const ORDERS = {
        "the pending host first": ["PENDING", "FAH", "GAH"],
        "the old host first": ["GAH", "PENDING", "FAH"],
        "the private host first": ["FAH", "GAH", "PENDING"],
      } as const;

      beforeAll(async () => {
        const { activityHostBuild } = await import("..");
        const build = activityHostBuild() as AlphaActivityHostBuild;
        const { ActivityHostManager } = await import(
          "../../activity-host-manager"
        );
        const { resetActivityInstances } = await import(
          "../../activity-instance"
        );
        const { encodeJoinRequest } = await import("../../join");
        const { ActivityHostMessageType } = await import("../../messages");
        kinds = ActivityHostMessageType;
        const { parseActivityHostToClientNotification } = await import(
          "../../notification"
        );
        const { registerPlayer, setPlayerCharacter, unregisterPlayer } =
          await import("../../../players/registry");
        const { ActivityHostProxySession } = await import("../../session");
        type Session = InstanceType<typeof ActivityHostProxySession>;

        const run = async (order: readonly Who[]): Promise<Sent[]> => {
          captureEvents();
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
          const open = (who: Who, id: bigint) => {
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
          const join = (nonce: number, sessionId: bigint) =>
            encodeJoinRequest({ ...IDENTITY, nonce, sessionId });
          const hex = (text: string) => Buffer.from(text, "hex");
          const withDomain = (domain: number, bitmap: Buffer) =>
            Buffer.concat([Buffer.from([domain]), bitmap]);
          const tick = (ms: number) => vi.advanceTimersByTimeAsync(ms);

          const fah = open("FAH", FAH_ID);
          notify(fah, FAH_ID, kinds.JoinRequest, join(0x94_46_51_1e, FAH_ID));
          await tick(10);
          notify(
            fah,
            FAH_ID,
            kinds.ActivityClientRequestStateRefresh,
            hex("0000000080000007")
          );
          await tick(2850);
          notify(
            fah,
            FAH_ID,
            kinds.ActivityClientRequestStateRefresh,
            hex("000000027fffffff")
          );
          await tick(3000);
          const gah = open("GAH", GAH_ID);
          notify(gah, GAH_ID, kinds.JoinRequest, join(0x2e_8d_44_54, GAH_ID));
          await tick(10);
          notify(
            gah,
            GAH_ID,
            kinds.ActivityClientRequestStateRefresh,
            hex("000000007fffffff")
          );
          await tick(12_050);
          notify(
            fah,
            FAH_ID,
            kinds.ActivityClientRequestStateRefresh,
            hex("0000000680000010")
          );
          await tick(5);
          notify(
            gah,
            GAH_ID,
            kinds.ActivityClientRequestStateRefresh,
            hex("0000000280000010")
          );
          await tick(300);

          // The pending public host: a full join, then a refresh naming the
          // plaza with no membership.
          const pending = open("PENDING", PENDING_ID);
          notify(
            pending,
            PENDING_ID,
            kinds.JoinRequest,
            join(0x51_ca_cc_a6, PENDING_ID)
          );
          await tick(10);
          notify(
            pending,
            PENDING_ID,
            kinds.ActivityClientRequestStateRefresh,
            hex("0000000080000010")
          );
          await tick(3000);
          sent.length = 0;

          for (const [session, id] of [
            [fah, FAH_ID],
            [gah, GAH_ID],
          ] as const) {
            notify(
              session,
              id,
              kinds.AbdicateAuthority,
              withDomain(16, Buffer.alloc(1536))
            );
          }
          await tick(2);
          const refreshes = {
            FAH: [fah, FAH_ID, "000000118000000a"],
            GAH: [gah, GAH_ID, "000000068000000a"],
            PENDING: [pending, PENDING_ID, "000000028000000a"],
          } as const;
          for (const who of order) {
            const [session, id, payload] = refreshes[who];
            notify(
              session,
              id,
              kinds.ActivityClientRequestStateRefresh,
              hex(payload)
            );
            await tick(5);
          }
          await tick(2000);

          for (const session of sessions) {
            session["keepalive"].stop();
          }
          unregisterPlayer(publisher);
          vi.useRealTimers();
          return sent;
        };

        crossings = {};
        for (const [name, order] of Object.entries(ORDERS)) {
          crossings[name] = await run(order);
        }
      }, 60_000);

      afterAll(() => events_dispose());

      for (const name of Object.keys(ORDERS)) {
        it(`applies bubble 10 to the new public host when ${name} hears the swap`, () => {
          const applies = crossings[name].filter(
            (s) =>
              s.who === "PENDING" &&
              s.kind === kinds.SensorAuthUpdate &&
              s.body.length > 1000
          );
          expect(applies).toHaveLength(1);
        });
      }
    });
  }
);
