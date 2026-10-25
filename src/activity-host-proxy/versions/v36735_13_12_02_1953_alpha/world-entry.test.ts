import { createHash } from "node:crypto";
import { Socket } from "node:net";
import { events_dispose } from "@blamnetwork/datamine";
import { BitReader } from "@blamnetwork/rsat";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { e_build } from "../../../builds";
import { buildPackagesDir, describeBuild } from "../../../test-support/build";
import { captureEvents } from "../../../test-support/capture-events";
import type { AlphaActivityHostBuild } from ".";

// A join and world entry replayed through the alpha's session, against the
// bodies the previous alpha server sent for the same joins: the digests below
// are of those bodies, rows sorted by ref. The previous server also ordered
// the rows differently within an update, which the guest does not read (it
// walks each bundle's slots by index). Where the bodies differ on purpose, the
// test says how.

const packages = buildPackagesDir(e_build.v36735_13_12_02_1953_alpha);

const FAH_ID = 0xd6_89_de_74_43_e9_d2_6cn;
const GAH_ID = 0x94_c0_2d_fa_66_22_08_3en;
const IDENTITY = {
  account: 0x1_00_00_00_04n,
  character: 0x2_00_00_00_0bn,
  machine: Buffer.from("7ced8da3e108", "hex"),
  player: Buffer.from("0507d1a018bc21f9", "hex"),
};

// The class 21 reports the clients sent in a captured venus join.
const FAH_CLIENT_AUTH =
  "cf37bfbb7ec6c2c6e6cac2cadb7ec6cecae6d6cb7ec2c2c2c2c2c703e39703c3bab78fcb879bd3e78fbf93a79702df0f1712e31306cf16c6c2e2020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020000000000000000000000000000000002d2c0d54a09a00e2600000005f3b6368f84220e00";
const GAH_CLIENT_AUTH =
  "cf37bfbb7ec6c2c6e6cac2cadb7ec6cecae6d6cb7ec2c2c2c2c2c703e39703c3bab78fcb879bd3e78fbf93a79702df0f1712e31306cf16c6c2e202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202035a2779d10fa749b00000000000000002d2c0d54a09a00e2600000005f3b6368f8422c000004040000040400014184caedd887b6a0605400186cd90da37b50be76c6d1f084056fb914002a547cf7f6c9010000007d008000000bc20e3865ce70138a3de1dd69e15751ca6016fd3311041f4baa3ee6202b0";

// Activity ids: indices into the investment globals' activity table.
const TOWER = 0;
const ACTION_MOCK = 1;
const VENUS_CHAPTER_2 = 2;
const VENUS_BOUNTY_1 = 3;
const VENUS_PORTAL_1 = 4;

// A row's ref and its body bits.
interface Row {
  bits: string;
  ref: string;
}

interface Update {
  promote: number[];
  rows: Row[];
  // The leading bit: the update carries the authority table.
  table: boolean;
}

interface Sent {
  entering: boolean;
  payload: Buffer;
  who: "FAH" | "GAH";
}

const digest = (bytes: Buffer | string) =>
  createHash("sha256").update(bytes).digest("hex").slice(0, 16);

// The rows' refs and bodies sorted, so the order they went out in does not
// count.
const rowsDigest = (rows: readonly Row[]) =>
  digest(
    rows
      .map((row) => `${row.ref}|${row.bits}`)
      .sort()
      .join("\n")
  );

const bitsToBuffer = (bits: string) => {
  const bytes = Buffer.alloc(Math.ceil(bits.length / 8));
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] === "1") {
      bytes[i >> 3] |= 0x80 >> (i & 7);
    }
  }
  return bytes;
};

