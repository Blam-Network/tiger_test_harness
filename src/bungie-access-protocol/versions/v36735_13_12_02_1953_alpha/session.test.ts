import { Socket } from "node:net";
import { decodeServerMessage, encodeServerMessage } from "@blamnetwork/rsat";
import { beforeAll, expect, it } from "vitest";
import { e_build } from "../../../builds";
import { BapMessageType } from "../../../lib/bap-wire/constants";
import { describeBuild, hasPackages } from "../../../test-support/build";
import { e_server_message_network_id as nid } from "../../rsat/constants";
import type { AlphaBapBuild } from ".";

const BUILD = e_build.v36735_13_12_02_1953_alpha;

// A character needs the level progression, which the packages hold.
// The neutral session on the alpha's schemas: what it answers, and what it
// leaves out.
describeBuild(BUILD, "alpha BAP session", () => {
  let bap: AlphaBapBuild;
  let makeSession: () => {
    close: () => void;
    sent: { body: Buffer; msgType: number; sequence: number }[];
    session: any;
    store: any;
  };

  beforeAll(async () => {
    const { alphaBap } = await import("./alpha-bap");
    bap = alphaBap();
    const { BungieAccessProtocolSession } = await import("../../session");
    const { MemoryCharacterStore } = await import(
      "../../../investment/character-store"
    );
    makeSession = () => {
      const store = new MemoryCharacterStore();
      const socket = new Socket();
      const session = new BungieAccessProtocolSession(socket, store);
      const sent: { body: Buffer; msgType: number; sequence: number }[] = [];
      session["send"] = (message: (typeof sent)[number]) => {
        sent.push(message);
      };
      return {
        close: () => {
          socket.emit("close");
          socket.destroy();
        },
        sent,
        session,
        store,
      };
    };
  });

  async function request(
    session: { handleWorldServerRequest(m: object): Promise<void> },
    body: Buffer,
    sequence = 1
  ) {
    await session.handleWorldServerRequest({
      msgType: BapMessageType.ClientToWorldServerRequest,
      sequence,
      body,
    });
  }

  const replies = (sent: { body: Buffer; msgType: number }[]) =>
    sent.filter(
      (m) => m.msgType === BapMessageType.ClientToWorldServerResponse
    );

  it("answers login_account with the client's checksums and the request's nest", async () => {
    const { close, sent, session } = makeSession();
    try {
      const account36 = Buffer.alloc(36, 0xab);
      const body = encodeServerMessage(
        nid._server_message_network_id_login_account,
        bap.schemas.LoginAccountRequest,
        { account: { unknown: { bytes: account36 }, trailing: 0x12_34n } }
      );
      await request(session, body);
      const [reply] = replies(sent);
      expect(reply).toBeDefined();
      const { networkId, value, optional } = decodeServerMessage(
        reply.body,
        bap.schemas.LoginAccountResponse
      );
      expect(networkId).toBe(503);
      expect(value.schemaChecksum).toBe(bap.checksums.SCHEMA_CHECKSUM);
      expect(value.contentChecksum).toBe(bap.checksums.CONTENT_CHECKSUM);
      // The alpha echoes the 36-byte account nest at offset 8 of a 56-byte
      // blob.
      expect(optional?.length).toBe(56);
      expect(optional?.subarray(8, 44)).toEqual(account36);
    } finally {
      close();
    }
  });

  // The alpha's client sends login_character for a new character itself.
  it.skipIf(!hasPackages(BUILD))(
    "creates a character without signing it in",
    async () => {
      const { close, sent, session, store } = makeSession();
      try {
        const account = await store.accountForPlatformId(5n, "guardian");
        session["account"] = account;
        // 17 code units with the usual 0x8000 bias; 0 ends the name.
        const chars = Buffer.alloc(34);
        for (let i = 0; i < 17; i++) {
          chars.writeUInt16BE(0x80_00 + ("codie".charCodeAt(i) || 0), i * 2);
        }
        const body = encodeServerMessage(
          nid._server_message_network_id_login_create_character,
          bap.schemas.LoginCreateCharacterRequest,
          {
            appearanceEc: { race: 0, gender: 1, classIndex: 2 },
            appearanceF0: {
              faceIndex: 3,
              hairIndex: 1,
              featureIndex: 0,
              decalIndex: 0,
              skinColor: 1,
              lipColor: 1,
              eyeColor: 1,
              hairColor: 1,
              featureColor: 1,
              decalColor: 1,
              personalityId: 0,
              helmetPreference: 0,
            },
            name: { chars },
          }
        );
        await request(session, body);
        const characters = await store.listCharacters(account.soid);
        expect(characters.map((c) => c.name)).toEqual(["codie"]);
        expect(characters[0].appearance.classIndex).toBe(2);
        expect(sent.map((m) => m.msgType)).toEqual([
          BapMessageType.ClientToWorldServerResponse,
        ]);
        expect(session["character"]).toBeNull();
      } finally {
        close();
      }
    }
  );

  it.skipIf(!hasPackages(BUILD))(
    "signs a character in on login_character",
    async () => {
      const { close, sent, session, store } = makeSession();
      try {
        const account = await store.accountForPlatformId(6n, "guardian");
        session["account"] = account;
        const { STUB_APPEARANCE } = await import(
          "../../../investment/stubs/stub-account"
        );
        const created = await store.createCharacter(
          account.soid,
          "guardian",
          STUB_APPEARANCE
        );
        await request(
          session,
          encodeServerMessage(
            nid._server_message_network_id_login_character,
            bap.schemas.LoginCharacterRequest,
            { characterSoid: created.soid }
          )
        );
        // The reply, then the self family with the character and its items.
        const types = sent.map((m) => m.msgType);
        expect(types).toEqual([
          BapMessageType.ClientToWorldServerResponse,
          BapMessageType.QueuezToClientUpdateNotification,
        ]);
        expect(session["character"]?.soid).toBe(created.soid);
      } finally {
        close();
      }
    }
  );

  it("acknowledges director_enter_orbit without pushing the self family", async () => {
    const { close, sent, session } = makeSession();
    try {
      const body = Buffer.alloc(2);
      body.writeUInt16BE(
        nid._server_message_network_id_director_enter_orbit,
        0
      );
      await request(session, body);
      const types = sent.map((m) => m.msgType);
      expect(types).toEqual([BapMessageType.ClientToWorldServerResponse]);
    } finally {
      close();
    }
  });

  // The alpha has no handler for these, so they get the status-only type-11
  // reply (an empty body) the day-0 client's zero reply table doesn't apply to.
  it.each([
    [nid._server_message_network_id_fetch_universe],
    [nid._server_message_network_id_director_complete_bink_activity],
  ])("answers request %d with an empty type-11 body", async (networkId) => {
    const { close, sent, session } = makeSession();
    try {
      const body = Buffer.alloc(4);
      body.writeUInt16BE(networkId, 0);
      await request(session, body, 9);
      expect(sent).toEqual([
        {
          body: Buffer.alloc(0),
          msgType: BapMessageType.ClientToWorldServerResponse,
          sequence: 9,
        },
      ]);
    } finally {
      close();
    }
  });

  it.skipIf(!hasPackages(BUILD))(
    "routes destroy_item (401) and tells the client with a removal",
    async () => {
      const { close, sent, session, store } = makeSession();
      try {
        const account = await store.accountForPlatformId(7n, "guardian");
        const { STUB_APPEARANCE } = await import(
          "../../../investment/stubs/stub-account"
        );
        const character = await store.createCharacter(
          account.soid,
          "guardian",
          STUB_APPEARANCE
        );
        session.account = account;
        session.character = character;
        const item = character.loadout.items.find((i) => i.instanced);
        expect(item).toBeDefined();
        await request(
          session,
          encodeServerMessage(
            nid._server_message_network_id_inventory_destroy_item,
            bap.schemas.InventoryDestroyItemRequest,
            { itemSoid: item!.soid }
          )
        );
        expect(character.loadout.item(item!.soid)).toBeUndefined();
        const types = sent.map((m) => m.msgType);
        expect(types).toContain(BapMessageType.ClientToWorldServerResponse);
        expect(types).toContain(
          BapMessageType.QueuezToClientUpdateNotification
        );
      } finally {
        close();
      }
    }
  );
});
