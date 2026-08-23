import {
  encode,
  encodeQueuezFamily,
  type QueuezObject,
} from "@blamnetwork/rsat";
import {
  e_queuez_family_type,
  InspectionCharacter,
  InspectionPrimary,
  InventoryItem,
  PeerCharacter,
  PeerPrimary,
  RosterPrimary,
  SelectCharacterPrimary,
  SelfInventory,
  SelfPrimary,
  ServerObject,
} from "../../queuez";
import {
  INSPECTION_CHECKSUM_CHARACTER,
  INSPECTION_CHECKSUM_PRIMARY,
  PEER_CHECKSUM_CHARACTER,
  PEER_CHECKSUM_PRIMARY,
  ROSTER_CHECKSUM_PRIMARY,
  SELECT_CHARACTER_CHECKSUM_PRIMARY,
  SELF_CHECKSUM_INVENTORY,
  SELF_CHECKSUM_ITEM,
  SELF_CHECKSUM_PRIMARY,
  UNIVERSE_CHECKSUM,
  UNIVERSE_ROOT_SOID,
} from "../constants";
import { itemSoidForSlot, STUB_ITEM_DEFS } from "./loadout";
import {
  stubInspectionCharacter,
  stubInventoryItem,
  stubPeerCharacter,
  stubSelfAfSlots,
  stubSelfCharacter,
} from "./values";

export type { QueuezObject };

export function buildSelfBaselineBody(
  rootSoid: bigint,
  objectSoid: bigint,
  version = 1,
  headerChecksum: number = SELF_CHECKSUM_PRIMARY,
  characterSoid = 0n,
  _username = ""
): Buffer {
  const hasChar = characterSoid !== 0n;
  const primary = encode(SelfPrimary, {
    unknown0: {
      soid: objectSoid,
      unknown1: undefined,
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

  if (hasChar) {
    objects.push({
      headerChecksum: SELF_CHECKSUM_INVENTORY,
      soid: characterSoid,
      payload: encode(SelfInventory, {
        unknown0: stubSelfCharacter(characterSoid),
      }),
    });
    for (const g of STUB_ITEM_DEFS) {
      objects.push({
        headerChecksum: SELF_CHECKSUM_ITEM,
        soid: itemSoidForSlot(g.slot),
        payload: encode(
          InventoryItem,
          stubInventoryItem(itemSoidForSlot(g.slot), g.defIndex, g.slot)
        ),
      });
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

export function buildPeerBaselineBody(
  rootSoid: bigint,
  objectSoid: bigint,
  version = 1,
  headerChecksum: number = PEER_CHECKSUM_PRIMARY,
  characterSoid = 0n
): Buffer {
  const objects: QueuezObject[] = [
    {
      headerChecksum,
      soid: objectSoid,
      payload: encode(PeerPrimary, {
        soid: objectSoid,
        characterSoid,
        unk2: undefined,
      }),
    },
  ];

  if (characterSoid !== 0n) {
    objects.push({
      headerChecksum: PEER_CHECKSUM_CHARACTER,
      soid: characterSoid,
      payload: encode(PeerCharacter, stubPeerCharacter(characterSoid)),
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

export function buildInspectionBaselineBody(
  rootSoid: bigint,
  objectSoid: bigint,
  version = 1,
  headerChecksum: number = INSPECTION_CHECKSUM_PRIMARY,
  characterSoid = 0n
): Buffer {
  const objects: QueuezObject[] = [
    {
      headerChecksum,
      soid: objectSoid,
      payload: encode(InspectionPrimary, {
        soid: objectSoid,
        characterSoid,
      }),
    },
  ];

  if (characterSoid !== 0n) {
    objects.push({
      headerChecksum: INSPECTION_CHECKSUM_CHARACTER,
      soid: characterSoid,
      payload: encode(
        InspectionCharacter,
        stubInspectionCharacter(characterSoid)
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

export function buildSelectCharacterBaselineBody(
  rootSoid: bigint,
  objectSoid: bigint,
  _version = 1,
  _headerChecksum?: number,
  characterSoids: bigint[] = []
): Buffer {
  const primary = encode(SelectCharacterPrimary, {
    soid: objectSoid,
    roster:
      characterSoids.length > 0
        ? { soids: characterSoids.slice(0, 10) }
        : undefined,
    unk2: undefined,
  });

  return encodeQueuezFamily({
    familyType: e_queuez_family_type._queuez_family_type_select_character,
    rootSoid,
    version: _version,
    flags: 1,
    objects: [
      {
        headerChecksum: SELECT_CHARACTER_CHECKSUM_PRIMARY,
        soid: objectSoid,
        payload: primary,
      },
    ],
  });
}

export function buildRosterBaselineBody(
  rootSoid: bigint,
  objectSoid: bigint,
  _version = 1,
  _headerChecksum?: number
): Buffer {
  const primary = encode(RosterPrimary, {
    soid: objectSoid,
    unk1: undefined,
    unk2: undefined,
  });
  return encodeQueuezFamily({
    familyType: e_queuez_family_type._queuez_family_type_roster,
    rootSoid,
    version: _version,
    flags: 1,
    objects: [
      {
        headerChecksum: ROSTER_CHECKSUM_PRIMARY,
        soid: objectSoid,
        payload: primary,
      },
    ],
  });
}

export function buildUniverseBaselineBody(
  rootSoid: bigint = UNIVERSE_ROOT_SOID,
  objectSoid: bigint = rootSoid,
  _version = 1,
  _headerChecksum?: number
): Buffer {
  const primary = encode(ServerObject, {
    soid: objectSoid,
    unknown1: 0n,
    unknown2: undefined,
    unknown3: undefined,
    unknown4: undefined,
  });
  return encodeQueuezFamily({
    familyType: e_queuez_family_type._queuez_family_type_universe,
    rootSoid,
    version: _version,
    flags: 1,
    objects: [
      {
        headerChecksum: UNIVERSE_CHECKSUM,
        soid: objectSoid,
        payload: primary,
      },
    ],
  });
}
