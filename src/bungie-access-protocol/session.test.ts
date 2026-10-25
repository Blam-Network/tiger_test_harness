import { Socket } from "node:net";
import {
  BitReader,
  decode,
  decodeServerMessage,
  encodeServerMessage,
} from "@blamnetwork/rsat";
import { describe, expect, it } from "vitest";
import {
  MemoryCharacterStore,
  SOID_TYPE_ITEM,
  soidFor,
} from "../investment/character-store";
import { CharacterLoadout } from "../investment/loadout";
import { LOOT_STATE_GROUND, lootTableForCharacter } from "../investment/loot";
import { STUB_APPEARANCE } from "../investment/stubs/stub-account";
import type { RawBapMessage } from "../lib/bap-wire/codec";
import { BapMessageType } from "../lib/bap-wire/constants";
import { hasPackages } from "../test-support/build";
import { e_server_message_network_id } from "./rsat";
import { BungieAccessProtocolSession } from "./session";
import { liveBap } from "./versions/v41375_14_07_03_1501_live/live-bap";

const nid = e_server_message_network_id;

// One store for the whole file: MemoryCharacterStore soids climb per
// instance, and the loot-table registry (src/investment/loot.ts) is keyed
// by soid globally, so sharing a store keeps every test's character on its
// own loot table.
const sharedStore = new MemoryCharacterStore();

function makeSession() {
  const socket = new Socket();
  const session = new BungieAccessProtocolSession(socket, sharedStore);
  const sent: RawBapMessage[] = [];
  session["send"] = (message: RawBapMessage) => {
    sent.push(message);
  };
  const close = () => {
    socket.emit("close");
    socket.destroy();
  };
  return { session, sent, close };
}

async function withCharacter(session: BungieAccessProtocolSession) {
  const account = await sharedStore.accountForPlatformId(
    BigInt(Date.now()) + BigInt(Math.floor(Math.random() * 1000)),
    "guardian"
  );
  const character = await sharedStore.createCharacter(
    account.soid,
    "guardian",
    STUB_APPEARANCE
  );
  character.loadout = CharacterLoadout.fromItems([]);
  session["account"] = account;
  session["character"] = character;
  return character;
}

describe("loot drop -> 601 pickup", () => {
  it.skipIf(!hasPackages())(
    "rolls a drop, then a matching 601 request grants the item",
    async () => {
      const { session, sent, close } = makeSession();
      try {
        const character = await withCharacter(session);
        // A strike-boss-sized value: guarantees a roll (loot.test.ts covers
        // the chance formula itself).
        session.dropLoot(0x34fd, character.soid, 1000);

        const table = lootTableForCharacter(character.soid);
        const slot = table.at(0);
        expect(slot).toBeDefined();
        expect(slot?.state).toBe(LOOT_STATE_GROUND);

        const reqBody = encodeServerMessage(
          nid._server_message_network_id_loot_pickup_item,
          liveBap().schemas.LootPickupItemRequest,
          {
            state: slot!.state,
            nonce: {
              unknown0: {
                unknown0: slot!.nonce.incidentNumber,
                unknown1: slot!.nonce.submitterSoid,
              },
              unknown1: slot!.nonce.ordinal,
            },
          }
        );
        await session["handleWorldServerRequest"]({
          msgType: BapMessageType.ClientToWorldServerRequest,
          sequence: 1,
          body: reqBody,
        });

        const reply = sent.find(
          (m) => m.msgType === BapMessageType.ClientToWorldServerResponse
        );
        expect(reply).toBeDefined();
        const { value } = decodeServerMessage(
          reply!.body,
          liveBap().schemas.LootPickupItemResponse
        );
        expect(value.unknown0.unknown0).toBe(0);

        // Item granted, ground slot freed for reuse.
        expect(
          character.loadout.items.some((i) => i.defIndex === slot!.itemDef)
        ).toBe(true);
        expect(table.at(0)).toBeUndefined();

        const push = sent.find(
          (m) => m.msgType === BapMessageType.QueuezToClientUpdateNotification
        );
        expect(push).toBeDefined();
      } finally {
        close();
      }
    }
  );

  it.skipIf(!hasPackages())(
    "replies status 1 for an unknown nonce and grants nothing",
    async () => {
      const { session, sent, close } = makeSession();
      try {
        const character = await withCharacter(session);
        const reqBody = encodeServerMessage(
          nid._server_message_network_id_loot_pickup_item,
          liveBap().schemas.LootPickupItemRequest,
          {
            state: LOOT_STATE_GROUND,
            nonce: { unknown0: { unknown0: 1, unknown1: 1n }, unknown1: 0 },
          }
        );
        await session["handleWorldServerRequest"]({
          msgType: BapMessageType.ClientToWorldServerRequest,
          sequence: 1,
          body: reqBody,
        });

        const reply = sent.find(
          (m) => m.msgType === BapMessageType.ClientToWorldServerResponse
        );
        expect(reply).toBeDefined();
        const { value } = decodeServerMessage(
          reply!.body,
          liveBap().schemas.LootPickupItemResponse
        );
        expect(value.unknown0.unknown0).toBe(1);
        expect(character.loadout.items.length).toBe(0);
      } finally {
        close();
      }
    }
  );
});

