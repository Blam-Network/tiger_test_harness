import { fnv1 } from "@blamnetwork/bullshcript/destiny1/common";
import { activityHostBuild } from "../versions";
import { readBits } from "./read-bits";

// Class 18 activity_host_incident from the client. The body is the names
// (the build's wire, activityHostBuild().incidents), a 9b metadata byte
// length, then the metadata blob; every metadata blob starts with the common
// header 808004C9 (u32 incident number, 808044A3 {submitter kind, submitter
// id}). Beyond the header the metadata is schema-specific and not decoded,
// so sensor client refs are found by scanning for a known bundle hash at any
// bit offset (SensorClientRef = u32 bundle, 6-bit typeId bias 1, 16-bit
// typeIndex bias 0x8000). Verified on a player_trigger incident: the ref
// {bundle, PlayerTrigger, 62} sits at bit 310.
export const INCIDENT_PLAYER_TRIGGER = fnv1("player_trigger");
export const INCIDENT_SEQUENCE = fnv1("sequence");
export const INCIDENT_PLAYER_SPAWNED = fnv1("player_spawned");
export const INCIDENT_PLAYER_RESURRECTED = fnv1("player_resurrected");
// Type 2 (80804A00): 808049FE toucher, u32 gathered_material, point, i16 -
// a quest item picked up.
export const INCIDENT_GATHER_MATERIAL = fnv1("gather_material");
// A quest item picked up: the Last Array's dead Ghosts. In the incident
// registry (index 1286), true name unknown. 41375 sends it only while
// obj_m4_o1b is up; the 2.3.1 capture (the same hash) carries the material at
// bit 428. Not FA1E35D9, which follows every kill of some Fallen whether or
// not any loot is enabled.
export const INCIDENT_QUEST_ITEM_COLLECTED = 0xed_63_90_13;
// Type 15 (80804E97): 80804A0C + u32 the interacted object's name + bool - a
// player used an interactable.
export const INCIDENT_INTERACTION = fnv1("interaction");
// A cinematic ended on the client; the metadata carries the Cinematic row's
// ref.
export const INCIDENT_CINEMATIC_FINISHED = fnv1("cinematic_finished");
export const INCIDENT_CINEMATIC_SKIP = fnv1("cinematic_skip");
export const INCIDENT_CINEMATIC_STARTED = fnv1("cinematic_started");
// A client picked an item up off the ground (the breach's o_weapon): the
// metadata carries the character and an item id. Registry index 1023; the host
// clears obj_get_weapon right after it (7 of 7 2.3.1 captures).
export const INCIDENT_INVENTORY_ITEM_ADDED = fnv1("inventory_item_added");

// Kill family (type 1): name[0] is the registry name (any_kill fires for every
// kill), the rest are specializations. kill_player_to_ai marks a
// squad/named-combatant kill; it is the one name here not in the registry.
export const INCIDENT_ANY_KILL = fnv1("any_kill");
export const INCIDENT_KILL = fnv1("kill");
export const INCIDENT_KILL_PLAYER_TO_AI = fnv1("kill_player_to_ai");
export const INCIDENT_PLAYER_DIED = fnv1("player_died");
// The registry's suicide and betrayal: with player_died, a player's own
// death rather than a kill.
export const INCIDENT_SUICIDE = fnv1("suicide");
export const INCIDENT_BETRAYAL = fnv1("betrayal");
const PLAYER_DEATH_NAMES: readonly number[] = [
  INCIDENT_PLAYER_DIED,
  INCIDENT_SUICIDE,
  INCIDENT_BETRAYAL,
];
const KILL_FAMILY_NAMES: readonly number[] = [
  INCIDENT_ANY_KILL,
  INCIDENT_KILL,
  INCIDENT_KILL_PLAYER_TO_AI,
];

interface IncidentRef {
  bundle: number;
  typeId: number;
  typeIndex: number;
}

