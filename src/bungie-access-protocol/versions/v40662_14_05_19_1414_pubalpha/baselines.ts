import {
  encode,
  encodeQueuezFamily,
  type QueuezObject,
} from "@blamnetwork/rsat";
import { readDebugToggles } from "../../../dev-config/debug-toggles";
import type { CharacterRecord } from "../../../investment/character-store";
import {
  type ItemPrimaryStat,
  itemPrimaryStat,
} from "../../../investment/primary-stat";
import { e_queuez_family_type } from "../../queuez";
import { UNIVERSE_ROOT_SOID } from "../../stubs/server-objects";
import type { BapBaselines } from "../bap-build";
import { pubalphaBap } from "./pubalpha-bap";
import { serverObject } from "./server-object";
import {
  inspectionCharacter,
  inspectionPrimary,
  inventoryItem,
  peerCharacter,
  peerPrimary,
  rosterMember,
  selectCharacterCharacter,
  selectCharacterPrimary,
  selfCharacter,
  selfPrimary,
} from "./values";

export type { QueuezObject };

// Self family: account primary plus, once a character is signed in, its
// character object and items. Without a character the client stays on the
// select / create screen. investment_signin waits for this primary with soid
// == accountSoid.
export function buildSelfBaselineBody(
  rootSoid: bigint,
  objectSoid: bigint,
  version = 1,
  headerChecksum: number = pubalphaBap().queuez.self.SELF_CHECKSUM_PRIMARY,
  character: CharacterRecord | null = null,
  rosterSoids?: readonly bigint[]
): Buffer {
  const objects: QueuezObject[] = [
    {
      headerChecksum,
      soid: objectSoid,
      payload: encode(
        pubalphaBap().queuez.self.SelfPrimary,
        selfPrimary(objectSoid, character?.soid ?? null, rosterSoids)
      ),
    },
  ];

  if (character) {
    objects.push(selfCharacterObject(character));
    for (const item of character.loadout.items) {
      // Stacks (currency / materials) have no item object, only a bag
      // entry.
      if (item.instanced) {
        objects.push(selfItemObject(item));
      }
    }
  }

  return encodeQueuezFamily({
    familyType: e_queuez_family_type._queuez_family_type_self,
    rootSoid,
    version,
    flags: 1,
    objects,
  });
}

function selfCharacterObject(character: CharacterRecord): QueuezObject {
  return {
    headerChecksum: pubalphaBap().queuez.self.SELF_CHECKSUM_INVENTORY,
    soid: character.soid,
    payload: encode(pubalphaBap().queuez.self.SelfInventory, {
      unknown0: selfCharacter(character),
    }),
  };
}

// The item's level block values, or what debug-toggles.json grantLevelQuality
// substitutes to isolate the item object from an equip crash.
function selfItemPrimaryStat(
  item: CharacterRecord["loadout"]["items"][number]
): ItemPrimaryStat {
  switch (readDebugToggles().toggles.grantLevelQuality) {
    case "zero":
      return { level: 0, requiredLevel: 0, quality: 0 };
    case "def":
      return itemPrimaryStat({ defIndex: item.defIndex });
    default:
      return itemPrimaryStat(item);
  }
}

function selfItemObject(
  item: CharacterRecord["loadout"]["items"][number]
): QueuezObject {
  return {
    headerChecksum: pubalphaBap().queuez.self.SELF_CHECKSUM_ITEM,
    soid: item.soid,
    payload: encode(
      pubalphaBap().queuez.self.InventoryItem,
      inventoryItem(item, selfItemPrimaryStat(item))
    ),
  };
}

// A self family update after the baseline: the version must climb per family
// and flags 0 means "delta" (listed objects upserted, the rest kept). A
// payload only reaches the item-changed callback when its bytes differ, so
// send the character object plus the items whose equip state moved.
function buildSelfUpdateBody(
  rootSoid: bigint,
  version: number,
  character: CharacterRecord,
  changedItemSoids: readonly bigint[],
  removedItemSoids: readonly bigint[] = []
): Buffer {
  const objects: QueuezObject[] = [selfCharacterObject(character)];
  for (const item of character.loadout.items) {
    if (item.instanced && changedItemSoids.includes(item.soid)) {
      objects.push(selfItemObject(item));
    }
  }
  // A size-0 object header per removed soid (a sold or destroyed instanced
  // item): the client treats size 0 as a deletion. A soid must already exist
  // on the client, so never pass one it was never told about.
  for (const soid of removedItemSoids) {
    objects.push({
      headerChecksum: pubalphaBap().queuez.self.SELF_CHECKSUM_ITEM,
      soid,
      payload: Buffer.alloc(0),
    });
  }
  return encodeQueuezFamily({
    familyType: e_queuez_family_type._queuez_family_type_self,
    rootSoid,
    version,
    flags: 0,
    objects,
  });
}

function buildPeerUpdateBody(
  rootSoid: bigint,
  version: number,
  character: CharacterRecord
): Buffer {
  return encodeQueuezFamily({
    familyType: e_queuez_family_type._queuez_family_type_peer,
    rootSoid,
    version,
    flags: 0,
    objects: [
      {
        headerChecksum: pubalphaBap().queuez.peer.PEER_CHECKSUM_CHARACTER,
        soid: character.soid,
        payload: encode(
          pubalphaBap().queuez.peer.PeerCharacter,
          peerCharacter(character)
        ),
      },
    ],
  });
}

