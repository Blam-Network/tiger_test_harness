import { e_event_level, events_dispose } from "@blamnetwork/datamine";
import { encode } from "@blamnetwork/rsat";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  registerPlayer,
  type SelfFamilyPublisher,
  setPlayerCharacter,
  unregisterPlayer,
} from "../players/registry";
import { hasPackages } from "../test-support/build";
import { captureEvents } from "../test-support/capture-events";
import {
  ACTIVITY_HOST_MANAGER_RESPONSE_TYPE,
  ACTIVITY_HOST_MANAGER_START_TYPE,
  ActivityHostManager,
  buildActivityHostManagerResponse,
  parseActivityHostManagerRequest,
} from "./activity-host-manager";
import { formatActivityHostTag } from "./config";
import { anonymousHosts, PlayerHosts } from "./player-hosts";
import { type ParsedStartRequest, parseStartRequest } from "./start-request";
import { activityHostBuild } from "./versions";

afterEach(() => events_dispose());

// These synthetic streams don't decode as a real 808044EB record (the
// fireteam count field lands on zero bits), which is exactly the point:
// they exercise the pre-decode soid bit-scan fallback in
// hostsForStartRequest. The stream is as long as an encoded one, with the
// account soid at an arbitrary unaligned bit and the character soid after it.
const STREAM_BYTES = encodeStartStream([], Buffer.alloc(6)).length;
const ACCOUNT_BIT = 4003;

function writeU64AtBit(buf: Buffer, bit: number, value: bigint): void {
  for (let i = 0; i < 64; i++) {
    const at = bit + i;
    if ((value >> BigInt(63 - i)) & 1n) {
      buf[at >> 3] |= 0x80 >> (at & 7);
    }
  }
}

function bodyFromStream(stream: Buffer): Buffer {
  const inner = Buffer.alloc(
    activityHostBuild().startRequest.START_REQUEST_PAYLOAD_SIZE,
    0
  );
  Buffer.from("0005051780000000", "hex").copy(inner);
  inner.writeUInt16BE(
    stream.length,
    activityHostBuild().startRequest.START_REQUEST_STREAM_SIZE_OFFSET
  );
  stream.copy(
    inner,
    activityHostBuild().startRequest.START_REQUEST_STREAM_OFFSET
  );
  const body = Buffer.alloc(3095, 0);
  body[0] = ACTIVITY_HOST_MANAGER_START_TYPE;
  inner.copy(body, 1);
  return body;
}

function startBody(soids?: { account: bigint; character: bigint }): Buffer {
  const stream = Buffer.alloc(STREAM_BYTES, 0);
  if (soids) {
    writeU64AtBit(stream, ACCOUNT_BIT, soids.account);
    writeU64AtBit(stream, ACCOUNT_BIT + 64, soids.character);
  }
  return bodyFromStream(stream);
}

function publisher(): SelfFamilyPublisher {
  return { dropLoot: vi.fn(), grantXp: vi.fn() };
}

// Real 808044EB encode for the decode-based hostsForStartRequest tests.
function fireteamMember(fields: {
  account: bigint;
  character: bigint;
  machine: Buffer;
}) {
  return {
    account: fields.account,
    character: fields.character,
    machine: fields.machine,
    player: Buffer.alloc(8),
  };
}

function encodeStartStream(
  fireteam: ReturnType<typeof fireteamMember>[],
  requesterMachine: Buffer
): Buffer {
  const emptySlot = { bytes: Array.from({ length: 256 }, () => 0) };
  return encode(activityHostBuild().startRequest.StartRequestStream, {
    unknown0: 0,
    unknown1: 0,
    activity: { activityId: 0, ip: -1 },
    slot0: emptySlot,
    slot1: emptySlot,
    slot2: emptySlot,
    slot3: emptySlot,
    fireteam: { members: fireteam },
    machine: requesterMachine,
  });
}