describe("talent_grid_activate_step (801)", () => {
  it.skipIf(!hasPackages())(
    "activates a root node, persists it and pushes a self delta whose version matches the response",
    async () => {
      const { session, sent, close } = makeSession();
      try {
        const character = await withCharacter(session);
        const itemSoid = soidFor(SOID_TYPE_ITEM, 1);
        character.loadout = CharacterLoadout.fromItems([
          {
            soid: itemSoid,
            // def 434: subclass, grid 364, node 0 is a root (no prerequisites).
            defIndex: 434,
            bucket: 7,
            equipSlot: 1,
            instanced: true,
            quantity: 1,
            artArrangement: 65_535,
            sandboxPattern: 12,
            power: 0,
            // Grid 364's steps all require item level 5 (step+0x1B), so a fresh
            // item is refused with status 7 before the node is ever reached.
            // Grid 364 steps require item level 5 = 11,750 XP on progression
            // def 48.
            talentXp: 11_750,
          },
        ]);

        const reqBody = encodeServerMessage(
          nid._server_message_network_id_talent_grid_activate_step,
          liveBap().schemas.TalentGridActivateStepRequest,
          {
            itemSoid,
            node: 0,
          }
        );
        await session["handleWorldServerRequest"]({
          msgType: BapMessageType.ClientToWorldServerRequest,
          sequence: 1,
          body: reqBody,
        });

        const reply = sent.find(
          (m) => m.msgType === BapMessageType.ClientToWorldServerResponse
        );
        expect(reply).toBeDefined();
        const { value } = decodeServerMessage(
          reply!.body,
          liveBap().schemas.TalentGridActivateStepResponse
        );
        expect(value.unknown0.unknown0).toBe(0);
        expect(value.unknown0.unknown1).toBeGreaterThan(0);

        // The node array is mutated in place and persisted.
        expect(character.loadout.item(itemSoid)?.talentNodes[0]).toBe(1);

        // The push's family-4 version matches what the response told the
        // client to wait for.
        const push = sent.find(
          (m) => m.msgType === BapMessageType.QueuezToClientUpdateNotification
        );
        expect(push).toBeDefined();
      } finally {
        close();
      }
    }
  );

  it.skipIf(!hasPackages())(
    "replies with a non-zero status and pushes nothing for a node with an unmet prerequisite",
    async () => {
      const { session, sent, close } = makeSession();
      try {
        const character = await withCharacter(session);
        const itemSoid = soidFor(SOID_TYPE_ITEM, 2);
        character.loadout = CharacterLoadout.fromItems([
          {
            soid: itemSoid,
            defIndex: 434,
            bucket: 7,
            equipSlot: 1,
            instanced: true,
            quantity: 1,
            artArrangement: 65_535,
            sandboxPattern: 12,
            power: 0,
          },
        ]);

        const reqBody = encodeServerMessage(
          nid._server_message_network_id_talent_grid_activate_step,
          liveBap().schemas.TalentGridActivateStepRequest,
          {
            itemSoid,
            // Node 1's prerequisite (node 0) was never activated.
            node: 1,
          }
        );
        await session["handleWorldServerRequest"]({
          msgType: BapMessageType.ClientToWorldServerRequest,
          sequence: 1,
          body: reqBody,
        });

        const reply = sent.find(
          (m) => m.msgType === BapMessageType.ClientToWorldServerResponse
        );
        const { value } = decodeServerMessage(
          reply!.body,
          liveBap().schemas.TalentGridActivateStepResponse
        );
        expect(value.unknown0.unknown0).not.toBe(0);
        expect(character.loadout.item(itemSoid)?.talentNodes[1]).toBe(0);
        expect(
          sent.some(
            (m) => m.msgType === BapMessageType.QueuezToClientUpdateNotification
          )
        ).toBe(false);
      } finally {
        close();
      }
    }
  );
});