interface ParsedIncident {
  // Bit offset where the metadata blob (common header 808004C9 first)
  // begins.
  metadataBit: number;
  // names[0] is the registry name (nameHash).
  nameHash: number;
  names: readonly number[];
  refs: IncidentRef[];
}

// A world position (x, y, z) an incident carries.
export interface IncidentPosition {
  x: number;
  y: number;
  z: number;
}

// The names are the build's wire; the metadata refs are found the same way
// in every build.
export function parseIncident(
  payload: Buffer,
  bundles: readonly number[]
): ParsedIncident | undefined {
  const named = activityHostBuild().incidents.readNames(payload);
  if (!named) {
    return;
  }
  return {
    nameHash: named.names[0]!,
    names: named.names,
    metadataBit: named.metadataBit,
    refs: scanRefs(payload, named.metadataBit, bundles),
  };
}

// Row references in the metadata, found by their bundle hash.
function scanRefs(
  payload: Buffer,
  metadataBit: number,
  bundles: readonly number[]
): IncidentRef[] {
  const totalBits = payload.length * 8;
  const refs: IncidentRef[] = [];
  for (let bit = metadataBit; bit + 54 <= totalBits; bit++) {
    const bundle = readBits(payload, bit, 32) >>> 0;
    if (!bundles.includes(bundle)) {
      continue;
    }
    const typeId = readBits(payload, bit + 32, 6) - 1;
    const typeIndex = readBits(payload, bit + 38, 16) - 0x8000;
    if (typeId >= 0 && typeId < 64 && typeIndex >= 0 && typeIndex < 512) {
      refs.push({ bundle, typeId, typeIndex });
      bit += 53;
    }
  }
  return refs;
}

// Does the metadata after the 99-bit common header hold `value` as a u32 at
// any bit offset? The fields before gather_material's u32 (808049FE) are not
// fixed-width, so this scans the way scanRefs scans for refs.
export function incidentCarriesU32(
  payload: Buffer,
  metadataBit: number,
  value: number
): boolean {
  const target = value >>> 0;
  for (let bit = metadataBit + 99; bit + 32 <= payload.length * 8; bit++) {
    if (readBits(payload, bit, 32) >>> 0 === target) {
      return true;
    }
  }
  return false;
}

// Any of the kill-family registry/specialization names (an AI or player
// kill) — the trigger for a loot roll.
export function isKillFamilyIncident(names: readonly number[]): boolean {
  return names.some((name) => KILL_FAMILY_NAMES.includes(name >>> 0));
}

// Any of the names that mark a kill-family incident as the player's own death.
export function isPlayerDeathIncident(names: readonly number[]): boolean {
  return names.some((name) => PLAYER_DEATH_NAMES.includes(name >>> 0));
}

export function incidentName(nameHash: number): string {
  switch (nameHash >>> 0) {
    case INCIDENT_PLAYER_TRIGGER:
      return "player_trigger";
    case INCIDENT_SEQUENCE:
      return "sequence";
    case INCIDENT_PLAYER_SPAWNED:
      return "player_spawned";
    case INCIDENT_PLAYER_RESURRECTED:
      return "player_resurrected";
    case INCIDENT_GATHER_MATERIAL:
      return "gather_material";
    case INCIDENT_CINEMATIC_FINISHED:
      return "cinematic_finished";
    case INCIDENT_CINEMATIC_SKIP:
      return "cinematic_skip";
    case INCIDENT_CINEMATIC_STARTED:
      return "cinematic_started";
    case INCIDENT_ANY_KILL:
      return "any_kill";
    case INCIDENT_KILL:
      return "kill";
    case INCIDENT_KILL_PLAYER_TO_AI:
      return "kill_player_to_ai";
    case INCIDENT_PLAYER_DIED:
      return "player_died";
    case INCIDENT_INVENTORY_ITEM_ADDED:
      return "inventory_item_added";
    default:
      return `0x${(nameHash >>> 0).toString(16)}`;
  }
}