// Peer family: the account primary naming the signed-in character, plus that
// character's appearance and gear, which the client builds the player's body
// and weapons from. A retail capture has exactly these two objects.
function buildPeerBaselineBody(
  rootSoid: bigint,
  objectSoid: bigint,
  version = 1,
  headerChecksum: number = pubalphaBap().queuez.peer.PEER_CHECKSUM_PRIMARY,
  character: CharacterRecord | null = null
): Buffer {
  const objects: QueuezObject[] = [
    {
      headerChecksum,
      soid: objectSoid,
      payload: encode(
        pubalphaBap().queuez.peer.PeerPrimary,
        peerPrimary(objectSoid, character?.soid ?? null)
      ),
    },
  ];

  if (character) {
    objects.push({
      headerChecksum: pubalphaBap().queuez.peer.PEER_CHECKSUM_CHARACTER,
      soid: character.soid,
      payload: encode(
        pubalphaBap().queuez.peer.PeerCharacter,
        peerCharacter(character)
      ),
    });
  }

  return encodeQueuezFamily({
    familyType: e_queuez_family_type._queuez_family_type_peer,
    rootSoid,
    version,
    flags: 1,
    objects,
  });
}

// Inspection family. Its slot table also has 20 item slots (type 2); none are
// sent.
function buildInspectionBaselineBody(
  rootSoid: bigint,
  objectSoid: bigint,
  version = 1,
  headerChecksum: number = pubalphaBap().queuez.inspection
    .INSPECTION_CHECKSUM_PRIMARY,
  character: CharacterRecord | null = null
): Buffer {
  const objects: QueuezObject[] = [
    {
      headerChecksum,
      soid: objectSoid,
      payload: encode(
        pubalphaBap().queuez.inspection.InspectionPrimary,
        inspectionPrimary(objectSoid, character?.soid ?? null)
      ),
    },
  ];

  if (character) {
    objects.push({
      headerChecksum:
        pubalphaBap().queuez.inspection.INSPECTION_CHECKSUM_CHARACTER,
      soid: character.soid,
      payload: encode(
        pubalphaBap().queuez.inspection.InspectionCharacter,
        inspectionCharacter(character)
      ),
    });
  }

  return encodeQueuezFamily({
    familyType: e_queuez_family_type._queuez_family_type_inspection,
    rootSoid,
    version,
    flags: 1,
    objects,
  });
}

// Select-character family: the account's roster (max 10 soids) plus one
// character object per character with appearance and gear, which the select
// screen renders.
function buildSelectCharacterBaselineBody(
  rootSoid: bigint,
  objectSoid: bigint,
  _version = 1,
  _headerChecksum?: number,
  characters: readonly CharacterRecord[] = []
): Buffer {
  const roster = characters.slice(0, 10);
  const objects: QueuezObject[] = [
    {
      headerChecksum:
        pubalphaBap().queuez.selectCharacter.SELECT_CHARACTER_CHECKSUM_PRIMARY,
      soid: objectSoid,
      payload: encode(
        pubalphaBap().queuez.selectCharacter.SelectCharacterPrimary,
        selectCharacterPrimary(
          objectSoid,
          roster.map((c) => c.soid)
        )
      ),
    },
    ...roster.map((character) => ({
      headerChecksum:
        pubalphaBap().queuez.selectCharacter
          .SELECT_CHARACTER_CHECKSUM_CHARACTER,
      soid: character.soid,
      payload: encode(
        pubalphaBap().queuez.selectCharacter.SelectCharacterCharacter,
        selectCharacterCharacter(character)
      ),
    })),
  ];

  return encodeQueuezFamily({
    familyType: e_queuez_family_type._queuez_family_type_select_character,
    rootSoid,
    version: _version,
    flags: 1,
    objects,
  });
}

// Roster family. The baseline is the primary (same bytes as the peer primary)
// plus one roster member for the signed-in character; it does not carry the
// peer character (retail capture).
function buildRosterBaselineBody(
  rootSoid: bigint,
  objectSoid: bigint,
  version = 1,
  headerChecksum: number = pubalphaBap().queuez.roster.ROSTER_CHECKSUM_PRIMARY,
  character: CharacterRecord | null = null
): Buffer {
  const objects: QueuezObject[] = [
    {
      headerChecksum,
      soid: objectSoid,
      payload: encode(
        pubalphaBap().queuez.roster.RosterPrimary,
        peerPrimary(objectSoid, character?.soid ?? null)
      ),
    },
  ];
  if (character) {
    objects.push({
      headerChecksum: pubalphaBap().queuez.roster.ROSTER_CHECKSUM_MEMBER,
      soid: character.soid,
      payload: encode(
        pubalphaBap().queuez.roster.RosterMember,
        rosterMember(character)
      ),
    });
  }
  return encodeQueuezFamily({
    familyType: e_queuez_family_type._queuez_family_type_roster,
    rootSoid,
    version,
    flags: 1,
    objects,
  });
}

function buildUniverseBaselineBody(
  rootSoid: bigint = UNIVERSE_ROOT_SOID,
  objectSoid: bigint = rootSoid,
  _version = 1,
  _headerChecksum?: number
): Buffer {
  const primary = encode(
    pubalphaBap().schemas.ServerObject,
    serverObject(objectSoid)
  );
  return encodeQueuezFamily({
    familyType: e_queuez_family_type._queuez_family_type_universe,
    rootSoid,
    version: _version,
    flags: 1,
    objects: [
      {
        // The server_object's type-record checksum.
        headerChecksum: pubalphaBap().schemas.UNIVERSE_CHECKSUM,
        soid: objectSoid,
        payload: primary,
      },
    ],
  });
}

export const baselines: BapBaselines = {
  buildInspectionBaselineBody,
  buildPeerBaselineBody,
  buildPeerUpdateBody,
  buildRosterBaselineBody,
  buildSelectCharacterBaselineBody,
  buildSelfBaselineBody,
  buildSelfUpdateBody,
  buildUniverseBaselineBody,
};
