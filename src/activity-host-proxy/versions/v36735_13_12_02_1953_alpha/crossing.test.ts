import { Socket } from "node:net";
import { events_dispose } from "@blamnetwork/datamine";
import { encode } from "@blamnetwork/rsat";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { e_build } from "../../../builds";
import { buildPackagesDir, describeBuild } from "../../../test-support/build";
import { captureEvents } from "../../../test-support/capture-events";
import type { AlphaActivityHostBuild } from ".";

// venus_chapter_2's load zone from the plaza (bubble 16) into bubble 8, as
// the 2026-10-19 console log has the guest send it: the abdicate of both
// hosts, the abandon of 14 slots at the public host, the state refreshes, the
// class 21 reports, then the guest's request to purge what it could not
// claim. The previous alpha server answered with a claim and a purge that
// were each the epoch byte and the guest's bitmap, 1537 bytes; the guest
// asserted on a purge laid out any other way.

const packages = buildPackagesDir(e_build.v36735_13_12_02_1953_alpha);

const FAH_ID = 0xd6_89_de_74_43_e9_d2_6cn;
const GAH_ID = 0x94_c0_2d_fa_66_22_08_3en;
const IDENTITY = {
  account: 0x1_00_00_00_04n,
  character: 0x2_00_00_00_0bn,
  machine: Buffer.from("7ced8da3e108", "hex"),
  player: Buffer.from("0507d1a018bc21f9", "hex"),
};
const VENUS_CHAPTER_2 = 2;

// 14 slots, the abandon's.
const SLOTS = Buffer.alloc(1536);
SLOTS[2] = 0xff;
SLOTS[3] = 0xfc;

interface Sent {
  body: Buffer;
  kind: number;
  who: "FAH" | "GAH";
}

describeBuild(
  e_build.v36735_13_12_02_1953_alpha,
  "alpha load zone crossing",
  () => {
    describe.skipIf(!packages)("with the disc packages", () => {
      let sent: Sent[];
      let kinds: typeof import("../../messages").ActivityHostMessageType;

      beforeAll(async () => {
        captureEvents();
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

        vi.useFakeTimers({ now: new Date("2026-10-19T04:34:25Z") });
        resetActivityInstances();
        const publisher = {
          dropLoot: () => undefined,
          grantXp: () => undefined,
        };
        registerPlayer(publisher, 1n, IDENTITY.account);
        setPlayerCharacter(publisher, IDENTITY.character);
        const manager = new ActivityHostManager();
        sent = [];
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
        const join = (nonce: number, sessionId: bigint) =>
          encodeJoinRequest({ ...IDENTITY, nonce, sessionId });
        const hex = (text: string) => Buffer.from(text, "hex");
        const withDomain = (domain: number, bitmap: Buffer) =>
          Buffer.concat([Buffer.from([domain]), bitmap]);
        const tick = (ms: number) => vi.advanceTimersByTimeAsync(ms);
        // The report that follows a swap: the bubble entered current, the
        // one left pending.
        const region = (regionId: number) => ({
          ackedRevokeToken: 0,
          citizen: {
            activityHostId: 0n,
            advertised: {
              activityHost: { bytes: Buffer.alloc(16) },
              pad: { bytes: Buffer.alloc(36) },
              session: { bytes: Buffer.alloc(8) },
            },
            connectionState: 1,
            unknown0: 0,
          },
          public: 1,
          regionId,
          unknown1: 0,
        });
        const swapReport = Buffer.from(
          encode(build.ah.ClientAuthoritativeData, {
            anyUpdate: true,
            hardWipe: undefined,
            identity: undefined,
            teleport: undefined,
            transition: {
              current: region(8 << 3),
              pending: region(16 << 3),
              phase: 3,
              props: undefined,
              spawnName: undefined,
              token: undefined,
            },
          })
        );

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
        sent.length = 0;

        // The crossing.
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
        notify(gah, GAH_ID, kinds.AbandonEntitySlots, withDomain(16, SLOTS));
        await tick(2);
        notify(
          fah,
          FAH_ID,
          kinds.ActivityClientRequestStateRefresh,
          hex("0000000980000008")
        );
        notify(
          gah,
          GAH_ID,
          kinds.ActivityClientRequestStateRefresh,
          hex("0000000580000008")
        );
        await tick(5);
        notify(fah, FAH_ID, kinds.ClientAuthoritativeDataUpdate, swapReport);
        notify(gah, GAH_ID, kinds.ClientAuthoritativeDataUpdate, swapReport);
        await tick(1100);
        notify(gah, GAH_ID, kinds.RequestPurgeEntitySlots, SLOTS);
        await tick(2000);

        for (const session of sessions) {
          session["keepalive"].stop();
        }
        unregisterPlayer(publisher);
        vi.useRealTimers();
      });

      afterAll(() => events_dispose());

      it("claims the 14 abandoned slots as the epoch byte and the bitmap", () => {
        const claims = sent.filter(
          (s) => s.kind === kinds.ClaimAuthorityOverAbandonedEntitySlots
        );
        expect(claims.map((s) => s.who)).toEqual(["GAH"]);
        expect(claims[0].body.length).toBe(1537);
        expect(claims[0].body[0]).toBe(1);
        expect(claims[0].body.subarray(1)).toEqual(SLOTS);
      });

      it("purges the same 14 slots under the claim's epoch", () => {
        const purges = sent.filter(
          (s) => s.kind === kinds.PurgeAbandonedEntitySlots
        );
        expect(purges.map((s) => s.who)).toEqual(["GAH"]);
        expect(purges[0].body.length).toBe(1537);
        expect(purges[0].body[0]).toBe(1);
        expect(purges[0].body.subarray(1)).toEqual(SLOTS);
      });

      it("claims before it purges", () => {
        const handoff = sent
          .filter(
            (s) =>
              s.kind === kinds.ClaimAuthorityOverAbandonedEntitySlots ||
              s.kind === kinds.PurgeAbandonedEntitySlots
          )
          .map((s) => s.kind);
        expect(handoff).toEqual([
          kinds.ClaimAuthorityOverAbandonedEntitySlots,
          kinds.PurgeAbandonedEntitySlots,
        ]);
      });
    });
  }
);
