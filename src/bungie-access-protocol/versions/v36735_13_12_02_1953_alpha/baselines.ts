import {
  encode,
  encodeQueuezFamily,
  type QueuezObject,
} from "@blamnetwork/rsat";
import type { CharacterRecord } from "../../../investment/character-store";
import { e_queuez_family_type } from "../../queuez";
import { itemPower } from "../../queuez/power-level";
import { UNIVERSE_ROOT_SOID } from "../../stubs/server-objects";
import type { BapBaselines } from "../bap-build";
import { alphaBap } from "./alpha-bap";
import {
  appearanceEc,
  appearanceF0,
  stubGearCf,
  stubInspectionCharacter,
  stubInventoryItem,
  stubPeerCharacter,
  stubSelfAfSlots,
  stubSelfCharacter,
} from "./values";

// The self family: the account primary plus, once a character is signed in,
// its character object and items. Without a character the client stays on
// the select / create screen. The alpha's primary lists only the signed-in
// character's soid, so the account's roster is not used.
function buildSelfBaselineBody(
  rootSoid: bigint,
  objectSoid: bigint,
  version = 1,
  headerChecksum: number = alphaBap().checksums.SELF_CHECKSUM_PRIMARY,
  character: CharacterRecord | null = null
): Buffer {
  const { self } = alphaBap().queuez;
  const hasChar = character !== null;
  const characterSoid = character?.soid ?? 0n;
  const primary = encode(self.SelfPrimary, {
    unknown0: {
      soid: objectSoid,
      unknown1: hasChar ? { soids: [characterSoid] } : undefined,
      characterSoid: hasChar ? characterSoid : undefined,
      unknown3: undefined,
      unknown4: undefined,
      unknown5: undefined,
      unknown6: undefined,
      unknown7: {
        unknown0: false,
        unknown1: { unknown0: stubSelfAfSlots(hasChar) },
      },
      unknown8: undefined,
    },
  });

  const objects: QueuezObject[] = [
    { headerChecksum, soid: objectSoid, payload: primary },
  ];

  if (character) {
    objects.push(selfCharacterObject(character));
    for (const item of character.loadout.items) {
      // Stacks (currency / materials) have no item object, only a bag entry.
      if (item.instanced) {
        objects.push(selfItemObject(character, item));
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
    headerChecksum: alphaBap().checksums.SELF_CHECKSUM_INVENTORY,
    soid: character.soid,
    payload: encode(alphaBap().queuez.self.SelfInventory, {
      unknown0: stubSelfCharacter(character),
    }),
  };
}

function selfItemObject(
  character: CharacterRecord,
  item: CharacterRecord["loadout"]["items"][number]
): QueuezObject {
  return {
    headerChecksum: alphaBap().checksums.SELF_CHECKSUM_ITEM,
    soid: item.soid,
    payload: encode(
      alphaBap().queuez.self.InventoryItem,
      stubInventoryItem(
        item.soid,
        item.defIndex,
        item.talentXp,
        item.talentNodes,
        itemPower(item.power, character)
      )
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
      objects.push(selfItemObject(character, item));
    }
  }
  // A size-0 object header per removed soid (a sold or destroyed instanced
  // item): the client treats size 0 as a deletion. A soid must already exist
  // on the client, so never pass one it was never told about.
  for (const soid of removedItemSoids) {
    objects.push({
      headerChecksum: alphaBap().checksums.SELF_CHECKSUM_ITEM,
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
        headerChecksum: alphaBap().checksums.PEER_CHECKSUM_CHARACTER,
        soid: character.soid,
        payload: encode(
          alphaBap().queuez.peer.PeerCharacter,
          stubPeerCharacter(character)
        ),
      },
    ],
  });
}

function buildPeerBaselineBody(
  rootSoid: bigint,
  objectSoid: bigint,
  version = 1,
  headerChecksum: number = alphaBap().checksums.PEER_CHECKSUM_PRIMARY,
  character: CharacterRecord | null = null
): Buffer {
  const characterSoid = character?.soid ?? 0n;
  const objects: QueuezObject[] = [
    {
      headerChecksum,
      soid: objectSoid,
      payload: encode(alphaBap().queuez.peer.PeerPrimary, {
        soid: objectSoid,
        characterSoid,
        unk2: undefined,
      }),
    },
  ];

  if (character) {
    objects.push({
      headerChecksum: alphaBap().checksums.PEER_CHECKSUM_CHARACTER,
      soid: characterSoid,
      payload: encode(
        alphaBap().queuez.peer.PeerCharacter,
        stubPeerCharacter(character)
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

function buildInspectionBaselineBody(
  rootSoid: bigint,
  objectSoid: bigint,
  version = 1,
  headerChecksum: number = alphaBap().checksums.INSPECTION_CHECKSUM_PRIMARY,
  character: CharacterRecord | null = null
): Buffer {
  const { inspection } = alphaBap().queuez;
  const characterSoid = character?.soid ?? 0n;
  const objects: QueuezObject[] = [
    {
      headerChecksum,
      soid: objectSoid,
      payload: encode(inspection.InspectionPrimary, {
        soid: objectSoid,
        characterSoid,
      }),
    },
  ];

  if (character) {
    objects.push({
      headerChecksum: alphaBap().checksums.INSPECTION_CHECKSUM_CHARACTER,
      soid: characterSoid,
      payload: encode(
        inspection.InspectionCharacter,
        stubInspectionCharacter(character)
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

// The select-character family: the account's roster (max 10 soids) plus one
// object per character with appearance and gear, which the select screen
// renders.
function buildSelectCharacterBaselineBody(
  rootSoid: bigint,
  objectSoid: bigint,
  version = 1,
  _headerChecksum?: number,
  characters: readonly CharacterRecord[] = []
): Buffer {
  const { selectCharacter } = alphaBap().queuez;
  const roster = characters.slice(0, 10);
  const primary = encode(selectCharacter.SelectCharacterPrimary, {
    soid: objectSoid,
    roster:
      roster.length > 0 ? { soids: roster.map((c) => c.soid) } : undefined,
    unk2: undefined,
  });

  const objects: QueuezObject[] = [
    {
      headerChecksum: alphaBap().checksums.SELECT_CHARACTER_CHECKSUM_PRIMARY,
      soid: objectSoid,
      payload: primary,
    },
    ...roster.map((character) => ({
      headerChecksum: alphaBap().checksums.SELECT_CHARACTER_CHECKSUM_CHARACTER,
      soid: character.soid,
      payload: encode(selectCharacter.SelectCharacterCharacter, {
        soid: character.soid,
        appearanceEc: appearanceEc(character),
        appearanceF0: appearanceF0(character),
        progression: undefined,
        unknown4: undefined,
        gear: stubGearCf(character),
      }),
    })),
  ];

  return encodeQueuezFamily({
    familyType: e_queuez_family_type._queuez_family_type_select_character,
    rootSoid,
    version,
    flags: 1,
    objects,
  });
}

// The roster family's baseline is its primary alone.
function buildRosterBaselineBody(
  rootSoid: bigint,
  objectSoid: bigint,
  version = 1
): Buffer {
  const primary = encode(alphaBap().queuez.roster.RosterPrimary, {
    soid: objectSoid,
    unk1: undefined,
    unk2: undefined,
  });
  return encodeQueuezFamily({
    familyType: e_queuez_family_type._queuez_family_type_roster,
    rootSoid,
    version,
    flags: 1,
    objects: [
      {
        headerChecksum: alphaBap().checksums.ROSTER_CHECKSUM_PRIMARY,
        soid: objectSoid,
        payload: primary,
      },
    ],
  });
}

function buildUniverseBaselineBody(
  rootSoid: bigint = UNIVERSE_ROOT_SOID,
  objectSoid: bigint = rootSoid,
  version = 1
): Buffer {
  const primary = encode(alphaBap().schemas.ServerObject, {
    soid: objectSoid,
    unknown1: 0n,
    unknown2: undefined,
    unknown3: undefined,
    unknown4: undefined,
  });
  return encodeQueuezFamily({
    familyType: e_queuez_family_type._queuez_family_type_universe,
    rootSoid,
    version,
    flags: 1,
    objects: [
      {
        headerChecksum: alphaBap().checksums.UNIVERSE_CHECKSUM,
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