describeBuild(
  e_build.v36735_13_12_02_1953_alpha,
  "alpha join and world entry",
  () => {
    describe.skipIf(!packages)("with the disc packages", () => {
      let build: AlphaActivityHostBuild;
      let squadDefinition: typeof import("../../../content").squadDefinition;
      let readUpdate: (payload: Buffer) => Update;
      let replay: (
        activityId: number,
        world: number,
        withGah: boolean
      ) => Promise<Sent[]>;
      const replays = new Map<number, Sent[]>();

      const updates = (sent: Sent[], who: "FAH" | "GAH", entering: boolean) =>
        sent
          .filter((s) => s.who === who && s.entering === entering)
          .map((s) => readUpdate(s.payload));

      // A replay is a few seconds of the session, so each activity's is kept.
      const replayOf = async (
        activityId: number,
        world: number,
        withGah: boolean
      ) => {
        let sent = replays.get(activityId);
        if (!sent) {
          sent = await replay(activityId, world, withGah);
          replays.set(activityId, sent);
        }
        return sent;
      };

      beforeAll(async () => {
        captureEvents();
        const { activityHostBuild } = await import("..");
        build = activityHostBuild() as AlphaActivityHostBuild;
        ({ squadDefinition } = await import("../../../content"));
        const { ActivityHostManager } = await import(
          "../../activity-host-manager"
        );
        const { resetActivityInstances } = await import(
          "../../activity-instance"
        );
        const { encodeJoinRequest } = await import("../../join");
        const { ActivityHostMessageType } = await import("../../messages");
        const { parseActivityHostToClientNotification } = await import(
          "../../notification"
        );
        const { registerPlayer, setPlayerCharacter, unregisterPlayer } =
          await import("../../../players/registry");
        const { sensorAuthReader } = await import(
          "../../rsat/sensor-auth-fields"
        );
        const { ActivityHostProxySession } = await import("../../session");
        type Session = InstanceType<typeof ActivityHostProxySession>;

        readUpdate = (payload) => {
          const br = sensorAuthReader(payload);
          const promote: number[] = [];
          const table = br.readBit() === 1;
          if (table) {
            for (let slot = 0; slot < 65; slot++) {
              if (br.readBit()) {
                promote.push(slot);
              }
            }
            br.readBit();
            if (br.readBit()) {
              br.readNumber(32);
            }
            for (let slot = 0; slot < 65; slot++) {
              if (br.readBit()) {
                br.readNumber(build.machineIdBytes * 8 - 24);
                br.readNumber(24);
              }
              if (br.readBit()) {
                br.readNumber(16);
              }
              br.readBit();
            }
          }
          br.readNumber(32);
          const rows: Row[] = [];
          if (br.readBit()) {
            while (br.readBit()) {
              const ref = build.sensor.sense.readClientRef(br);
              const count = br.readNumber(32);
              let bits = "";
              for (let i = 0; i < count; i++) {
                bits += br.readBit();
              }
              rows.push({
                bits,
                ref: `${(ref.bundle >>> 0).toString(16).padStart(8, "0")}:t${ref.typeId}#${ref.typeIndex}`,
              });
            }
          }
          return { promote, rows, table };
        };

        replay = async (activityId, world, withGah) => {
          vi.useFakeTimers({ now: new Date("2026-10-19T04:34:25Z") });
          let seed = 1;
          vi.spyOn(Math, "random").mockImplementation(() => {
            seed = (seed * 16_807) % 2_147_483_647;
            return (seed - 1) / 2_147_483_646;
          });
          resetActivityInstances();
          // Its own hosts, as a signed-in player has: the anonymous ones are
          // shared between replays.
          const publisher = {
            dropLoot: () => undefined,
            grantXp: () => undefined,
          };
          registerPlayer(publisher, 1n, IDENTITY.account);
          setPlayerCharacter(publisher, IDENTITY.character);
          const manager = new ActivityHostManager();
          const sent: Sent[] = [];
          const sessions: Session[] = [];
          let entering = false;
          let sequence = 1;
          const open = (who: "FAH" | "GAH", id: bigint) => {
            const session = new ActivityHostProxySession(new Socket(), manager);
            sessions.push(session);
            session["send"] = (message) => {
              const note = parseActivityHostToClientNotification(message.body);
              if (note?.kind === ActivityHostMessageType.SensorAuthUpdate) {
                sent.push({ entering, payload: note.payload, who });
              }
            };
            const start = {
              activityId,
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
          const tick = (ms: number) => vi.advanceTimersByTimeAsync(ms);

          const fah = open("FAH", FAH_ID);
          notify(fah, FAH_ID, 3, join(0x94_46_51_1e, FAH_ID));
          await tick(10);
          // A refresh before the world exists names where the client was last.
          notify(fah, FAH_ID, 17, hex("0000000080000007"));
          await tick(50);
          notify(fah, FAH_ID, 21, hex(FAH_CLIENT_AUTH));
          await tick(2800);
          notify(fah, FAH_ID, 17, hex("000000027fffffff"));
          await tick(3000);
          let gah: Session | undefined;
          if (withGah) {
            gah = open("GAH", GAH_ID);
            notify(gah, GAH_ID, 3, join(0x2e_8d_44_54, GAH_ID));
            await tick(10);
            notify(gah, GAH_ID, 17, hex("000000007fffffff"));
            await tick(50);
            notify(gah, GAH_ID, 21, hex(GAH_CLIENT_AUTH));
          }
          await tick(12_000);
          entering = true;
          const handle = `8000${world.toString(16).padStart(4, "0")}`;
          notify(fah, FAH_ID, 17, hex(`00000006${handle}`));
          await tick(5);
          if (gah) {
            notify(gah, GAH_ID, 17, hex(`00000002${handle}`));
          }
          await tick(300);
          for (const session of sessions) {
            session["keepalive"].stop();
          }
          unregisterPlayer(publisher);
          vi.useRealTimers();
          vi.restoreAllMocks();
          return sent;
        };
      });

      afterAll(() => events_dispose());

      it("grants the private host its authority table and the local player", async () => {
        const sent = await replayOf(VENUS_CHAPTER_2, 16, true);
        const [grant] = updates(sent, "FAH", false);
        expect(grant.promote).toEqual([16, 64]);
        expect(grant.rows.map((row) => row.ref)).toEqual([
          "4786c0e0:t16#3",
          "4786c0e0:t12#5",
        ]);
        const first = sent.find((s) => s.who === "FAH");
        expect(first?.payload.length).toBe(237);
        expect(digest(first?.payload ?? Buffer.alloc(0))).toBe(
          "33fe41c31aa91de6"
        );
      });

      it("grants the public host no table and the local player", async () => {
        const sent = await replayOf(VENUS_CHAPTER_2, 16, true);
        const [grant] = updates(sent, "GAH", false);
        expect(grant.table).toBe(false);
        expect(grant.rows.map((row) => row.ref)).toEqual([
          "4786c0e0:t16#3",
          "4786c0e0:t12#5",
        ]);
        const first = sent.find((s) => s.who === "GAH");
        expect(first?.payload.length).toBe(62);
        expect(digest(first?.payload ?? Buffer.alloc(0))).toBe(
          "03c0b5d1237fa3a6"
        );
      });

      it("enters the world with a promote and the rows, no rowless apply between", async () => {
        const sent = await replayOf(VENUS_CHAPTER_2, 16, true);
        for (const who of ["FAH", "GAH"] as const) {
          const [promote, rows] = updates(sent, who, true);
          expect(promote.table).toBe(true);
          expect(promote.rows).toHaveLength(0);
          expect(rows.table).toBe(false);
          expect(rows.rows.length).toBeGreaterThan(0);
        }
      });

      it("sends the public host's world entry as the previous server did", async () => {
        const sent = await replayOf(VENUS_CHAPTER_2, 16, true);
        const rows = updates(sent, "GAH", true)[1].rows;
        expect(rows).toHaveLength(60);
        expect(rowsDigest(rows)).toBe("b4d35d86fc86eaf0");
      });

      it("keys every player row to the local player", async () => {
        const sent = await replayOf(VENUS_CHAPTER_2, 16, true);
        const players = (who: "FAH" | "GAH") =>
          updates(sent, who, true)[1].rows.filter((row) =>
            row.ref.includes(":t12#")
          );
        for (const who of ["FAH", "GAH"] as const) {
          const rows = players(who);
          expect(rows).toHaveLength(16);
          expect(new Set(rows.map((row) => row.bits)).size).toBe(1);
        }
      });

      it("sends the private host the bundles its bubble loads, hollow where a slice set is not loaded", async () => {
        const sent = await replayOf(VENUS_CHAPTER_2, 16, true);
        const rows = updates(sent, "FAH", true)[1].rows;
        // The previous server also sent the loot bundle 29cbd99a, which no
        // bubble of venus_chapter_2's scenario_client loads, and these two
        // objects of other bubbles' slice sets with a body.
        const hollow = ["517641f1:t4#23", "517641f1:t4#78"];
        expect(rows.some((row) => row.ref.startsWith("29cbd99a"))).toBe(false);
        for (const ref of hollow) {
          expect(rows.find((row) => row.ref === ref)?.bits).toBe("");
        }
        const rest = rows.filter((row) => !hollow.includes(row.ref));
        expect(rest).toHaveLength(175);
        expect(rowsDigest(rest)).toBe("7adad30c65975803");
        // Every squad and actor of another bubble's slice set stands in its
        // slot without a body.
        const placed = rows.filter((row) => /^517641f1:t[12]#/.test(row.ref));
        expect(placed).toHaveLength(67);
        expect(placed.every((row) => row.bits === "")).toBe(true);
      });

      it("matches the previous server's private world entry for venus_bounty_1", async () => {
        const sent = await replayOf(VENUS_BOUNTY_1, 21, true);
        const rows = updates(sent, "FAH", true)[1].rows;
        expect(rows).toHaveLength(42);
        expect(rowsDigest(rows)).toBe("5aed6fc024c4c63b");
      });

      it("matches the previous server's public world entry for venus_portal_1", async () => {
        const sent = await replayOf(VENUS_PORTAL_1, 16, true);
        const rows = updates(sent, "GAH", true)[1].rows;
        expect(rows).toHaveLength(60);
        expect(rowsDigest(rows)).toBe("b4d35d86fc86eaf0");
      });

      it.each([
        ["city_tower_default1", TOWER, 3, 756, "cb11caa5fefb84d1"],
        ["action_mock", ACTION_MOCK, 0, 1110, "4eb6968676e938ee"],
      ])("grants %s as the previous server did", async (_name, id, bubble, size, hash) => {
        const sent = await replayOf(id, bubble, false);
        const first = sent.find((s) => s.who === "FAH");
        expect(first?.payload.length).toBe(size);
        expect(digest(first?.payload ?? Buffer.alloc(0))).toBe(hash);
      });

      // The guest bug-checks on a squad whose roster is not its definition's
      // length, so no squad goes out with another.
      it.each([
        ["city_tower_default1", TOWER, 3, "city_tower_default1", false],
        ["action_mock", ACTION_MOCK, 0, "action_mock", false],
        ["venus_chapter_2", VENUS_CHAPTER_2, 16, "venus_chapter_2", true],
        ["venus_bounty_1", VENUS_BOUNTY_1, 21, "venus_bounty_1", true],
        ["venus_portal_1", VENUS_PORTAL_1, 16, "venus_portal_1", true],
      ])("gives every squad of %s a roster cell per definition member", async (_name, id, bubble, activity, withGah) => {
        const sent = await replayOf(id, bubble, withGah);
        let checked = 0;
        for (const who of ["FAH", "GAH"] as const) {
          for (const update of updates(sent, who, true)) {
            for (const row of update.rows) {
              const match = /^([0-9a-f]{8}):t1#(\d+)$/.exec(row.ref);
              if (!(match && row.bits)) {
                continue;
              }
              const squad = squadDefinition(
                activity,
                Number.parseInt(match[1], 16),
                Number(match[2])
              );
              // Two flag bits (auth bound, present) lead the body.
              const auth = build.ah.SquadAuth.decode(
                new BitReader(bitsToBuffer(row.bits.slice(2)))
              );
              expect(auth.roster?.slots, row.ref).toHaveLength(
                squad?.cells ?? 0
              );
              checked++;
            }
          }
        }
        expect(checked).toBeGreaterThan(0);
      });

      it("authors a squad's Objective on its row, as its host definition says", async () => {
        const sent = await replayOf(VENUS_CHAPTER_2, 16, true);
        const row = updates(sent, "GAH", true)[1].rows.find(
          (r) => r.ref === "8cc31436:t1#11"
        );
        const auth = build.ah.SquadAuth.decode(
          new BitReader(bitsToBuffer((row?.bits ?? "").slice(2)))
        );
        expect((auth.ref0?.bundle ?? 0) >>> 0).toBe(0x8c_c3_14_36);
        expect(auth.ref0?.typeIndex).toBe(0);
        expect(auth.roster?.slots).toEqual([0, 0]);
      });
    });
  }
);