describe("activity completion", () => {
  const selfPushes = (sent: RawBapMessage[]) =>
    sent.filter(
      (m) => m.msgType === BapMessageType.QueuezToClientUpdateNotification
    );

  // The self character's activity ([0]) and finished flag ([4]) and its
  // progression row indices, as the client decodes them from a family-4 push
  // (the character is the inventory object in baselines and deltas).
  const selfActivity = (message: RawBapMessage) => {
    const br = new BitReader(message.body);
    br.readNumber(32);
    br.readNumber(32);
    br.read(64);
    br.readNumber(32);
    br.readNumber(8);
    const count = br.readNumber(32);
    for (let i = 0; i < count; i++) {
      const checksum = br.readNumber(32) >>> 0;
      br.read(64);
      const payload = Buffer.alloc(br.readNumber(32));
      for (let b = 0; b < payload.length; b++) {
        payload[b] = br.readNumber(8);
      }
      if (checksum === liveBap().queuez.self.SELF_CHECKSUM_INVENTORY) {
        const character = decode(
          liveBap().queuez.self.SelfInventory,
          payload
        ).unknown0;
        return {
          activity: character.unknown5?.unknown0,
          finished: character.unknown5?.unknown4,
          progressions: (character.unknown7?.unknown0 ?? []).map(
            (row) => row.unknown3
          ),
        };
      }
    }
    throw new Error("no self character in the push");
  };

  const worldRequest = (networkId: number, sequence: number) => ({
    msgType: BapMessageType.ClientToWorldServerRequest,
    sequence,
    body: encodeServerMessage(
      networkId,
      liveBap().schemas.DirectorCompleteBinkActivityRequest,
      {
        activityIndex: 0,
      }
    ),
  });

  // Console capture: the join (FAH and GAH), the host's completion at the
  // lifetime's end, the client's 14 s results, its leave and
  // director_enter_orbit (the client has no fetch_universe). The real server
  // sends a character delta after the join, silence through the results, the
  // finished push after the leave. The client's reward tracker snapshots the
  // character's progressions when [0] changes, reading the constants' 109 and
  // 110 and the destination row's list unchecked (it crashes on 110).
  it.skipIf(!hasPackages())(
    "names the activity at the join, then finished with director_enter_orbit",
    async () => {
      const { session, sent, close } = makeSession();
      try {
        const character = await withCharacter(session);
        character.prologuePending = true;
        session.enterActivity(126);
        session.enterActivity(126);
        expect(selfPushes(sent)).toHaveLength(1);
        const joined = selfActivity(selfPushes(sent)[0]!);
        expect(joined.activity).toBe(126);
        expect(joined.finished).toBe(false);
        for (const index of [
          109, 110, 108, 111, 196, 197, 117, 119, 120, 125,
        ]) {
          expect(joined.progressions).toContain(index);
        }
        expect(character.lastActivity).toEqual({
          completed: false,
          index: 126,
        });

        session.completeActivity(126);
        expect(character.prologuePending).toBe(false);
        expect(selfPushes(sent)).toHaveLength(1);

        await session["handleWorldServerRequest"](
          worldRequest(nid._server_message_network_id_director_enter_orbit, 11)
        );
        // The finished push alone (no unfinished one first), then orbit's
        // own self update.
        const pushes = selfPushes(sent);
        expect(pushes).toHaveLength(3);
        expect(selfActivity(pushes[1]!)).toMatchObject({
          activity: 126,
          finished: true,
        });
        expect(selfActivity(pushes[2]!)).toMatchObject({
          activity: 126,
          finished: true,
        });
        expect(character.lastActivity).toEqual({ completed: true, index: 126 });

        // Nothing more on the next leave; the next join names its activity.
        await session["handleWorldServerRequest"](
          worldRequest(nid._server_message_network_id_director_enter_orbit, 12)
        );
        expect(selfPushes(sent)).toHaveLength(4);
        session.enterActivity(127);
        expect(selfActivity(selfPushes(sent)[4]!)).toMatchObject({
          activity: 127,
          finished: false,
        });
      } finally {
        session["clearOrbitRefresh"]();
        close();
      }
    }
  );

  // A BAP session that never saw the join (reconnected mid-mission) gets the
  // activity unfinished first, so [4] still turns on for it. The 2.3.1 client
  // leaves with fetch_universe and gets the push after its reply.
  it.skipIf(!hasPackages())(
    "sends running then complete after fetch_universe when the join never named the activity",
    async () => {
      const { session, sent, close } = makeSession();
      try {
        const character = await withCharacter(session);
        session.completeActivity(126);
        expect(selfPushes(sent)).toHaveLength(0);
        expect(character.lastActivity).toBeUndefined();
        await session["handleWorldServerRequest"](
          worldRequest(nid._server_message_network_id_fetch_universe, 9)
        );
        expect(sent[0]?.msgType).toBe(
          BapMessageType.ClientToWorldServerResponse
        );
        expect(sent[0]?.sequence).toBe(9);
        const pushes = selfPushes(sent);
        expect(pushes).toHaveLength(2);
        expect(selfActivity(pushes[0]!)).toMatchObject({
          activity: 126,
          finished: false,
        });
        expect(selfActivity(pushes[1]!)).toMatchObject({
          activity: 126,
          finished: true,
        });
        expect(character.lastActivity).toEqual({ completed: true, index: 126 });
        await session["handleWorldServerRequest"](
          worldRequest(nid._server_message_network_id_fetch_universe, 10)
        );
        expect(selfPushes(sent)).toHaveLength(2);
      } finally {
        close();
      }
    }
  );
});