describe("ActivityHostManager", () => {
  it.skipIf(!hasPackages())(
    "replies to a start request with the bound host and keeps the payload",
    () => {
      const manager = new ActivityHostManager();
      const hosts = new PlayerHosts();
      const bind = vi.fn((_start: ParsedStartRequest | undefined) => ({
        host: hosts.fah,
        hosts,
        kind: "FAH" as const,
      }));
      const rsp = manager.handle(
        { msgType: 6, sequence: 1, body: startBody() },
        bind
      );

      expect(rsp?.[0]).toBe(2);
      expect(rsp?.readBigUInt64BE(1)).toBe(hosts.fah.id);
      expect(hosts.fah.id).not.toBe(0n);
      expect(bind).toHaveBeenCalledTimes(1);
      expect(bind.mock.calls[0]?.[0]?.activityId).toBe(0);
      expect(hosts.getStartRequest()?.activityId).toBe(0);
    }
  );

  it("reads the request subtype", () => {
    const body = Buffer.alloc(3095, 0);
    body[0] = ACTIVITY_HOST_MANAGER_START_TYPE;
    body.writeBigUInt64BE(0x11n, 1);
    const req = parseActivityHostManagerRequest(body);
    expect(req?.type).toBe(ACTIVITY_HOST_MANAGER_START_TYPE);
    expect(req?.payload.readBigUInt64BE(0)).toBe(0x11n);
  });

  it("puts a non-zero activity-host id and HI:LO session string", () => {
    const body = buildActivityHostManagerResponse(1n);
    expect(body.length).toBe(137);
    expect(body[0]).toBe(ACTIVITY_HOST_MANAGER_RESPONSE_TYPE);
    expect(body.readBigUInt64BE(1)).toBe(1n);
    expect(body.readUInt32BE(5)).not.toBe(0);
    expect(body.subarray(9, 26).toString("ascii")).toBe("00000000:00000001");
  });

  it.skipIf(!hasPackages())(
    "returns the GAH id on a GAH start so PUBLIC TARGET join is not delivered to FAH",
    () => {
      const manager = new ActivityHostManager();
      const hosts = new PlayerHosts();
      hosts.bind();
      const { host, kind } = hosts.bindHost();

      const rsp = manager.handle(
        { msgType: 6, sequence: 1, body: startBody() },
        () => ({ host, hosts, kind })
      );

      expect(kind).toBe("GAH");
      expect(hosts.gah).toBeDefined();
      expect(rsp?.readBigUInt64BE(1)).toBe(hosts.gah?.id);
      expect(rsp?.subarray(9, 26).toString("ascii")).toBe(
        formatActivityHostTag(hosts.gah!.id)
      );
    }
  );

  it("absorbs an empty body without binding", () => {
    const captured = captureEvents();
    const manager = new ActivityHostManager();
    const bind = vi.fn();
    expect(
      manager.handle({ msgType: 6, sequence: 1, body: Buffer.alloc(0) }, bind)
    ).toBeNull();
    expect(captured.at(e_event_level.warning)).toHaveLength(1);
    expect(bind).not.toHaveBeenCalled();
  });

  describe("hostsForStartRequest", () => {
    it("resolves the registered player from a decoded fireteam of one", () => {
      const manager = new ActivityHostManager();
      const a = publisher();
      const player = registerPlayer(a, 0x1n, 0x100000002n);
      setPlayerCharacter(a, 0x200000002n);
      try {
        const machine = Buffer.from("7c1e52a389ce", "hex");
        const stream = encodeStartStream(
          [
            fireteamMember({
              account: 0x100000002n,
              character: 0x200000002n,
              machine,
            }),
          ],
          machine
        );
        const start = parseStartRequest(bodyFromStream(stream).subarray(1));
        expect(start?.fireteam).toHaveLength(1);
        expect(manager.hostsForStartRequest(start!)).toBe(player.hosts);
      } finally {
        unregisterPlayer(a);
      }
    });

    it("picks the fireteam member matching the requester machine", () => {
      const manager = new ActivityHostManager();
      const a = publisher();
      const b = publisher();
      registerPlayer(a, 0x1n, 0x100000001n);
      const playerB = registerPlayer(b, 0x2n, 0x100000002n);
      setPlayerCharacter(a, 0x200000001n);
      setPlayerCharacter(b, 0x200000002n);
      try {
        const machineA = Buffer.from("aaaaaaaaaaaa", "hex");
        const machineB = Buffer.from("bbbbbbbbbbbb", "hex");
        const stream = encodeStartStream(
          [
            fireteamMember({
              account: 0x100000001n,
              character: 0x200000001n,
              machine: machineA,
            }),
            fireteamMember({
              account: 0x100000002n,
              character: 0x200000002n,
              machine: machineB,
            }),
          ],
          machineB
        );
        const start = parseStartRequest(bodyFromStream(stream).subarray(1));
        expect(manager.hostsForStartRequest(start!)).toBe(playerB.hosts);
      } finally {
        unregisterPlayer(a);
        unregisterPlayer(b);
      }
    });

    it("falls back to the soid bit-scan when the stream doesn't decode as a fireteam", () => {
      const manager = new ActivityHostManager();
      const a = publisher();
      const player = registerPlayer(a, 0x1n, 0x100000002n);
      setPlayerCharacter(a, 0x200000002n);
      try {
        const start = parseStartRequest(
          startBody({
            account: 0x100000002n,
            character: 0x200000002n,
          }).subarray(1)
        );
        expect(start?.fireteam).toBeUndefined();
        expect(manager.hostsForStartRequest(start!)).toBe(player.hosts);
      } finally {
        unregisterPlayer(a);
      }
    });

    it("finds the player whose account soid sits at a non-byte-aligned bit", () => {
      const manager = new ActivityHostManager();
      const a = publisher();
      const b = publisher();
      const playerA = registerPlayer(a, 0x1n, 0x100000001n);
      const playerB = registerPlayer(b, 0x2n, 0x100000002n);
      try {
        const start = parseStartRequest(
          startBody({
            account: 0x100000002n,
            character: 0x200000002n,
          }).subarray(1)
        );
        expect(start).not.toBeNull();
        expect(manager.hostsForStartRequest(start!)).toBe(playerB.hosts);
        expect(playerB.hosts).not.toBe(playerA.hosts);
      } finally {
        unregisterPlayer(a);
        unregisterPlayer(b);
      }
    });

    it("prefers the player found by both soids at the earliest offset over a bit-shifted look-alike", () => {
      const manager = new ActivityHostManager();
      const a = publisher();
      const b = publisher();
      // 0x1_00000001 << 1 is 0x2_00000002: B's character shows up inside
      // A's stream one bit off, and A's low dword next to its character's
      // high dword spells B's account.
      const playerA = registerPlayer(a, 0x1n, 0x100000001n);
      registerPlayer(b, 0x2n, 0x100000002n);
      setPlayerCharacter(a, 0x200000001n);
      setPlayerCharacter(b, 0x200000002n);
      try {
        const start = parseStartRequest(
          startBody({
            account: 0x100000001n,
            character: 0x200000001n,
          }).subarray(1)
        );
        expect(manager.hostsForStartRequest(start!)).toBe(playerA.hosts);
      } finally {
        unregisterPlayer(a);
        unregisterPlayer(b);
      }
    });

    it("accepts a match on the character soid alone", () => {
      const manager = new ActivityHostManager();
      const a = publisher();
      const player = registerPlayer(a, 0x1n, 0x100000001n);
      setPlayerCharacter(a, 0x200000009n);
      try {
        const start = parseStartRequest(
          startBody({ account: 0xdeadn, character: 0x200000009n }).subarray(1)
        );
        expect(manager.hostsForStartRequest(start!)).toBe(player.hosts);
      } finally {
        unregisterPlayer(a);
      }
    });

    it("falls back to the anonymous hosts for an unknown player", () => {
      const captured = captureEvents();
      const manager = new ActivityHostManager();
      const a = publisher();
      registerPlayer(a, 0x1n, 0x100000001n);
      try {
        const start = parseStartRequest(
          startBody({
            account: 0x100000077n,
            character: 0x200000077n,
          }).subarray(1)
        );
        expect(manager.hostsForStartRequest(start!)).toBe(anonymousHosts);
        expect(captured.at(e_event_level.warning)).toHaveLength(1);
      } finally {
        unregisterPlayer(a);
      }
    });
  });
});
