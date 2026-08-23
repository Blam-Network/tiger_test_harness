export enum e_queuez_family_type {
  _queuez_family_type_peer = 0,
  _queuez_family_type_inspection = 1,
  _queuez_family_type_roster = 2,
  _queuez_family_type_select_character = 3,
  _queuez_family_type_self = 4,
  _queuez_family_type_universe = 5,
}

export {
  InspectionCharacter,
  type InspectionCharacterValue,
  InspectionPrimary,
} from "./families/inspection";
export {
  PeerCharacter,
  type PeerCharacterValue,
  PeerPrimary,
} from "./families/peer";
export { RosterPrimary } from "./families/roster";
export {
  SelectCharacterCharacter,
  type SelectCharacterCharacterValue,
  SelectCharacterPrimary,
  type SelectCharacterPrimaryValue,
  SelectCharacterRoster,
} from "./families/select-character";
export {
  InventoryItem,
  type InventoryItemValue,
  SelfCharacter,
  type SelfCharacterValue,
  SelfInventory,
  SelfPrimary,
} from "./families/self";
export { ServerObject } from "./families/universe";

export * from "./shared";