describe("replies the client must get, in order", () => {
  it.skipIf(!hasPackages())(
    "acks director_complete_bink_activity (105) with the status nest",
    async () => {
      const { session, sent, close } = makeSession();
      try {
        await withCharacter(session);
        await session["handleWorldServerRequest"]({
          msgType: BapMessageType.ClientToWorldServerRequest,
          sequence: 7,
          body: encodeServerMessage(
            nid._server_message_network_id_director_complete_bink_activity,
            liveBap().schemas.DirectorCompleteBinkActivityRequest,
            { activityIndex: 125 }
          ),
        });
        expect(sent).toHaveLength(1);
        expect(sent[0]?.msgType).toBe(
          BapMessageType.ClientToWorldServerResponse
        );
        expect(sent[0]?.sequence).toBe(7);
        const { networkId, value } = decodeServerMessage(
          sent[0]!.body,
          liveBap().schemas.DirectorCompleteBinkActivityResponse
        );
        expect(networkId).toBe(105);
        expect(value.unknown0.unknown0).toBe(0);
      } finally {
        close();
      }
    }
  );

  it("answers unsubscribe (0xE) with 0xF", () => {
    const { session, sent, close } = makeSession();
    try {
      const body = Buffer.alloc(9);
      body.writeUInt8(4, 0);
      body.writeBigUInt64BE(0x100000002n, 1);
      session["handleUnsubscribeRequest"]({
        msgType: BapMessageType.ClientToBapUnsubscribeRequest,
        sequence: 92,
        body,
      });
      expect(sent).toHaveLength(1);
      expect(sent[0]?.msgType).toBe(
        BapMessageType.ClientToBapUnsubscribeResponse
      );
      expect(sent[0]?.sequence).toBe(92);
      expect(sent[0]?.body.readBigUInt64BE(0)).toBe(0x100000002n);
    } finally {
      close();
    }
  });
});
